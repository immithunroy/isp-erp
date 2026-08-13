from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_password,
)
from app.models.core import RefreshToken, User

ACCESS_TTL = settings.access_ttl_seconds
REFRESH_TTL = settings.refresh_ttl_seconds


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(last_login_at=datetime.now(UTC), failed_login_count=0)
    )
    db.flush()
    return user


def issue_tokens(
    user: User,
    db: Session,
    *,
    user_agent: str | None = None,
    ip: str | None = None,
) -> dict:
    access, _ = create_access_token(subject=user.id)
    raw_refresh, refresh_hash, ttl = create_refresh_token(subject=user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(UTC) + timedelta(seconds=ttl),
            user_agent=user_agent,
            ip=ip,
        )
    )
    db.commit()
    return {
        "access_token": access,
        "refresh_token": raw_refresh,
        "token_type": "Bearer",
        "expires_in": ACCESS_TTL,
    }


def rotate_refresh_token(
    db: Session,
    raw_refresh: str,
    *,
    user_agent: str | None = None,
    ip: str | None = None,
) -> dict | None:
    try:
        payload = decode_token(raw_refresh)
    except Exception:
        return None
    if payload.get("type") != "refresh":
        return None
    token_hash = hash_token(raw_refresh)
    existing = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if not existing:
        return None
    if existing.revoked_at is not None:
        return None
    expires = existing.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        return None
    new_raw, new_hash, _ = create_refresh_token(subject=payload["sub"])
    existing.revoked_at = datetime.now(UTC)
    new_token = RefreshToken(
        user_id=existing.user_id,
        token_hash=new_hash,
        expires_at=datetime.now(UTC) + timedelta(seconds=REFRESH_TTL),
        replaced_by_id=None,  # updated after flush
        user_agent=user_agent,
        ip=ip,
    )
    db.add(new_token)
    db.flush()

    user = db.get(User, existing.user_id)
    if not user or not user.is_active:
        return None
    access, _ = create_access_token(subject=user.id)
    db.commit()
    return {
        "access_token": access,
        "refresh_token": new_raw,
        "token_type": "Bearer",
        "expires_in": ACCESS_TTL,
    }


def revoke_refresh_token(db: Session, raw_refresh: str) -> bool:
    try:
        payload = decode_token(raw_refresh)
    except Exception:
        return False
    if payload.get("type") != "refresh":
        return False
    token_hash = hash_token(raw_refresh)
    existing = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if not existing or existing.revoked_at is not None:
        return False
    existing.revoked_at = datetime.now(UTC)
    db.commit()
    return True


def load_user_permissions(db: Session, user: User) -> set[str]:
    codes: set[str] = set()
    for perm in user.permissions:
        codes.add(perm.code)
    for role in user.roles:
        for perm in role.permissions:
            codes.add(perm.code)
    return codes


def user_has_permission(db: Session, user: User, codes: set[str]) -> bool:
    return bool(load_user_permissions(db, user) & codes)
