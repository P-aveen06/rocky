"""Public M5 consent and observable speaking-delivery contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from domain.delivery import DeliveryBaseline, DeliveryObservation, DeliveryTurnMetric


class DeliveryConsentRequest(BaseModel):
    enabled: bool
    consent_version: Literal["delivery-v1"]


class VideoConsentRequest(BaseModel):
    """Separate from speaking-delivery consent, and separately revocable."""

    enabled: bool
    consent_version: Literal["video-delivery-v1"]


class VideoDeliverySummaryRequest(BaseModel):
    """Aggregates computed in the browser. No frame is ever uploaded.

    Bounded on every field so a tampered client cannot store arbitrary values,
    and so the numbers rendered back to the candidate are always sensible.
    """

    sample_count: int = Field(ge=0, le=200_000)
    duration_ms: int = Field(ge=0, le=24 * 60 * 60 * 1000)
    face_present_ratio: float = Field(ge=0, le=1)
    facing_camera_ratio: float = Field(ge=0, le=1)
    steadiness_score: float = Field(ge=0, le=1)
    off_frame_episodes: int = Field(ge=0, le=10_000)
    longest_off_frame_ms: int = Field(ge=0, le=24 * 60 * 60 * 1000)


class SpeechSegment(BaseModel):
    started_at: datetime
    ended_at: datetime

    @model_validator(mode="after")
    def positive_duration(self) -> SpeechSegment:
        if self.ended_at <= self.started_at:
            raise ValueError("Speech segment end must follow its start.")
        return self


class DeliveryTurnObservation(BaseModel):
    turn_id: str = Field(min_length=1, max_length=96)
    speech_segments: list[SpeechSegment] = Field(min_length=1, max_length=500)


class DeliveryObservationBatchRequest(BaseModel):
    items: list[DeliveryTurnObservation] = Field(min_length=1, max_length=40)


class DeliveryCoachingResponse(BaseModel):
    interview_id: str
    status: Literal["available", "collecting", "unavailable", "disabled", "deleted"]
    consented: bool
    consent_version: str | None
    unavailable_reason: (
        Literal["consent_required", "text_input_mode", "no_observations"] | None
    )
    baseline: DeliveryBaseline | None
    metrics: list[DeliveryTurnMetric]
    observations: list[DeliveryObservation]
    suggestions: list[str]
    video_consented: bool = False
    video_consent_version: str | None = None
    # Numbers only. The client turns these into wording, so the phrasing lives
    # in one place rather than being duplicated on both sides.
    video_summary: VideoDeliverySummaryRequest | None = None
