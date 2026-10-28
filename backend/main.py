"""Vercel entry point for the Discipline FastAPI application."""

try:
    from app.main import app
except Exception as exc:
    # Keep Vercel from replacing an import failure with an opaque 500 response.
    # Only expose the exception class and validation field names; never return
    # the exception text, which could contain a connection URL or other secret.
    import logging

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    startup_error_type = type(exc).__name__
    startup_error_module = type(exc).__module__
    startup_error_fields = []
    if hasattr(exc, "errors"):
        try:
            startup_error_fields = [
                {
                    "field": ".".join(str(part) for part in issue.get("loc", ())),
                    "code": issue.get("type"),
                }
                for issue in exc.errors()
            ]
        except Exception:
            startup_error_fields = []

    logging.getLogger(__name__).error(
        "Discipline API startup failed (%s.%s)",
        startup_error_module,
        startup_error_type,
    )

    app = FastAPI(title="Discipline API startup diagnostics")

    @app.api_route(
        "/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )
    def startup_failed(path: str):
        return JSONResponse(
            status_code=503,
            content={
                "detail": "The Discipline API could not start.",
                "diagnostic": {
                    "type": startup_error_type,
                    "module": startup_error_module,
                    "fields": startup_error_fields,
                },
            },
        )

__all__ = ["app"]
