from __future__ import annotations

from app.schemas.base import ORMModel


class TraceNodeOut(ORMModel):
    kind: str
    id: int
    label: str
    detail: dict | None = None


class TraceResultOut(ORMModel):
    direction: str
    nodes: list[TraceNodeOut]
    found: bool = False
    error: str | None = None


class TraceResultListOut(ORMModel):
    results: list[TraceResultOut]
