from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings


def check_db(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def check_redis() -> bool:
    try:
        import redis

        r = redis.from_url(settings.redis_url, socket_connect_timeout=2)
        return r.ping()
    except Exception:
        return False


def postgis_ready(db: Session) -> bool:
    try:
        row = db.execute(text("SELECT postgis_full_version()")).scalar()
        return bool(row)
    except Exception:
        return False
