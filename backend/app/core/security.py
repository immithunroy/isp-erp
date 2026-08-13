import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

ALGORITHM = settings.jwt_algorithm


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(subject: str | int, extra: dict[str, Any] | None = None) -> tuple[str, int]:
    now = datetime.now(UTC)
    ttl = settings.access_ttl_seconds
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
        "type": "access",
    }
    if extra:
        payload["extra"] = extra
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, ttl


def create_refresh_token(subject: str | int) -> tuple[str, str, int]:
    """Return (raw_token, token_hash, ttl_seconds)."""
    now = datetime.now(UTC)
    ttl = settings.refresh_ttl_seconds
    payload = {
        "sub": str(subject),
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
        "type": "refresh",
        "jti": hashlib.sha256(f"{subject}{now.isoformat()}".encode()).hexdigest()[:32],
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    token_hash = hash_token(token)
    return token, token_hash, ttl


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
