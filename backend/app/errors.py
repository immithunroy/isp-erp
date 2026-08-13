from typing import Any

from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    type: str
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    errors: list[dict[str, Any]] | None = None


def problem(
    status_code: int,
    title: str,
    detail: str | None = None,
    type_: str = "about:blank",
    errors: list[dict[str, Any]] | None = None,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "type": type_,
            "title": title,
            "status": status_code,
            "detail": detail,
            "errors": errors,
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
    payload = ErrorDetail(
        type=detail.get("type", "about:blank"),
        title=detail.get("title", "Error"),
        status=exc.status_code,
        detail=detail.get("detail") or (exc.detail if isinstance(exc.detail, str) else None),
        instance=str(request.url.path),
        errors=detail.get("errors"),  # type: ignore[arg-type]
    )
    return JSONResponse(status_code=exc.status_code, content=jsonable_encoder(payload))


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    payload = ErrorDetail(
        type="https://errors/validation",
        title="Validation Error",
        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="One or more fields failed validation.",
        instance=str(request.url.path),
        errors=errors,
    )
    return JSONResponse(status_code=422, content=jsonable_encoder(payload))
