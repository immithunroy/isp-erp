from collections.abc import Sequence
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(20, ge=1, le=200, description="Items per page (max 200)"),
        sort: str | None = Query(None, description="Sort spec: field or -field for desc"),
    ):
        self.page = page
        self.page_size = page_size
        self.sort = sort

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def paginate(items: Sequence[T], total: int, params: PaginationParams) -> Page[T]:
    pages = (total + params.page_size - 1) // params.page_size if params.page_size else 1
    return Page[T](
        items=list(items),
        total=total,
        page=params.page,
        page_size=params.page_size,
        pages=pages,
    )
