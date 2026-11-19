"""TruthLens API application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analyze, health
from app.core.config import get_settings
from app.core.errors import register_exception_handlers


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="TruthLens API",
        version=settings.app_version,
        description=(
            "TruthLens — See beyond the image. Verify what is real.\n\n"
            "Phase 2A provides image validation, property extraction, SHA-256 "
            "fingerprinting, and EXIF/metadata analysis. ELA, noise, frequency, "
            "and regional anomaly analyses are not yet implemented. Exact GPS "
            "coordinates are withheld by default."
        ),
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(analyze.router)

    return app


app = create_app()
