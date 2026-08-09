"""Clerk session identity extraction and local-development identity support."""

from __future__ import annotations

import base64
import hashlib
import logging
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Annotated

import certifi
import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .config import Settings
from .database import get_database_session
from .models import DeletionReceipt, User

logger = logging.getLogger(__name__)

# Clerk signs session tokens with RS256. Anything else is a forgery attempt or a
# misconfiguration, so the allow-list stays closed.
_CLERK_ALGORITHMS = ("RS256",)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    subject: str
    email: str
    display_name: str


def clerk_frontend_api_origin(settings: Settings) -> str:
    """Resolve Clerk's Frontend API origin, which is also the token issuer.

    An explicit ``CLERK_FRONTEND_API_URL`` wins. Otherwise it is recovered from
    the publishable key, which is ``pk_(test|live)_`` followed by the
    base64-encoded origin with a trailing ``$``.
    """

    explicit = (settings.clerk_frontend_api_url or "").strip().rstrip("/")
    if explicit:
        return explicit

    key = (settings.clerk_publishable_key or "").strip()
    _, _, encoded = key.partition("_")
    _, _, encoded = encoded.partition("_")
    if encoded:
        try:
            padding = "=" * (-len(encoded) % 4)
            decoded = base64.b64decode(encoded + padding).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            decoded = ""
        host = decoded.rstrip("$").strip()
        if host:
            return f"https://{host}"

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=(
            "Clerk is misconfigured: set CLERK_FRONTEND_API_URL or a valid "
            "CLERK_PUBLISHABLE_KEY."
        ),
    )


@lru_cache(maxsize=8)
def _jwks_client(jwks_url: str) -> PyJWKClient:
    # PyJWKClient caches fetched keys in-process, so the network hop happens
    # only on a cache miss. Setting CLERK_JWT_KEY avoids it entirely.
    #
    # It fetches over urllib, whose default SSL context trusts whatever the
    # interpreter was built against. A python.org macOS build ships no roots
    # until `Install Certificates.command` is run, so the fetch dies with
    # "unable to get local issuer certificate". Handing it certifi makes
    # verification identical on every machine and in the deployed container.
    return PyJWKClient(
        jwks_url,
        cache_keys=True,
        ssl_context=ssl.create_default_context(cafile=certifi.where()),
    )


def _signing_key(token: str, settings: Settings) -> str:
    pem = (settings.clerk_jwt_key or "").strip()
    if pem:
        return pem.replace("\\n", "\n")
    issuer = clerk_frontend_api_origin(settings)
    return (
        _jwks_client(f"{issuer}/.well-known/jwks.json")
        .get_signing_key_from_jwt(token)
        .key
    )


def _bearer_token(request: Request) -> str | None:
    """Read the session token from the Authorization header.

    Deliberately header-only. Clerk's SDK also drops a ``__session`` cookie on
    the origin, but its contents are not always a JWT, and reading it produced
    spurious 401s with "Invalid header string" whenever a request raced ahead of
    the client attaching its bearer token. The React client always sends the
    header, so the cookie adds failure modes and no capability.
    """

    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() == "bearer" and token.strip():
        return token.strip()
    return None


def _clerk_principal(request: Request, settings: Settings) -> AuthenticatedPrincipal:
    token = _bearer_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in is required.",
        )

    issuer = clerk_frontend_api_origin(settings)
    try:
        claims = jwt.decode(
            token,
            _signing_key(token, settings),
            algorithms=list(_CLERK_ALGORITHMS),
            issuer=issuer,
            # Clerk does not set `aud` on the default session token.
            options={"verify_aud": False, "require": ["exp", "sub"]},
            leeway=5,
        )
    except jwt.PyJWTError as exc:
        logger.warning("invalid_clerk_session_token", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The session was invalid or has expired.",
        ) from exc

    authorized_parties = settings.clerk_authorized_party_list
    azp = claims.get("azp")
    if authorized_parties and azp not in authorized_parties:
        logger.warning("clerk_authorized_party_rejected", extra={"azp": azp})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The session was issued for a different application.",
        )

    subject = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip()
    display_name = str(claims.get("name") or "").strip() or email
    if not subject or not email:
        # Clerk's default session token carries neither claim. They are added in
        # the dashboard under Sessions -> Customize session token:
        #   {"email": "{{user.primary_email_address}}", "name": "{{user.full_name}}"}
        logger.error("clerk_session_token_missing_claims")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "The session token did not contain a subject and email. Add "
                "email and name claims to the Clerk session token."
            ),
        )
    return AuthenticatedPrincipal(subject, email, display_name)


GUEST_ISSUER = "interview-coach-guest"
GUEST_SUBJECT_PREFIX = "guest:"
_GUEST_ALGORITHM = "HS256"


def guest_subject(email: str) -> str:
    """Derive a stable identity from the email a guest gave.

    Deterministic so that returning with the same address lands back in the
    same sessions. Hashed so the raw address is not the primary key, and
    prefixed so guests are always distinguishable from signed-up accounts.
    """

    digest = hashlib.sha256(email.strip().casefold().encode()).hexdigest()
    return f"{GUEST_SUBJECT_PREFIX}{digest[:32]}"


def issue_guest_token(
    settings: Settings, *, email: str, display_name: str
) -> tuple[str, datetime]:
    """Mint a signed guest session token and return it with its expiry."""

    secret = (
        settings.guest_token_secret.get_secret_value()
        if settings.guest_token_secret
        else ""
    )
    if not settings.guest_token_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Guest access is not configured.",
        )
    expires_at = datetime.now(UTC) + timedelta(days=settings.guest_token_ttl_days)
    token = jwt.encode(
        {
            "iss": GUEST_ISSUER,
            "sub": guest_subject(email),
            "email": email,
            "name": display_name,
            "iat": int(datetime.now(UTC).timestamp()),
            "exp": int(expires_at.timestamp()),
        },
        secret,
        algorithm=_GUEST_ALGORITHM,
    )
    return token, expires_at


def _guest_principal(token: str, settings: Settings) -> AuthenticatedPrincipal:
    if not settings.allow_guest_access or not settings.guest_token_configured:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Guest access is not available.",
        )
    secret = settings.guest_token_secret.get_secret_value()  # type: ignore[union-attr]
    try:
        claims = jwt.decode(
            token,
            secret,
            # Pinned: without this a token could name its own algorithm and a
            # forged RS256 token would be checked against the wrong key.
            algorithms=[_GUEST_ALGORITHM],
            issuer=GUEST_ISSUER,
            options={"verify_aud": False, "require": ["exp", "sub"]},
            leeway=5,
        )
    except jwt.PyJWTError as exc:
        logger.warning("invalid_guest_token", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This guest session has expired. Start a new one.",
        ) from exc

    subject = str(claims.get("sub") or "")
    email = str(claims.get("email") or "").strip()
    name = str(claims.get("name") or "").strip() or email
    if not subject.startswith(GUEST_SUBJECT_PREFIX) or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The guest session was malformed.",
        )
    return AuthenticatedPrincipal(subject, email, name)


def principal_from_request(
    request: Request, settings: Settings
) -> AuthenticatedPrincipal:
    # Checked before the local fallback on purpose. A guest token is an
    # explicit identity someone just presented, so it has to outrank the
    # single developer identity that local mode assumes; otherwise a guest
    # signs in and silently lands in somebody else's workspace.
    token = _bearer_token(request)
    if token and settings.allow_guest_access:
        # Guest tokens are symmetric, Clerk's are RS256. Reading the declared
        # algorithm only picks the verification path; each path then verifies
        # the signature properly against its own key.
        try:
            declared = jwt.get_unverified_header(token).get("alg")
        except jwt.PyJWTError:
            declared = None
        if declared == _GUEST_ALGORITHM:
            return _guest_principal(token, settings)
    if settings.auth_mode == "local":
        return AuthenticatedPrincipal(
            subject=settings.local_auth_subject,
            email=settings.local_auth_email,
            display_name=settings.local_auth_name,
        )
    return _clerk_principal(request, settings)


async def get_current_user(
    request: Request,
    database: Annotated[AsyncSession, Depends(get_database_session)],
) -> User:
    settings: Settings = request.app.state.settings
    return await resolve_user(database, principal_from_request(request, settings))


async def resolve_user(
    database: AsyncSession, principal: AuthenticatedPrincipal
) -> User:
    """Find or create the account for an already-verified identity.

    Separate from the request dependency so that guest sign-in, which has just
    minted the identity itself, can reuse it without having to fabricate a
    request to read the token back out of.
    """

    principal_hash = hashlib.sha256(
        f"principal:{principal.subject}".encode()
    ).hexdigest()
    deleted = await database.scalar(
        select(DeletionReceipt.id).where(
            DeletionReceipt.kind == "account",
            DeletionReceipt.target_hash == principal_hash,
        )
    )
    if deleted is not None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This account and its retained data were deleted.",
        )
    user = await database.scalar(
        select(User).where(User.auth_subject == principal.subject)
    )
    if user is None:
        user = User(
            auth_subject=principal.subject,
            email=principal.email,
            display_name=principal.display_name,
        )
        database.add(user)
        try:
            await database.commit()
        except IntegrityError:
            # Concurrent first requests for the same new subject both miss the
            # select above and both insert. The client opens with two parallel
            # calls, so this is the normal path on a first sign-in, not an
            # error: take the row the other request committed.
            await database.rollback()
            user = await database.scalar(
                select(User).where(User.auth_subject == principal.subject)
            )
            if user is None:
                raise
        else:
            await database.refresh(user)
    elif user.email != principal.email or user.display_name != principal.display_name:
        user.email = principal.email
        user.display_name = principal.display_name
        await database.commit()
    # Otherwise nothing changed, so no write. This dependency runs on every
    # authenticated request, and committing plus refreshing unconditionally cost
    # two database round trips each time for a row that almost never changes.
    return user
