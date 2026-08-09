"""Current-user and guest sign-in endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import (
    AuthenticatedPrincipal,
    get_current_user,
    guest_subject,
    issue_guest_token,
    resolve_user,
)
from ..config import Settings
from ..database import get_database_session
from ..models import User
from ..schemas import UserResponse

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class GuestSignInRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=160)
    email: EmailStr


class GuestSessionResponse(BaseModel):
    token: str
    expires_at: str
    user: UserResponse


@router.get("/me", response_model=UserResponse)
async def current_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    return user


@router.post("/guest", response_model=GuestSessionResponse)
async def start_guest_session(
    payload: GuestSignInRequest,
    request: Request,
    database: Annotated[AsyncSession, Depends(get_database_session)],
) -> GuestSessionResponse:
    """Start a guest session from a name and email, with no sign-up.

    A guest has the same capabilities as a signed-up account. The identity is
    derived from the email, so returning with the same address reopens the same
    sessions rather than starting over.
    """

    settings: Settings = request.app.state.settings
    if not settings.allow_guest_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest access is not enabled.",
        )
    display_name = payload.full_name.strip()
    if not display_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter the name you would like to be called.",
        )
    email = str(payload.email)
    token, expires_at = issue_guest_token(
        settings, email=email, display_name=display_name
    )
    # Create the account now, so the client's first real request is not also
    # the one racing to insert the row.
    user = await resolve_user(
        database,
        AuthenticatedPrincipal(
            subject=guest_subject(email), email=email, display_name=display_name
        ),
    )
    return GuestSessionResponse(
        token=token,
        expires_at=expires_at.isoformat(),
        user=UserResponse.model_validate(user, from_attributes=True),
    )
