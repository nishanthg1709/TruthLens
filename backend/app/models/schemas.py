"""Pydantic response models for the TruthLens API contract."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check payload."""

    application: str
    status: Literal["healthy"]
    version: str


class ImageProperties(BaseModel):
    """Validated image identity and basic properties."""

    filename: str | None = None
    format: str
    mime_type: str
    size_bytes: int = Field(ge=0)
    size_readable: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    aspect_ratio: float = Field(gt=0)
    pixel_count: int = Field(gt=0)
    mode: str
    has_transparency: bool


class MetadataDetails(BaseModel):
    """Structured EXIF / metadata details.

    Exact GPS coordinates are intentionally omitted for privacy.
    """

    exif_present: bool
    camera_make: str | None = None
    camera_model: str | None = None
    lens: str | None = None
    orientation: int | str | None = None
    capture_datetime: str | None = None
    digitized_datetime: str | None = None
    color_space: str | None = None
    exif_version: str | None = None
    software: str | None = None
    gps_present: bool = False
    gps_fields_present: list[str] = Field(default_factory=list)
    fields_found: list[str] = Field(default_factory=list)
    fields_missing: list[str] = Field(default_factory=list)
    parse_errors: list[str] = Field(default_factory=list)
    format_notes: str | None = None


class AnalysisItem(BaseModel):
    """A single forensic analysis entry.

    Fake or fabricated findings must never appear here.
    """

    name: str
    status: Literal[
        "ok",
        "completed",
        "skipped",
        "failed",
        "unavailable",
        "not_implemented",
    ]
    observations: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    limitations: list[str] = Field(default_factory=list)
    details: MetadataDetails | dict[str, Any] | None = None


class Assessment(BaseModel):
    """High-level assessment with explicit incompleteness while modules remain pending."""

    status: Literal["INCOMPLETE", "INCONCLUSIVE", "COMPLETE"]
    summary: str
    limitations: list[str]


class AnalyzeResponse(BaseModel):
    """Structured analyze response."""

    success: bool = True
    application: str = "TruthLens"
    phase: Literal["phase_1", "phase_2a"] = "phase_2a"
    image_properties: ImageProperties
    sha256: str = Field(min_length=64, max_length=64)
    analyses: list[AnalysisItem] = Field(default_factory=list)
    assessment: Assessment


class ErrorDetail(BaseModel):
    """Client-safe error detail."""

    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    success: Literal[False] = False
    error: ErrorDetail
