from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.core import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login/oauth")

CredentialsError = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        payload = decode_token(token)
    except Exception:
        raise CredentialsError from None
    if payload.get("type") != "access":
        raise CredentialsError
    user_id = payload.get("sub")
    if not user_id:
        raise CredentialsError
    user = db.scalar(select(User).where(User.id == int(user_id)))
    if not user or not user.is_active:
        raise CredentialsError
    return user


async def get_current_active_superuser(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


def require_permission(*codes: str):
    """Dependency factory enforcing that the user has any of the given permission codes."""

    async def _checker(
        user: Annotated[User, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User:
        if user.is_superuser:
            return user
        from app.services.auth_service import user_has_permission

        if user_has_permission(db, user, set(codes)):
            return user
        raise HTTPException(status_code=403, detail="Missing permission(s): " + ", ".join(codes))

    return _checker
