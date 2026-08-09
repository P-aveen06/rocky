"""Role-agnostic JD extraction and seniority-calibrated scorecards."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import re
from typing import Any, Literal

from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict

from domain.intake import (
    JobRequirement,
    ScorecardCompetency,
    ScorecardDocument,
    Seniority,
    SourceReference,
)
from prompts.scorecard_v1 import PROMPT_VERSION, SYSTEM_PROMPT

from ..config import Settings

logger = logging.getLogger(__name__)

RequirementClassLiteral = Literal["must-have", "trainable", "nice-to-have"]

MUST_HAVE_TOKENS = ("must", "required", "requirement", "minimum", "essential")
NICE_TO_HAVE_TOKENS = ("bonus", "preferred", "nice to have", "a plus", "advantage")

# Server-owned and deliberately role-neutral. The competencies are role
# specific; the bar for a given seniority is not.
SENIORITY_EXPECTATIONS: dict[Seniority, str] = {
    "junior": (
        "Explains fundamentals, completes scoped work with guidance, checks "
        "their own output, and asks useful clarifying questions."
    ),
    "mid": (
        "Works independently on real deliverables, weighs trade-offs, "
        "diagnoses problems, and communicates decisions clearly."
    ),
    "senior": (
        "Sets direction and standards, anticipates risks, leads trade-offs, "
        "and raises the effectiveness of the people around them."
    ),
}

# Used only when no model is configured. Intentionally role-neutral: a wrong
# generic competency is recoverable, a confidently wrong backend one is not.
FALLBACK_COMPETENCIES: tuple[
    tuple[str, str, int, tuple[str, ...], tuple[str, ...]], ...
] = (
    (
        "Core role skills",
        "Demonstrates the central skills the job description asks for.",
        35,
        (
            "Hands-on work that matches the core duties of this role",
            "Depth in the tools, methods, or materials the role names",
        ),
        ("core responsibilities", "tools and methods", "depth of practice"),
    ),
    (
        "Applied experience and delivery",
        "Has personally delivered comparable work end to end.",
        25,
        (
            "A piece of work personally owned from start to finish",
            "Constraints, deadlines, or quality bars that applied",
        ),
        ("past projects", "ownership", "delivery under constraints"),
    ),
    (
        "Problem solving and judgement",
        "Handles ambiguity, setbacks, and trade-offs sensibly.",
        20,
        (
            "A problem or setback personally worked through",
            "How options were weighed and a decision reached",
        ),
        ("problem solving", "decision making", "handling setbacks"),
    ),
    (
        "Communication and collaboration",
        "Works with others and explains decisions clearly.",
        20,
        (
            "Work done with colleagues, clients, or stakeholders",
            "A disagreement, feedback, or hand-off that was navigated",
        ),
        ("collaboration", "stakeholder communication", "feedback"),
    ),
)


class ScorecardGenerationError(RuntimeError):
    """A safe, user-displayable scorecard generation failure."""

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class StructuredCompetency(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    weight: int
    classification: RequirementClassLiteral
    evidence_to_collect: list[str]
    question_families: list[str]
    source_id: str
    supporting_quote: str


class StructuredScorecard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    competencies: list[StructuredCompetency]


async def generate_scorecard(
    raw_description: str,
    seniority: Seniority,
    *,
    title: str = "",
    settings: Settings | None = None,
    client: Any | None = None,
) -> tuple[list[JobRequirement], ScorecardDocument]:
    """Build a role-specific scorecard, using the model when configured."""

    sources = _jd_sources(raw_description)
    if not sources:
        raise ScorecardGenerationError(
            "The job description did not contain any text to build a scorecard from.",
            status_code=422,
        )

    use_llm = settings is not None and (
        settings.scorecard_generation_mode == "llm"
        or (
            settings.scorecard_generation_mode == "auto"
            and settings.app_env != "test"
            and settings.llm_profile_configured
        )
    )
    if not use_llm:
        return generate_scorecard_rules(raw_description, seniority)

    assert settings is not None
    return await _generate_scorecard_llm(
        sources,
        seniority,
        title=title,
        settings=settings,
        client=client,
    )


async def _generate_scorecard_llm(
    sources: list[SourceReference],
    seniority: Seniority,
    *,
    title: str,
    settings: Settings,
    client: Any | None = None,
) -> tuple[list[JobRequirement], ScorecardDocument]:
    prepared = _prepare_sources(sources, settings.scorecard_llm_max_input_characters)
    resolved_client = client or AsyncOpenAI(
        api_key=settings.azure_openai_api_key.get_secret_value(),
        base_url=_azure_v1_base_url(settings.azure_openai_endpoint or ""),
        timeout=settings.scorecard_llm_timeout_seconds,
        max_retries=0,
    )
    user_input = json.dumps(
        {
            "job_title": title[:240],
            "seniority": seniority,
            "job_description_sources": [
                {
                    "source_id": source.source_id,
                    "label": source.label,
                    "text": source.excerpt,
                }
                for source in prepared
            ],
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    try:
        response = await asyncio.wait_for(
            resolved_client.responses.parse(
                model=settings.azure_openai_text_deployment,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_input},
                ],
                text_format=StructuredScorecard,
                store=False,
            ),
            timeout=settings.scorecard_llm_timeout_seconds,
        )
    except TimeoutError as exc:
        raise ScorecardGenerationError(
            "Scorecard generation timed out. Try again in a moment.",
            status_code=504,
        ) from exc
    except Exception as exc:
        logger.warning(
            "scorecard_llm_request_failed",
            extra={"error_type": type(exc).__name__},
        )
        raise ScorecardGenerationError(
            "Scorecard generation could not reach the configured text "
            "deployment. Check the deployment name and try again.",
            status_code=502,
        ) from exc

    parsed = response.output_parsed
    if parsed is None:
        raise ScorecardGenerationError(
            "The AI could not produce a structured scorecard. Try again."
        )
    return _validate_llm_scorecard(
        parsed,
        prepared,
        seniority,
        settings.azure_openai_text_deployment,
    )


def _validate_llm_scorecard(
    parsed: StructuredScorecard,
    sources: list[SourceReference],
    seniority: Seniority,
    deployment: str,
) -> tuple[list[JobRequirement], ScorecardDocument]:
    by_id = {source.source_id: source for source in sources}
    accepted: list[tuple[StructuredCompetency, SourceReference]] = []
    seen: set[str] = set()

    for item in parsed.competencies:
        source = _require_supported_quote(item.source_id, item.supporting_quote, by_id)
        name = " ".join(item.name.split()).strip()
        description = " ".join(item.description.split()).strip()
        fingerprint = name.casefold()
        if not name or len(name) > 120 or fingerprint in seen:
            continue
        if not description:
            continue
        evidence = _clean_list(item.evidence_to_collect)
        questions = _clean_list(item.question_families)
        if not evidence or not questions:
            continue
        seen.add(fingerprint)
        quote = " ".join(item.supporting_quote.split()).strip()
        accepted.append(
            (
                item.model_copy(
                    update={
                        "name": name,
                        "description": description[:1_000],
                        "evidence_to_collect": evidence,
                        "question_families": questions,
                    }
                ),
                SourceReference(
                    source_id=source.source_id,
                    label=source.label,
                    excerpt=quote[:320],
                ),
            )
        )

    accepted = accepted[:10]
    if len(accepted) < 2:
        raise ScorecardGenerationError(
            "The AI did not return enough job-description-supported "
            "competencies. Try again."
        )

    # The model is asked for weights summing to 100 but is not trusted to get
    # there; ScorecardDocument rejects anything else.
    weights = _normalized_weights([max(1, item.weight) for item, _ in accepted])
    competencies = []
    requirements = []
    for (item, source), weight in zip(accepted, weights, strict=True):
        competencies.append(
            ScorecardCompetency(
                id=_stable_id("competency", item.name),
                name=item.name,
                description=item.description,
                weight=weight,
                classification=item.classification,
                seniority_expectation=SENIORITY_EXPECTATIONS[seniority],
                evidence_to_collect=item.evidence_to_collect,
                question_families=item.question_families,
                source_references=[source],
            )
        )
        requirements.append(
            JobRequirement(
                id=_stable_id("requirement", item.name),
                name=item.name,
                classification=item.classification,
                source=source,
            )
        )
    return requirements, ScorecardDocument(
        competencies=competencies,
        generator_version=f"azure:{deployment}:{PROMPT_VERSION}",
    )


def generate_scorecard_rules(
    raw_description: str, seniority: Seniority
) -> tuple[list[JobRequirement], ScorecardDocument]:
    """Deterministic fallback used without LLM configuration and in tests."""

    sources = _jd_sources(raw_description)
    if not sources:
        raise ScorecardGenerationError(
            "The job description did not contain any text to build a scorecard from.",
            status_code=422,
        )
    requirements = extract_job_requirements(raw_description)
    default_source = sources[0]
    weights = _normalized_weights([item[2] for item in FALLBACK_COMPETENCIES])
    competencies = [
        ScorecardCompetency(
            id=_stable_id("competency", name),
            name=name,
            description=description,
            weight=weight,
            classification=_classification_for_text(raw_description),
            seniority_expectation=SENIORITY_EXPECTATIONS[seniority],
            evidence_to_collect=list(evidence),
            question_families=list(questions),
            source_references=[default_source],
        )
        for (name, description, _, evidence, questions), weight in zip(
            FALLBACK_COMPETENCIES, weights, strict=True
        )
    ]
    return requirements, ScorecardDocument(
        competencies=competencies,
        generator_version="role-neutral-fallback-v1",
    )


def extract_job_requirements(raw_description: str) -> list[JobRequirement]:
    """Read requirement lines straight out of the JD, with no role assumptions."""

    requirements: list[JobRequirement] = []
    seen: set[str] = set()
    for source in _jd_sources(raw_description):
        name = _requirement_name(source.excerpt)
        fingerprint = name.casefold()
        if not name or fingerprint in seen:
            continue
        seen.add(fingerprint)
        requirements.append(
            JobRequirement(
                id=_stable_id("requirement", name),
                name=name,
                classification=_classification_for_text(source.excerpt),
                source=source,
            )
        )
        if len(requirements) >= 20:
            break
    return requirements


def _requirement_name(excerpt: str) -> str:
    text = " ".join(excerpt.split()).strip(" -–—•*:")
    if len(text) < 6:
        return ""
    # Requirement lines are usually one clause; the first is the requirement.
    clause = re.split(r"(?<=[.;])\s+", text)[0].strip()
    return clause[:120]


def _jd_sources(raw_description: str) -> list[SourceReference]:
    lines = [" ".join(line.split()) for line in raw_description.splitlines()]
    lines = [line for line in lines if line]
    if len(lines) == 1:
        sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", lines[0])]
        lines = [item for item in sentences if item]
    return [
        SourceReference(
            source_id=f"jd:line:{number}",
            label=f"Job description line {number}",
            excerpt=line[:500],
        )
        for number, line in enumerate(lines, start=1)
    ]


def _require_supported_quote(
    source_id: str,
    quote: str,
    sources: dict[str, SourceReference],
) -> SourceReference:
    source = sources.get(source_id)
    normalized_quote = _normalize_for_support(quote)
    if (
        source is None
        or len(normalized_quote) < 3
        or normalized_quote not in _normalize_for_support(source.excerpt)
    ):
        raise ScorecardGenerationError(
            "The AI returned a competency that could not be verified against "
            "the job description. Try again."
        )
    return source


def _prepare_sources(
    sources: list[SourceReference], max_characters: int
) -> list[SourceReference]:
    remaining = max(1, max_characters)
    prepared: list[SourceReference] = []
    for source in sources:
        if remaining <= 0:
            break
        text = source.excerpt[:remaining].strip()
        if not text:
            continue
        prepared.append(source.model_copy(update={"excerpt": text}))
        remaining -= len(text)
    return prepared


def _clean_list(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = " ".join(value.split()).strip()
        fingerprint = text.casefold()
        if len(text) < 3 or fingerprint in seen:
            continue
        seen.add(fingerprint)
        cleaned.append(text[:500])
        if len(cleaned) == 8:
            break
    return cleaned


def _classification_for_text(text: str) -> RequirementClassLiteral:
    lowered = text.casefold()
    if any(token in lowered for token in MUST_HAVE_TOKENS):
        return "must-have"
    if any(token in lowered for token in NICE_TO_HAVE_TOKENS):
        return "nice-to-have"
    return "trainable"


def _normalize_for_support(value: str) -> str:
    return " ".join(value.split()).casefold()


def _azure_v1_base_url(endpoint: str) -> str:
    from .profile import _azure_v1_base_url as resolve

    try:
        return resolve(endpoint)
    except Exception as exc:
        raise ScorecardGenerationError(
            "AZURE_OPENAI_ENDPOINT must be a complete HTTPS Azure resource URL.",
            status_code=503,
        ) from exc


def _normalized_weights(priorities: list[int]) -> list[int]:
    total = sum(priorities)
    raw = [priority * 100 / total for priority in priorities]
    weights = [max(1, math.floor(value)) for value in raw]
    remaining = 100 - sum(weights)
    order = sorted(
        range(len(raw)), key=lambda index: raw[index] - weights[index], reverse=True
    )
    if remaining > 0:
        for index in order[:remaining]:
            weights[index] += 1
    else:
        # Flooring to a minimum of 1 can overshoot when many competencies are
        # returned; take the excess back off the largest ones that can spare it.
        deficit = -remaining
        for index in reversed(order):
            if deficit == 0:
                break
            spare = min(deficit, weights[index] - 1)
            weights[index] -= spare
            deficit -= spare
    return weights


def _stable_id(kind: str, value: str) -> str:
    digest = hashlib.sha256(value.encode()).hexdigest()[:12]
    return f"{kind}-{digest}"
