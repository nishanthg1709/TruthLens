"""Domain errors and API exception handlers."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class TruthLensError(Exception):
    """Base application error with a client-safe message."""

    def __init__(self, message: str, *, status_code: int = 400, code: str = "error") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class ValidationFailedError(TruthLensError):
    """Raised when an uploaded image fails validation."""

    def __init__(self, message: str, *, code: str = "validation_error") -> None:
        super().__init__(message, status_code=400, code=code)


class PayloadTooLargeError(TruthLensError):
    """Raised when an upload exceeds configured size limits."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=413, code="payload_too_large")


def _error_body(
    *,
    code: str,
    message: str,
    details: Any | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details is not None:
        body["error"]["details"] = details
    return body


def register_exception_handlers(app: FastAPI) -> None:
    """Attach consistent JSON error handlers to the FastAPI app."""

    @app.exception_handler(TruthLensError)
    async def truthlens_error_handler(
        _request: Request,
        exc: TruthLensError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(code=exc.code, message=exc.message),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body(
                code="request_validation_error",
                message="Request validation failed.",
                details=exc.errors(),
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        detail = exc.detail
        message = detail if isinstance(detail, str) else "Request failed."
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(code="http_error", message=message),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        _request: Request,
        _exc: Exception,
    ) -> JSONResponse:
        # Never expose internal stack traces to clients.
        return JSONResponse(
            status_code=500,
            content=_error_body(
                code="internal_error",
                message="An unexpected error occurred while processing the request.",
            ),
        )
