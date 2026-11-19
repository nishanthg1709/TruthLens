"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-based settings for the TruthLens API."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = Field(default="TruthLens", alias="APP_NAME")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")
    debug: bool = Field(default=False, alias="DEBUG")

    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        alias="CORS_ORIGINS",
    )

    max_upload_bytes: int = Field(default=15 * 1024 * 1024, alias="MAX_UPLOAD_BYTES")
    max_image_dimension: int = Field(default=12_000, alias="MAX_IMAGE_DIMENSION")
    max_pixel_count: int = Field(default=40_000_000, alias="MAX_PIXEL_COUNT")
    ela_default_quality: int = Field(
        default=90,
        alias="ELA_DEFAULT_QUALITY",
        ge=1,
        le=100,
    )
    noise_default_sigma: float = Field(
        default=1.0,
        alias="NOISE_DEFAULT_SIGMA",
        gt=0.0,
        le=50.0,
    )
    fft_max_dimension: int = Field(
        default=2048,
        alias="FFT_MAX_DIMENSION",
        ge=64,
        le=12_000,
    )
    regional_grid_rows: int = Field(
        default=4,
        alias="REGIONAL_GRID_ROWS",
        ge=1,
        le=16,
    )
    regional_grid_cols: int = Field(
        default=4,
        alias="REGIONAL_GRID_COLS",
        ge=1,
        le=16,
    )
    regional_edge_threshold: float = Field(
        default=15.0,
        alias="REGIONAL_EDGE_THRESHOLD",
        ge=1.0,
        le=255.0,
    )

    # Pillow format names we accept after decoding.
    supported_formats: tuple[str, ...] = ("JPEG", "PNG", "WEBP")

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        """Allow non-standard ambient debug strings like 'release' safely."""
        if isinstance(value, str):
            if value.lower() in ("true", "1", "yes", "on", "debug", "dev", "development"):
                return True
            return False
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        """Allow comma-separated CORS origins from environment strings."""
        if isinstance(value, str):
            origins = [item.strip() for item in value.split(",") if item.strip()]
            return origins
        return value


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
