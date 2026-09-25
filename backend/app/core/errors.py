"""
Custom application error and FastAPI exception handlers.

Every error — whether raised explicitly, from Pydantic validation, or
an unhandled 500 — is normalised to the standard JSON envelope:

    {
      "error": {
        "code": "...",
        "message": "...",
        "field": "..."   // optional
      }
    }
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(HTTPException):
    """
    Raise this anywhere in the codebase for a controlled error response.
    Inherits from FastAPI's HTTPException so that any AppError raised is strictly
    an HTTPException instance, compatible with all FastAPI exception flows.

    Parameters
    ----------
    status_code : int
        HTTP status code (e.g. 400, 401, 403, 404, 409).
    code : str
        Machine-readable error code (e.g. ``"validation_error"``).
    message : str
        Human-readable explanation.
    field : str | None
        Optional field name that caused the error.
    headers : dict[str, str] | None
        Optional HTTP headers (e.g. ``{"WWW-Authenticate": "Bearer"}``).
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        field: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field
        self.headers = headers
        super().__init__(status_code=status_code, detail=message, headers=headers)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", field: str | None = None) -> None:
        super().__init__(status_code=404, code="not_found", message=message, field=field)


class ValidationError(AppError):
    def __init__(self, message: str = "Validation error", field: str | None = None) -> None:
        super().__init__(status_code=422, code="validation_error", message=message, field=field)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized", field: str | None = None) -> None:
        super().__init__(
            status_code=401,
            code="unauthorized",
            message=message,
            field=field,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden", field: str | None = None) -> None:
        super().__init__(status_code=403, code="forbidden", message=message, field=field)



def _error_body(
    code: str,
    message: str,
    field: str | None = None,
) -> dict:
    """Build the standard error envelope."""
    body: dict = {"code": code, "message": message}
    if field is not None:
        body["field"] = field
    return {"error": body}


async def _app_error_handler(
    _request: Request,
    exc: AppError,
) -> JSONResponse:
    """Handle explicitly raised ``AppError``."""
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.code, exc.message, exc.field),
        headers=getattr(exc, "headers", None),
    )


async def _http_exception_handler(
    _request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Handle raw FastAPI/Starlette HTTPException and normalize to standard error envelope."""
    code_map = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        422: "validation_error",
        429: "rate_limit_exceeded",
    }
    code = code_map.get(exc.status_code, "http_error")
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(
            code=code,
            message=str(exc.detail) if exc.detail else "HTTP Exception",
        ),
        headers=getattr(exc, "headers", None),
    )


async def _validation_error_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    Flatten Pydantic / FastAPI validation errors into the standard shape.

    When multiple fields fail validation the first error is reported
    (keeps the response simple and consistent).
    """
    first = exc.errors()[0] if exc.errors() else {}
    loc = first.get("loc", ())
    # loc is a tuple like ("body", "lat") or ("query", "status")
    field_name = str(loc[-1]) if loc else None
    return JSONResponse(
        status_code=422,
        content=_error_body(
            code="validation_error",
            message=first.get("msg", "Validation error"),
            field=field_name,
        ),
    )


async def _generic_error_handler(
    _request: Request,
    _exc: Exception,
) -> JSONResponse:
    """Catch-all for unhandled exceptions → 500 with safe message."""
    return JSONResponse(
        status_code=500,
        content=_error_body(
            code="internal_error",
            message="An unexpected error occurred.",
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Wire all exception handlers onto the FastAPI app instance."""
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _generic_error_handler)  # type: ignore[arg-type]
