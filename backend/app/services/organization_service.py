
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.models.core import Organization


def list_organizations(
    db: Session, *, search: str | None = None, offset: int = 0, limit: int = 20
) -> tuple[list[Organization], int]:
    stmt = select(Organization)
    count_stmt = select(func.count(Organization.id))
    if search:
        like = f"%{search}%"
        cond = Organization.name.ilike(like) | Organization.code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    return list(rows), total


def get_organization(db: Session, org_id: int) -> Organization | None:
    return db.get(Organization, org_id)


def create_organization(db: Session, payload: dict, *, user_id: int | None = None) -> Organization:
    org = Organization(**payload)
    db.add(org)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="organization.create",
        entity_type="organization",
        entity_id=str(org.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(org)
    return org


def update_organization(
    db: Session, org: Organization, payload: dict, *, user_id: int | None = None
) -> Organization:
    previous = {c: getattr(org, c) for c in payload}
    for k, v in payload.items():
        setattr(org, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="organization.update",
        entity_type="organization",
        entity_id=str(org.id),
        previous_value=previous,
        new_value=payload,
    )
    db.commit()
    db.refresh(org)
    return org


def delete_organization(db: Session, org: Organization, *, user_id: int | None = None) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="organization.delete",
        entity_type="organization",
        entity_id=str(org.id),
        previous_value={"name": org.name, "id": org.id},
    )
    db.delete(org)
    db.commit()
