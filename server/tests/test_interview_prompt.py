from __future__ import annotations

import pytest

from prompts.interview_v1 import _section_plan


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
