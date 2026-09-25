from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic envelope for paginated list responses."""
    results: list[T]
    total: int
    limit: int
    offset: int
