"""The Content-Security-Policy has to allow exactly what the pages actually load.

The landing page embeds the product walkthrough from YouTube's no-cookie host
and uses YouTube's thumbnail CDN for the poster frame. Production also runs
Clerk, whose bot-protection widget is a Cloudflare Turnstile iframe. Those two
needs met in `frame-src`, and an assignment there once dropped the player's
origin, so the deployed demo section rendered a blocked box. These tests pin
both directives in both auth modes.
"""

from __future__ import annotations

from api.config import Settings
from api.main import content_security_policy

YOUTUBE_EMBED = "https://www.youtube-nocookie.com"
YOUTUBE_THUMBNAILS = "https://i.ytimg.com"
TURNSTILE = "https://challenges.cloudflare.com"


def _directive(policy: str, name: str) -> str:
    for part in policy.split(";"):
        part = part.strip()
        if part.startswith(f"{name} "):
            return part
    raise AssertionError(f"{name} missing from policy: {policy}")


def _local_settings() -> Settings:
    return Settings(_env_file=None, app_env="test", auth_mode="local")


def _clerk_settings() -> Settings:
    return Settings(
        _env_file=None,
        app_env="test",
        auth_mode="clerk",
        clerk_secret_key="sk_test_example",
        clerk_publishable_key="pk_test_example",
    )


def test_demo_player_is_frameable_without_clerk() -> None:
    frame_src = _directive(content_security_policy(_local_settings()), "frame-src")
    assert YOUTUBE_EMBED in frame_src
    assert "'none'" not in frame_src


def test_demo_player_is_frameable_with_clerk() -> None:
    """Regression: the Clerk branch assigned frame-src instead of appending."""
    frame_src = _directive(content_security_policy(_clerk_settings()), "frame-src")
    assert YOUTUBE_EMBED in frame_src, "Clerk must not evict the demo player"
    assert TURNSTILE in frame_src, "Clerk bot protection still needs its iframe"


def test_video_poster_image_is_loadable_in_both_modes() -> None:
    for settings in (_local_settings(), _clerk_settings()):
        img_src = _directive(content_security_policy(settings), "img-src")
        assert YOUTUBE_THUMBNAILS in img_src


def test_policy_stays_locked_down_elsewhere() -> None:
    """Widening frame-src must not quietly widen anything else."""
    policy = content_security_policy(_local_settings())
    assert _directive(policy, "object-src") == "object-src 'none'"
    assert _directive(policy, "frame-ancestors") == "frame-ancestors 'none'"
    assert _directive(policy, "base-uri") == "base-uri 'self'"
    assert _directive(policy, "form-action") == "form-action 'self'"
    assert "'unsafe-eval'" not in policy
    assert "'unsafe-inline'" not in _directive(policy, "script-src")
