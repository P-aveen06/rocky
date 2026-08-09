from __future__ import annotations

import pytest

from prompts.interview_v1 import _section_plan, build_time_cues


@pytest.mark.parametrize(
    ("duration_minutes", "expected_sections"),
    [
        (2, ["Focused evidence probe", "Role-fit follow-up"]),
        (
            5,
            [
                "Introduction",
                "Focused evidence probe",
                "Role-fit follow-up",
                "Wrap-up",
            ],
        ),
    ],
)
def test_quick_interview_section_plans_fit_the_selected_duration(
    duration_minutes: int, expected_sections: list[str]
) -> None:
    plan = _section_plan(duration_minutes)

    assert [item["section"] for item in plan] == expected_sections
    assert sum(int(item["minutes"]) for item in plan) == duration_minutes


@pytest.mark.parametrize("duration_minutes", [2, 5, 15, 30, 45, 60])
def test_every_duration_gets_a_wrap_up_cue_inside_its_own_budget(
    duration_minutes: int,
) -> None:
    cues = build_time_cues(duration_minutes)
    total = duration_minutes * 60

    assert cues
    thresholds = [int(cue["at_seconds_remaining"]) for cue in cues]
    assert thresholds == sorted(thresholds, reverse=True)
    assert len(thresholds) == len(set(thresholds))
    assert all(0 < value < total for value in thresholds)
    # The last cue is the wrap-up, and short sessions must still get 20-30s of
    # warning rather than a proportional sliver.
    assert 20 <= thresholds[-1] <= 60
    assert "Wrap up now" in str(cues[-1]["text"])
    assert all(str(cue["text"]).startswith("TIME_REMAINING:") for cue in cues)


def test_quick_practice_is_not_told_about_half_time() -> None:
    """A 2-minute session has no room for mid-session repositioning."""

    texts = " ".join(str(cue["text"]) for cue in build_time_cues(2))

    assert "half the session" not in texts
    assert "half the session" in " ".join(
        str(cue["text"]) for cue in build_time_cues(30)
    )
