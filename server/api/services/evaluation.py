"""Post-interview evaluation with evidence validation and one repair attempt."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from urllib.parse import urlsplit

from openai import AsyncOpenAI, LengthFinishReasonError
from pydantic import ValidationError

from api.config import Settings
from domain.evaluation import (
    EvaluationDraft,
    EvaluationIntegrityError,
    EvaluationReport,
    EvaluationTranscriptTurn,
    validate_and_score_evaluation,
)
from domain.intake import ScorecardDocument, Seniority
from prompts.evaluation_v1 import PROMPT_VERSION, SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class EvaluationServiceError(RuntimeError):
    """A safe, user-displayable evaluation failure."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 502,
        integrity_issues: list[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.integrity_issues = integrity_issues or []


async def evaluate_transcript(
    *,
    scorecard: ScorecardDocument,
    seniority: Seniority,
    turns: list[EvaluationTranscriptTurn],
    interview_section_timings: list[dict[str, object]],
    interview_prompt_version: str,
    settings: Settings,
    client: Any | None = None,
    timeout_seconds: float | None = None,
) -> EvaluationReport:
    """Generate, validate, and deterministically score one finalized transcript.

    A schema-valid response may still invent an ID or quote. Such integrity
    failures receive exactly one clean regeneration attempt. Transport failures
    are surfaced to the caller so route/job orchestration can expose a
    recoverable state without accidentally issuing duplicate evaluations.
    """

    _validate_finalized_input(turns)
    deployment = settings.azure_openai_text_deployment.strip()
    resolved_client = client or _configured_client(settings)
    evaluator_version = f"azure:{deployment}:{PROMPT_VERSION}"
    competency_aliases, turn_aliases = _identifier_aliases(scorecard, turns)
    alias_by_competency = {real: alias for alias, real in competency_aliases.items()}
    alias_by_turn = {real: alias for alias, real in turn_aliases.items()}
    request_payload: dict[str, object] = {
        "candidate_seniority": seniority,
        "interview_prompt_version": interview_prompt_version,
        "evaluator_prompt_version": PROMPT_VERSION,
        "scorecard": [
            {
                "competency_id": alias_by_competency[competency.id],
                "name": competency.name,
                "description": competency.description,
                "weight": competency.weight,
                "classification": competency.classification,
                "seniority_expectation": competency.seniority_expectation,
                "evidence_to_collect": competency.evidence_to_collect,
            }
            for competency in scorecard.competencies
        ],
        "interview_section_timings": interview_section_timings,
        "ordered_transcript": [
            {**turn.model_dump(), "id": alias_by_turn[turn.id]} for turn in turns
        ],
    }
    wait_seconds = timeout_seconds or settings.resume_llm_timeout_seconds
    last_issues: list[str] = []

    for attempt in range(1, 3):
        attempt_payload = dict(request_payload)
        if last_issues:
            attempt_payload["regeneration_required"] = {
                "reason": "The prior output failed evidence-integrity validation.",
                # Issues name real identifiers, which the model was never shown.
                # Feeding those back would ask it to correct something using
                # values it has no way to recognise.
                "validation_issues": _aliased_issues(
                    last_issues, alias_by_competency, alias_by_turn
                ),
                "instruction": "Regenerate the complete evaluation from source data.",
            }
        parsed = await _request_evaluation(
            resolved_client,
            deployment=deployment,
            payload=attempt_payload,
            timeout_seconds=wait_seconds,
        )
        if parsed is None:
            last_issues = ["structured evaluator output was empty"]
            continue
        try:
            draft = _restore_identifiers(
                parsed
                if isinstance(parsed, EvaluationDraft)
                else EvaluationDraft.model_validate(parsed),
                competency_aliases,
                turn_aliases,
            )
            return validate_and_score_evaluation(
                draft,
                scorecard,
                turns,
                evaluator_version=evaluator_version,
                validation_attempts=attempt,
            )
        except (EvaluationIntegrityError, ValueError) as exc:
            last_issues = (
                exc.issues
                if isinstance(exc, EvaluationIntegrityError)
                else ["structured evaluator output violated the evaluation contract"]
            )
            logger.warning(
                "evaluation_integrity_validation_failed",
                extra={
                    "attempt": attempt,
                    "issue_count": len(last_issues),
                    # Issues name competency and turn identifiers only, never
                    # transcript text, so they are safe to record. Without them
                    # a rejected evaluation is indistinguishable from any other,
                    # and the cause can only be guessed at.
                    "issues": last_issues[:10],
                },
            )

    raise EvaluationServiceError(
        "The evaluation could not produce transcript-supported results. "
        "Your transcript is preserved; retry evaluation in a moment.",
        integrity_issues=last_issues,
    )


def _identifier_aliases(
    scorecard: ScorecardDocument, turns: list[EvaluationTranscriptTurn]
) -> tuple[dict[str, str], dict[str, str]]:
    """Map short ordinal aliases to the real competency and turn identifiers.

    Real identifiers are 23 and 36 character random strings, and the model has
    to echo them back for every citation. It does not do so reliably: observed
    output truncated one competency id, appended "-PLACEHOLDER" to another, and
    invented turn ids outright, all of which the integrity validator then
    rejected as fabricated evidence. Short ordinals copy cleanly, and the server
    translates them back before anything is validated or stored.
    """

    competencies = {
        f"c{index}": competency.id
        for index, competency in enumerate(scorecard.competencies, start=1)
    }
    return competencies, {f"t{turn.sequence}": turn.id for turn in turns}


def _restore_identifiers(
    draft: EvaluationDraft,
    competency_aliases: dict[str, str],
    turn_aliases: dict[str, str],
) -> EvaluationDraft:
    """Translate aliases in a draft back to real identifiers.

    An alias the model invented has no mapping, so it passes through unchanged
    and is rejected downstream exactly as a fabricated identifier was before.
    """

    data = draft.model_dump()
    for result in data["competency_results"]:
        result["competency_id"] = competency_aliases.get(
            result["competency_id"], result["competency_id"]
        )
        for citation in result.get("evidence") or []:
            citation["turn_id"] = turn_aliases.get(
                citation["turn_id"], citation["turn_id"]
            )
    for field in ("strength_competency_ids", "gap_competency_ids"):
        data[field] = [competency_aliases.get(value, value) for value in data[field]]
    for exercise in data["practice_exercises"]:
        exercise["competency_ids"] = [
            competency_aliases.get(value, value) for value in exercise["competency_ids"]
        ]
    return EvaluationDraft.model_validate(data)


def _aliased_issues(
    issues: list[str],
    alias_by_competency: dict[str, str],
    alias_by_turn: dict[str, str],
) -> list[str]:
    """Rewrite validation issues into the identifiers the model was given."""

    replacements = {**alias_by_competency, **alias_by_turn}
    rewritten = []
    for issue in issues:
        for real, alias in replacements.items():
            issue = issue.replace(real, alias)
        rewritten.append(issue)
    return rewritten


async def _request_evaluation(
    client: Any,
    *,
    deployment: str,
    payload: dict[str, object],
    timeout_seconds: float,
) -> EvaluationDraft | dict[str, object] | None:
    user_input = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    try:
        response = await asyncio.wait_for(
            client.responses.parse(
                model=deployment,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_input},
                ],
                text_format=EvaluationDraft,
                store=False,
            ),
            timeout=timeout_seconds,
        )
    except (json.JSONDecodeError, LengthFinishReasonError, ValidationError):
        logger.warning("evaluation_structured_output_invalid")
        return None
    except TimeoutError as exc:
        raise EvaluationServiceError(
            "Evaluation timed out. Your transcript is preserved; try again.",
            status_code=504,
        ) from exc
    except Exception as exc:
        logger.warning(
            "evaluation_model_request_failed",
            extra={"error_type": type(exc).__name__},
        )
        raise EvaluationServiceError(
            "Evaluation could not reach the configured text deployment. "
            "Your transcript is preserved; try again.",
            status_code=502,
        ) from exc
    return response.output_parsed


def _validate_finalized_input(turns: list[EvaluationTranscriptTurn]) -> None:
    if not turns:
        raise EvaluationServiceError(
            "The interview transcript is empty and cannot be evaluated.",
            status_code=409,
        )
    sequences = [turn.sequence for turn in turns]
    identifiers = [turn.id for turn in turns]
    if sequences != sorted(sequences) or len(sequences) != len(set(sequences)):
        raise EvaluationServiceError(
            "The interview transcript is not finalized in a stable order.",
            status_code=409,
        )
    if len(identifiers) != len(set(identifiers)):
        raise EvaluationServiceError(
            "The interview transcript contains duplicate turn identifiers.",
            status_code=409,
        )
    if not any(turn.speaker == "user" for turn in turns):
        raise EvaluationServiceError(
            "The interview has no candidate answers to evaluate.",
            status_code=409,
        )


def _configured_client(settings: Settings) -> AsyncOpenAI:
    key = (
        settings.azure_openai_api_key.get_secret_value().strip()
        if settings.azure_openai_api_key
        else ""
    )
    endpoint = (settings.azure_openai_endpoint or "").strip()
    deployment = settings.azure_openai_text_deployment.strip()
    if not endpoint or not key or not deployment:
        raise EvaluationServiceError(
            "AI evaluation is not configured. Set the Azure OpenAI endpoint, "
            "API key, and text deployment.",
            status_code=503,
        )
    return AsyncOpenAI(
        api_key=key,
        base_url=_azure_v1_base_url(endpoint),
        timeout=settings.resume_llm_timeout_seconds,
        max_retries=0,
    )


def _azure_v1_base_url(endpoint: str) -> str:
    normalized = endpoint.strip().rstrip("/")
    parsed = urlsplit(normalized)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise EvaluationServiceError(
            "AZURE_OPENAI_ENDPOINT must be a complete HTTPS Azure resource URL.",
            status_code=503,
        )
    if parsed.path.rstrip("/").endswith("/openai/v1"):
        return f"{normalized}/"
    if parsed.path.rstrip("/").endswith("/openai"):
        return f"{normalized}/v1/"
    return f"{normalized}/openai/v1/"
