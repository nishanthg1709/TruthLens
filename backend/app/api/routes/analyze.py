"""Image analysis endpoint (Phase 2A: validation + SHA-256 + metadata)."""

from fastapi import APIRouter, File, UploadFile

from app.core.errors import ValidationFailedError
from app.models.schemas import AnalyzeResponse, Assessment, ImageProperties
from app.services.hashing import compute_sha256
from app.services.metadata import build_metadata_analysis
from app.services.validation import validate_image

router = APIRouter(prefix="/api/v1", tags=["analyze"])

PHASE_2A_LIMITATIONS = [
    "Error Level Analysis has not yet been performed.",
    "Noise analysis has not yet been performed.",
    "Frequency analysis has not yet been performed.",
    "Regional anomaly analysis has not yet been performed.",
]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_image(file: UploadFile = File(...)) -> AnalyzeResponse:
    """Validate an uploaded image and return Phase 2A analysis results.

    Phase 2A adds EXIF/metadata extraction. This endpoint never invents
    authenticity scores or fabricated forensic findings.
    """
    if file is None:
        raise ValidationFailedError("No file provided.", code="missing_file")

    try:
        data = await file.read()
    finally:
        await file.close()

    if not data:
        raise ValidationFailedError("Empty file rejected.", code="empty_file")

    validated = validate_image(
        data,
        filename=file.filename,
        declared_content_type=file.content_type,
    )
    digest = compute_sha256(data)
    metadata_analysis = build_metadata_analysis(data, validated.format)

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
        phase="phase_2a",
        image_properties=properties,
        sha256=digest,
        analyses=[metadata_analysis],
        assessment=Assessment(
            status="INCOMPLETE",
            summary=(
                "Image validation, identification, and metadata analysis completed. "
                "Advanced forensic analyses beyond metadata have not yet been implemented."
            ),
            limitations=list(PHASE_2A_LIMITATIONS),
        ),
    )
