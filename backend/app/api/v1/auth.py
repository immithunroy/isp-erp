from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
    request: Request,
) -> TokenResponse:
    user = auth_service.authenticate(db, payload.email, payload.password)
    if not user:
        raise problem(401, "Unauthorized", "Invalid email or password.")
    ip, ua = _client_info(request)
    tokens = auth_service.issue_tokens(user, db, user_agent=ua, ip=ip)
    return TokenResponse(**tokens)


@router.post("/login/oauth", response_model=TokenResponse, include_in_schema=False)
async def login_oauth(
    db: Annotated[Session, Depends(get_db)],
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> TokenResponse:
    user = auth_service.authenticate(db, form.username, form.password)
    if not user:
        raise problem(401, "Unauthorized", "Invalid email or password.")
    ip, ua = _client_info(request)
    tokens = auth_service.issue_tokens(user, db, user_agent=ua, ip=ip)
    return TokenResponse(**tokens)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
    request: Request,
) -> TokenResponse:
    ip, ua = _client_info(request)
    tokens = auth_service.rotate_refresh_token(db, payload.refresh_token, user_agent=ua, ip=ip)
    if not tokens:
        raise problem(401, "Unauthorized", "Invalid or expired refresh token.")
    return TokenResponse(**tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    auth_service.revoke_refresh_token(db, payload.refresh_token)
    return None


@router.get("/me", response_model=UserOut)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return UserOut.model_validate(current_user, from_attributes=True)
