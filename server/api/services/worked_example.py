"""Versioned synthetic interview seeded once for each guest account."""

# Exact synthetic transcript and citation strings are kept readable as prose.
# ruff: noqa: E501

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from domain.evaluation import (
    CompetencyEvaluation,
    EvaluationDraft,
    EvaluationTranscriptTurn,
    EvidenceCitation,
    PracticeExercise,
    validate_and_score_evaluation,
)
from domain.intake import ScorecardDocument
from prompts.interview_v1 import (
    PROMPT_VERSION as INTERVIEW_PROMPT_VERSION,
)
from prompts.interview_v1 import (
    build_setup_snapshot,
    setup_fingerprint,
)

from ..models import (
    CandidateProfile,
    Evaluation,
    InterviewSession,
    InterviewTurn,
    JobTarget,
    Scorecard,
    Upload,
    UsageEvent,
    User,
)
from .evaluation_jobs import EVALUATION_SCHEMA_VERSION, transcript_fingerprint

WORKED_EXAMPLE_VERSION = "worked-example-v1"
WORKED_EXAMPLE_EVENT = "worked_example_seeded"
WORKED_EXAMPLE_TITLE = "Worked example · Senior Backend Engineer"

_NAMESPACE = uuid.UUID("8dbfb956-a178-43f5-b9a1-275f3fa15cd6")


def _id(user_id: str, label: str) -> str:
    return str(uuid.uuid5(_NAMESPACE, f"{WORKED_EXAMPLE_VERSION}:{user_id}:{label}"))


def _source(source_id: str, label: str, excerpt: str) -> dict[str, object]:
    return {"source_id": source_id, "label": label, "excerpt": excerpt}


def _scorecard_competencies(job_target_id: str) -> list[dict[str, object]]:
    definitions = [
        (
            "system-design",
            "System design and scalability",
            "Designs services with clear boundaries, scaling choices, and explicit trade-offs.",
            20,
            "must-have",
            "Leads the design of scalable services and explains capacity and failure trade-offs.",
            ["service boundaries", "scaling strategy", "trade-off reasoning"],
            ["architecture deep dive", "scaling scenario"],
        ),
        (
            "backend-engineering",
            "Backend API engineering",
            "Builds maintainable APIs with safe request handling and predictable contracts.",
            15,
            "must-have",
            "Owns production API design, compatibility, and operational behavior.",
            ["API contracts", "idempotency", "failure handling"],
            ["API design", "implementation deep dive"],
        ),
        (
            "data-consistency",
            "Data modeling and consistency",
            "Chooses data models and consistency controls that protect business invariants.",
            15,
            "must-have",
            "Makes sound transactional and data-evolution decisions under concurrency.",
            ["transaction boundary", "schema choices", "concurrency handling"],
            ["data model", "concurrency scenario"],
        ),
        (
            "reliability",
            "Reliability and observability",
            "Uses measurable service signals and disciplined incident response to improve reliability.",
            15,
            "must-have",
            "Defines useful SLOs, diagnoses incidents, and turns findings into durable controls.",
            ["service indicators", "incident diagnosis", "prevention"],
            ["production incident", "observability design"],
        ),
        (
            "security",
            "Application security",
            "Protects authentication, authorization, sensitive data, and tenant boundaries.",
            10,
            "must-have",
            "Designs layered controls and verifies that authorization cannot be bypassed.",
            ["authorization", "tenant isolation", "security testing"],
            ["threat scenario", "access-control review"],
        ),
        (
            "technical-leadership",
            "Technical leadership",
            "Coordinates risky changes, raises team capability, and creates clear decision ownership.",
            15,
            "trainable",
            "Leads cross-team delivery while keeping risk, rollout, and accountability visible.",
            ["cross-team influence", "migration planning", "mentoring"],
            ["leadership example", "conflict and alignment"],
        ),
        (
            "product-communication",
            "Product judgment and communication",
            "Connects engineering choices to user outcomes and communicates trade-offs clearly.",
            10,
            "nice-to-have",
            "Frames technical decisions in terms of customer impact, evidence, and reversible bets.",
            ["customer impact", "decision framing", "stakeholder communication"],
            ["product trade-off", "stakeholder scenario"],
        ),
    ]
    competencies: list[dict[str, object]] = []
    for (
        slug,
        name,
        description,
        weight,
        classification,
        expectation,
        evidence,
        questions,
    ) in definitions:
        requirement_id = f"{job_target_id}:{slug}"
        competencies.append(
            {
                "id": slug,
                "name": name,
                "description": description,
                "weight": weight,
                "classification": classification,
                "seniority_expectation": expectation,
                "evidence_to_collect": evidence,
                "question_families": questions,
                "source_references": [
                    _source(
                        requirement_id,
                        "Synthetic Senior Backend Engineer job description",
                        description,
                    )
                ],
            }
        )
    return competencies


def _transcript() -> list[tuple[str, str]]:
    return [
        (
            "assistant",
            "Welcome, Maya. We will cover architecture, reliability, security, and leadership. "
            "To begin, tell me about a backend system you personally designed and the scale it had to support.",
        ),
        (
            "user",
            "I led the redesign of an order-ingestion platform that handled about 18 million events per day. "
            "I separated synchronous order validation from asynchronous fulfillment using a durable queue, "
            "partitioned consumers by merchant, and kept the write API stateless so it could scale horizontally. "
            "Before choosing that shape, I estimated peak throughput, replay volume, and the cost of a regional outage. "
            "The main trade-off was accepting eventual consistency for fulfillment status while keeping order acceptance strongly consistent. "
            "We load-tested at twice the forecast peak and used queue age, not just request latency, as the scaling signal.",
        ),
        (
            "assistant",
            "Suppose a client times out after submitting an order and retries. How would you prevent duplicate work, "
            "and where would you enforce the business invariant?",
        ),
        (
            "user",
            "I would require an idempotency key scoped to the merchant and operation. The API would insert the key, "
            "request hash, and result reference in the same database transaction as the order. A unique constraint on "
            "merchant and idempotency key makes concurrent retries converge on one record. If the same key arrives with "
            "a different payload, the API returns a conflict instead of silently reusing the first result. Downstream, "
            "the outbox record is written in that transaction and consumers also deduplicate by event ID. This keeps the "
            "source-of-truth invariant in PostgreSQL rather than relying on an in-memory lock.",
        ),
        (
            "assistant",
            "Describe a production incident from that system. What signals helped you isolate it, and what changed afterward?",
        ),
        (
            "user",
            "One release increased queue age even though API latency and CPU looked normal. I compared deploy markers with "
            "consumer throughput and found that a new enrichment call had pushed the p95 handler time above the lease renewal window. "
            "Messages were being redelivered, which amplified the backlog. We disabled the enrichment behind a feature flag, "
            "drained the queue, and verified recovery against queue-age and redelivery-rate dashboards. Afterward I added an SLO "
            "for end-to-end processing delay, a load test with the real lease duration, and an alert on redelivery ratio. "
            "The runbook now identifies the safe rollback and backlog-drain sequence.",
        ),
        (
            "assistant",
            "The platform serves many merchants. Walk me through how you would protect tenant boundaries and test those controls.",
        ),
        (
            "user",
            "Authentication establishes the caller, but every data access still needs an authorization decision for the merchant. "
            "I pass an immutable tenant context from the gateway, derive permitted merchant IDs server-side, and include the tenant key "
            "in repository queries and cache keys. Administrative operations use a separate permission and produce an audit event. "
            "For testing, I use negative integration cases that create records for two tenants and attempt cross-tenant reads, updates, "
            "exports, and guessed identifiers. I would also review background jobs because they are a common place to lose request-scoped controls. "
            "I have not yet implemented database row-level security, so I would evaluate it as an additional containment layer.",
        ),
        (
            "assistant",
            "Tell me about a risky migration that required other teams to change. How did you lead it without blocking delivery?",
        ),
        (
            "user",
            "I coordinated a migration from numeric customer IDs to opaque IDs across six services. I wrote a short decision record, "
            "named an owner in each team, and proposed a dual-read, dual-write sequence with measurable exit criteria. We first added "
            "the new field without changing behavior, backfilled in bounded batches, and published a compatibility library so teams did not "
            "reimplement mapping logic. A dashboard showed adoption and mismatch rates by service. When one team could not meet the original date, "
            "we kept the compatibility window open rather than forcing a flag day, but assigned a new deadline and escalation owner. "
            "We removed the legacy path only after two weeks at zero mismatches.",
        ),
        (
            "assistant",
            "A product manager wants to launch a bulk export quickly, while you are concerned about cost and reliability. "
            "How would you frame the decision?",
        ),
        (
            "user",
            "I would start with the user outcome: how much data customers need, how often, and how quickly the file must arrive. "
            "Then I would present two concrete options with cost, delivery time, and failure behavior rather than saying the request is too risky. "
            "My likely first release would create an asynchronous export job, cap the date range, notify the user when it is ready, and measure "
            "completion time, failure rate, and repeat usage. That is a reversible step that serves the immediate need without tying up web workers. "
            "If evidence shows demand for larger exports, we can invest in partitioned generation and dedicated storage. I would document the limits "
            "in the UI and agree on the metric that triggers the next investment.",
        ),
    ]


def _evaluation_draft(turn_ids: dict[int, str]) -> EvaluationDraft:
    return EvaluationDraft(
        competency_results=[
            CompetencyEvaluation(
                competency_id="system-design",
                assessment="scored",
                score=4,
                rating_confidence="high",
                evidence=[
                    EvidenceCitation(
                        turn_id=turn_ids[2],
                        quote="I separated synchronous order validation from asynchronous fulfillment using a durable queue",
                    )
                ],
                evidence_summary="Maya defined service boundaries, capacity inputs, scaling signals, and the consistency trade-off.",
                gaps=[
                    "The answer did not quantify storage growth or multi-region recovery time."
                ],
                recommendations=[
                    "Practice adding explicit capacity estimates and recovery objectives to the design."
                ],
            ),
            CompetencyEvaluation(
                competency_id="backend-engineering",
                assessment="scored",
                score=4,
                rating_confidence="high",
                evidence=[
                    EvidenceCitation(
                        turn_id=turn_ids[4],
                        quote="If the same key arrives with a different payload, the API returns a conflict instead of silently reusing the first result.",
                    )
                ],
                evidence_summary="The response gave a precise idempotency contract and covered duplicate delivery downstream.",
                gaps=[],
                recommendations=[
                    "Extend the explanation with expiry and storage policies for idempotency records."
                ],
            ),
            CompetencyEvaluation(
                competency_id="data-consistency",
                assessment="scored",
                score=3,
                rating_confidence="medium",
                evidence=[
                    EvidenceCitation(
                        turn_id=turn_ids[4],
                        quote="The API would insert the key, request hash, and result reference in the same database transaction as the order.",
                    )
                ],
                evidence_summary="The answer protected the core invariant with a transaction, unique constraint, and outbox.",
                gaps=[
                    "It did not discuss transaction isolation or online schema evolution."
                ],
                recommendations=[
                    "Practice a follow-up involving isolation levels and a zero-downtime schema change."
                ],
            ),
            CompetencyEvaluation(
                competency_id="reliability",
                assessment="scored",
                score=4,
                rating_confidence="high",
                evidence=[
                    EvidenceCitation(
                        turn_id=turn_ids[6],
                        quote="Afterward I added an SLO for end-to-end processing delay, a load test with the real lease duration, and an alert on redelivery ratio.",
                    )
                ],
                evidence_summary="Maya connected symptoms to a causal mechanism, mitigated safely, and added durable detection and prevention.",
                gaps=[],
                recommendations=[
                    "Add how incident roles and customer communication were handled during mitigation."
                ],
            ),
            CompetencyEvaluation(
                competency_id="security",
                assessment="scored",
                score=3,
                rating_confidence="medium",
                evidence=[
                    EvidenceCitation(
                        turn_id=turn_ids[8],
                        quote="For testing, I use negative integration cases that create records for two tenants and attempt cross-tenant reads, updates, exports, and guessed identifiers.",
                    )
                ],
                evidence_summary="The response separated authentication from authorization and included concrete tenant-isolation tests.",
                gaps=[
                    "Database-level containment and credential lifecycle controls remained exploratory."
                ],
                recommendations=[
                    "Prepare a layered threat model covering application, database, jobs, caches, and audit access."
                ],
            ),
            CompetencyEvaluation(
                competency_id="technical-leadership",
                assessment="scored",
                score=4,
                rating_confidence="high",
                evidence=[
                    EvidenceCitation(
                        turn_id=turn_ids[10],
                        quote="I wrote a short decision record, named an owner in each team, and proposed a dual-read, dual-write sequence with measurable exit criteria.",
                    )
                ],
                evidence_summary="Maya demonstrated cross-team planning, explicit ownership, compatibility support, and evidence-based rollout gates.",
                gaps=[],
                recommendations=[
                    "Include one example of coaching an individual through the migration, not only coordinating teams."
                ],
            ),
            CompetencyEvaluation(
                competency_id="product-communication",
                assessment="scored",
                score=4,
                rating_confidence="high",
                evidence=[
                    EvidenceCitation(
                        turn_id=turn_ids[12],
                        quote="Then I would present two concrete options with cost, delivery time, and failure behavior rather than saying the request is too risky.",
                    )
                ],
                evidence_summary="The answer reframed technical concern around customer outcomes, options, measurable limits, and a reversible first step.",
                gaps=[],
                recommendations=[
                    "State the initial product limit numerically to make the launch recommendation even more actionable."
                ],
            ),
        ],
        strength_competency_ids=[
            "system-design",
            "reliability",
            "technical-leadership",
        ],
        gap_competency_ids=["data-consistency", "security"],
        practice_exercises=[
            PracticeExercise(
                title="Defend a zero-downtime data migration",
                competency_ids=["data-consistency", "technical-leadership"],
                instruction="Explain an expand-migrate-contract rollout, including isolation, backfill safety, rollback, and ownership across teams.",
                success_criteria=[
                    "Name the invariant and transaction boundary.",
                    "Define measurable rollout and rollback gates.",
                    "Cover mixed-version behavior during the migration.",
                ],
            ),
            PracticeExercise(
                title="Layer tenant-isolation controls",
                competency_ids=["security"],
                instruction="Threat-model a multi-tenant export flow from request authorization through jobs, storage, and download.",
                success_criteria=[
                    "Identify at least three cross-tenant failure paths.",
                    "Give a preventive control and a negative test for each path.",
                    "Explain what is audited and who may read the audit trail.",
                ],
            ),
        ],
    )


def _build_records(user: User) -> list[object]:
    now = datetime.now(UTC)
    created_at = now - timedelta(days=1, minutes=40)
    started_at = created_at + timedelta(minutes=5)
    ended_at = started_at + timedelta(minutes=30)
    completed_at = ended_at + timedelta(seconds=45)

    upload_id = _id(user.id, "upload")
    profile_id = _id(user.id, "profile")
    target_id = _id(user.id, "target")
    scorecard_id = _id(user.id, "scorecard")
    interview_id = _id(user.id, "interview")

    resume_text = (
        "Maya Chen — fictional candidate. Senior backend engineer with eight years of experience. "
        "Led an order-ingestion redesign processing 18 million events per day; built idempotent APIs "
        "with PostgreSQL and an outbox; improved end-to-end reliability through SLOs, load tests, and "
        "incident runbooks; coordinated a six-service identifier migration."
    )
    upload = Upload(
        id=upload_id,
        user_id=user.id,
        generated_storage_key=f"worked-example/{upload_id}",
        original_filename="maya-chen-synthetic-resume.docx",
        file_type="docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size=len(resume_text.encode()),
        sha256=hashlib.sha256(resume_text.encode()).hexdigest(),
        extracted_text=resume_text,
        source_segments=[{"label": "Synthetic résumé", "text": resume_text}],
        retention_expires_at=created_at + timedelta(days=30),
        raw_deleted_at=created_at,
        created_at=created_at,
    )
    resume_source = _source(upload_id, "Synthetic résumé", resume_text)
    profile = CandidateProfile(
        id=profile_id,
        user_id=user.id,
        source_resume_id=upload_id,
        structured_claims={
            "headline": "Senior backend engineer focused on reliable, high-volume platforms",
            "claims": [
                {
                    "id": "profile-summary",
                    "category": "summary",
                    "text": "Eight years building and operating backend platforms for commerce products.",
                    "source": resume_source,
                    "edited": False,
                    "original_text": None,
                },
                {
                    "id": "profile-scale",
                    "category": "experience",
                    "text": "Led an order-ingestion redesign processing 18 million events per day.",
                    "source": resume_source,
                    "edited": False,
                    "original_text": None,
                },
                {
                    "id": "profile-api",
                    "category": "skill",
                    "text": "Designed idempotent APIs using PostgreSQL transactions and an outbox.",
                    "source": resume_source,
                    "edited": False,
                    "original_text": None,
                },
                {
                    "id": "profile-reliability",
                    "category": "experience",
                    "text": "Introduced service-level objectives, load tests, alerts, and incident runbooks.",
                    "source": resume_source,
                    "edited": False,
                    "original_text": None,
                },
                {
                    "id": "profile-leadership",
                    "category": "experience",
                    "text": "Coordinated an identifier migration across six services and their owning teams.",
                    "source": resume_source,
                    "edited": False,
                    "original_text": None,
                },
            ],
            "extractor_version": WORKED_EXAMPLE_VERSION,
        },
        version=1,
        created_at=created_at,
        updated_at=created_at,
    )

    role_description = (
        "We are hiring a Senior Backend Engineer to design scalable APIs and data models, "
        "operate reliable distributed services, protect multi-tenant data, lead cross-team "
        "technical changes, and communicate engineering trade-offs in terms of customer outcomes."
    )
    competencies = _scorecard_competencies(target_id)
    target = JobTarget(
        id=target_id,
        user_id=user.id,
        title="Senior Backend Engineer",
        seniority="senior",
        raw_description=role_description,
        structured_requirements=[
            {
                "id": f"{target_id}:{item['id']}",
                "name": item["name"],
                "classification": item["classification"],
                "source": _source(
                    target_id, "Synthetic job description", role_description
                ),
            }
            for item in competencies
        ],
        created_at=created_at,
        updated_at=created_at,
    )
    scorecard = Scorecard(
        id=scorecard_id,
        job_target_id=target_id,
        version=1,
        competencies=competencies,
        total_weight=100,
        created_at=created_at,
        updated_at=created_at,
    )
    interview = InterviewSession(
        id=interview_id,
        user_id=user.id,
        title=WORKED_EXAMPLE_TITLE,
        status="REPORT_READY",
        profile_id=profile_id,
        scorecard_id=scorecard_id,
        duration_minutes=30,
        interview_type="technical_behavioral",
        input_mode="voice",
        started_at=started_at,
        ended_at=ended_at,
        last_connected_at=ended_at,
        prompt_version=INTERVIEW_PROMPT_VERSION,
        created_at=created_at,
        updated_at=completed_at,
    )
    interview.setup_snapshot = build_setup_snapshot(
        interview, profile, scorecard, target
    )
    interview.setup_fingerprint = setup_fingerprint(interview.setup_snapshot)

    turns: list[InterviewTurn] = []
    turn_ids: dict[int, str] = {}
    for sequence, (speaker, transcript) in enumerate(_transcript(), start=1):
        turn_id = _id(user.id, f"turn-{sequence}")
        turn_ids[sequence] = turn_id
        turn_started = started_at + timedelta(minutes=(sequence - 1) * 2)
        turn_ended = turn_started + timedelta(
            seconds=40 if speaker == "assistant" else 95
        )
        turns.append(
            InterviewTurn(
                id=turn_id,
                session_id=interview_id,
                client_turn_id=f"worked-example-turn-{sequence:02d}",
                sequence=sequence,
                speaker=speaker,
                transcript=transcript,
                transcription_source=(
                    "assistant" if speaker == "assistant" else "final_model"
                ),
                transcription_model=(
                    None if speaker == "assistant" else WORKED_EXAMPLE_VERSION
                ),
                transcription_finalized_at=(
                    None if speaker == "assistant" else turn_ended
                ),
                delivery_status="acknowledged",
                started_at=turn_started,
                ended_at=turn_ended,
                created_at=turn_ended,
            )
        )

    scorecard_document = ScorecardDocument.model_validate(
        {"competencies": competencies, "generator_version": WORKED_EXAMPLE_VERSION}
    )
    evaluation_turns = [
        EvaluationTranscriptTurn(
            id=turn.id,
            sequence=turn.sequence,
            speaker=turn.speaker,
            transcript=turn.transcript,
            delivery_status=turn.delivery_status,
        )
        for turn in turns
    ]
    report = validate_and_score_evaluation(
        _evaluation_draft(turn_ids),
        scorecard_document,
        evaluation_turns,
        evaluator_version=WORKED_EXAMPLE_VERSION,
    )
    evaluation = Evaluation(
        id=_id(user.id, "evaluation"),
        session_id=interview_id,
        status="REPORT_READY",
        schema_version=EVALUATION_SCHEMA_VERSION,
        evaluator_version=report.evaluator_version,
        prompt_version=INTERVIEW_PROMPT_VERSION,
        model_deployment="synthetic-fixture",
        setup_fingerprint=interview.setup_fingerprint,
        transcript_fingerprint=transcript_fingerprint(turns),
        transcript_turn_count=len(turns),
        transcript_finalized_at=ended_at,
        scorecard_snapshot=scorecard_document.model_dump(mode="json"),
        attempt_count=report.validation_attempts,
        run_token=None,
        started_at=ended_at,
        competency_results=[
            item.model_dump(mode="json") for item in report.competency_results
        ],
        overall_result={
            "score": report.overall_score,
            "assessed_weight": report.assessed_weight,
            "total_weight": report.total_weight,
            "coverage_percentage": report.coverage_percentage,
            "evidence_locations": [
                item.model_dump(mode="json") for item in report.evidence_locations
            ],
        },
        strengths=report.strength_competency_ids,
        gaps=report.gap_competency_ids,
        practice_exercises=[
            item.model_dump(mode="json") for item in report.practice_exercises
        ],
        uncertainty=[],
        completed_at=completed_at,
        created_at=ended_at,
        updated_at=completed_at,
    )
    marker = UsageEvent(
        id=_id(user.id, "seed-marker"),
        user_id=user.id,
        session_id=interview_id,
        kind=WORKED_EXAMPLE_EVENT,
        quantity=1,
        estimated_cost_microusd=0,
        created_at=now,
    )
    return [upload, profile, target, scorecard, interview, *turns, evaluation, marker]


async def ensure_guest_worked_example(database: AsyncSession, user: User) -> bool:
    """Seed the example once; return whether this request created it."""

    existing = await database.scalar(
        select(UsageEvent.id).where(
            UsageEvent.user_id == user.id,
            UsageEvent.kind == WORKED_EXAMPLE_EVENT,
        )
    )
    if existing is not None:
        return False

    database.add_all(_build_records(user))
    try:
        await database.commit()
        return True
    except IntegrityError:
        # Deterministic IDs make concurrent sign-ins converge on the same
        # fixture. If another request committed first, its marker proves the
        # complete transaction won and this request can safely continue.
        await database.rollback()
        existing = await database.scalar(
            select(UsageEvent.id).where(
                UsageEvent.user_id == user.id,
                UsageEvent.kind == WORKED_EXAMPLE_EVENT,
            )
        )
        if existing is not None:
            return False
        raise
