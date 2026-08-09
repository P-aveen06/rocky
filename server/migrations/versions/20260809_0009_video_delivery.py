"""Store consent and aggregate signals for on-camera delivery coaching.

Camera consent is kept separate from speaking-delivery consent: agreeing to
have your pace and pauses measured is not the same as agreeing to turn a camera
on, and either can be withdrawn without the other.

Only the aggregate summary is stored. No frame is ever uploaded.

Revision ID: 20260809_0009
Revises: 20260808_0008
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260809_0009"
down_revision: str | None = "20260808_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("delivery_coaching") as batch:
        batch.add_column(
            sa.Column(
                "video_consented",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch.add_column(sa.Column("video_consent_version", sa.String(length=80)))
        batch.add_column(sa.Column("video_consented_at", sa.DateTime(timezone=True)))
        batch.add_column(sa.Column("video_summary", sa.JSON()))


def downgrade() -> None:
    with op.batch_alter_table("delivery_coaching") as batch:
        batch.drop_column("video_summary")
        batch.drop_column("video_consented_at")
        batch.drop_column("video_consent_version")
        batch.drop_column("video_consented")
