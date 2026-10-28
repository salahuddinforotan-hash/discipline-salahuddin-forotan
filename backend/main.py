"""Vercel entry point for the Discipline FastAPI application."""

try:
    from app.main import app
except Exception as exc:
    # Keep Vercel from replacing an import failure with an opaque 500 response.
    # Only expose the exception class and validation field names; never return
    # the exception text, which could contain a connection URL or other secret.
    import json
    import logging

    startup_error_type = type(exc).__name__
    startup_error_module = type(exc).__module__
    startup_missing_module = getattr(exc, "name", None)
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

    async def app(scope, receive, send):
        """Dependency-free ASGI fallback for safe startup diagnostics."""
        if scope["type"] == "lifespan":
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    await send({"type": "lifespan.shutdown.complete"})
                    return

        if scope["type"] == "http":
            payload = json.dumps(
                {
                    "detail": "The Discipline API could not start.",
                    "diagnostic": {
                        "type": startup_error_type,
                        "module": startup_error_module,
                        "missing_module": startup_missing_module,
                        "fields": startup_error_fields,
                    },
                }
            ).encode("utf-8")
            await send(
                {
                    "type": "http.response.start",
                    "status": 503,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(payload)).encode("ascii")),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": payload})

__all__ = ["app"]
