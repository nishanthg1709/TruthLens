"""Image analysis endpoint (Phase 2E: validation + SHA-256 + metadata + ELA + Noise + Frequency + Regional Anomaly)."""

from fastapi import APIRouter, File, UploadFile

from app.core.config import get_settings
from app.core.errors import ValidationFailedError
from app.models.schemas import AnalyzeResponse, Assessment, ImageProperties
from app.services.ela import build_ela_analysis
from app.services.frequency import build_frequency_analysis
from app.services.hashing import compute_sha256
from app.services.metadata import build_metadata_analysis
from app.services.noise import build_noise_analysis
from app.services.regional import build_regional_analysis
from app.services.validation import validate_image

router = APIRouter(prefix="/api/v1", tags=["analyze"])

PHASE_2E_LIMITATIONS = [
    "Evidence aggregation and forensic synthesis (Phase 3) have not yet been performed.",
]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_image(file: UploadFile = File(...)) -> AnalyzeResponse:
    """Validate an uploaded image and return Phase 2E analysis results.

    Phase 2E adds Regional Anomaly Analysis alongside Frequency Domain, Noise Residual,
    Error Level Analysis, and EXIF/metadata extraction.
    This endpoint never invents authenticity scores or fabricated forensic findings.
    """
    if file is None:
        raise ValidationFailedError("No file provided.", code="missing_file")

    try:
        data = await file.read()
    finally:
        await file.close()

    if not data:
        raise ValidationFailedError("Empty file rejected.", code="empty_file")

    settings = get_settings()
    validated = validate_image(
        data,
        filename=file.filename,
        declared_content_type=file.content_type,
        settings=settings,
    )
    digest = compute_sha256(data)
    metadata_analysis = build_metadata_analysis(data, validated.format)
    ela_analysis = build_ela_analysis(
        data,
        validated.format,
        quality=settings.ela_default_quality,
    )
    noise_analysis = build_noise_analysis(
        data,
        validated.format,
        sigma=settings.noise_default_sigma,
    )
    frequency_analysis = build_frequency_analysis(
        data,
        validated.format,
        max_dimension=settings.fft_max_dimension,
    )
    regional_analysis = build_regional_analysis(
        data,
        validated.format,
        grid_size=(settings.regional_grid_rows, settings.regional_grid_cols),
        edge_threshold=settings.regional_edge_threshold,
        ela_analysis=ela_analysis,
        noise_analysis=noise_analysis,
    )

    properties = ImageProperties(
        filename=validated.filename,
        format=validated.format,
        mime_type=validated.mime_type,
        size_bytes=validated.size_bytes,
        size_readable=validated.size_readable,
        width=validated.width,
        height=validated.height,
        aspect_ratio=validated.aspect_ratio,
        pixel_count=validated.pixel_count,
        mode=validated.mode,
        has_transparency=validated.has_transparency,
    )

    return AnalyzeResponse(
        success=True,
        application="TruthLens",
        phase="phase_2e",
        image_properties=properties,
        sha256=digest,
        analyses=[
            metadata_analysis,
            ela_analysis,
            noise_analysis,
            frequency_analysis,
            regional_analysis,
        ],
        assessment=Assessment(
            status="INCOMPLETE",
            summary=(
                "Image validation, identification, metadata analysis, "
                "error level analysis, noise residual analysis, "
                "frequency domain analysis, and regional anomaly analysis completed. "
                "Cross-module evidence aggregation and forensic synthesis (Phase 3) have not yet been performed."
            ),
            limitations=list(PHASE_2E_LIMITATIONS),
        ),
    )
