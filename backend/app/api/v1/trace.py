from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.core import User
from app.schemas.trace import TraceResultListOut, TraceResultOut
from app.services import trace_service

router = APIRouter(prefix="/network/trace", tags=["network-trace"])


@router.get("/customer/{customer_id}", response_model=TraceResultOut)
async def trace_customer(
    customer_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("network:trace:read"))] = None,
):
    result = trace_service.trace_customer_to_olt(db, customer_id)
    return {
        "direction": result.direction,
        "nodes": [n.__dict__ for n in result.nodes],
        "found": result.found,
        "error": result.error,
    }


@router.get("/olt/{olt_asset_id}", response_model=TraceResultListOut)
async def trace_olt(
    olt_asset_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("network:trace:read"))] = None,
):
    results = trace_service.trace_olt_to_customers(db, olt_asset_id)
    return {
        "results": [
            {
                "direction": r.direction,
                "nodes": [n.__dict__ for n in r.nodes],
                "found": r.found,
                "error": r.error,
            }
            for r in results
        ]
    }


@router.get("/core/{core_id}", response_model=TraceResultOut)
async def trace_core(
    core_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("network:trace:read"))] = None,
):
    result = trace_service.trace_core(db, core_id)
    return {
        "direction": result.direction,
        "nodes": [n.__dict__ for n in result.nodes],
        "found": result.found,
        "error": result.error,
    }
