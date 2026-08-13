from datetime import datetime
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BaseModel, ConfigDict


def _validate_email(value: str) -> str:
    try:
        return validate_email(value, check_deliverability=False).normalized
    except EmailNotValidError as exc:
        raise ValueError(str(exc)) from exc


Email = Annotated[str, AfterValidator(_validate_email)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampedOut(ORMModel):
    created_at: datetime
    updated_at: datetime
