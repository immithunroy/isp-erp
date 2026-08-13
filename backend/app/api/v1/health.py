from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.health_svc import check_db, check_redis, postgis_ready
from app.db.session import get_db

router = APIRouter(tags=["health"])


class LiveResponse(BaseModel):
    status: str = "ok"


class ReadyComponent(BaseModel):
    name: str
    status: str  # "ok" | "down"
    detail: str | None = None


class ReadyResponse(BaseModel):
    status: str  # "ok" | "degraded" | "down"
    checks: list[ReadyComponent]


@router.get("/health/live", response_model=LiveResponse)
async def live() -> LiveResponse:
    return LiveResponse(status="ok")


@router.get("/health/ready", response_model=ReadyResponse)
async def ready(db: Annotated[Session, Depends(get_db)]) -> ReadyResponse:
    checks: list[ReadyComponent] = []
    db_ok = check_db(db)
    checks.append(ReadyComponent(name="database", status="ok" if db_ok else "down"))
    redis_ok = check_redis()
    checks.append(ReadyComponent(name="redis", status="ok" if redis_ok else "down"))
    if db_ok:
        pg_ok = postgis_ready(db)
        checks.append(ReadyComponent(name="postgis", status="ok" if pg_ok else "down"))
    else:
        checks.append(ReadyComponent(name="postgis", status="down"))
    overall = "ok" if all(c.status == "ok" for c in checks) else "down"
    return ReadyResponse(status=overall, checks=checks)
