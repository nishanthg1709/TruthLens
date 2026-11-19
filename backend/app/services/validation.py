"""Image upload validation and property extraction."""

from __future__ import annotations

from dataclasses import dataclass

from PIL import Image

from app.core.config import Settings, get_settings
from app.core.errors import PayloadTooLargeError, ValidationFailedError
from app.utils.image_io import format_bytes, mime_for_format, open_image


TRANSPARENT_MODES = {"RGBA", "LA", "PA"}


@dataclass(frozen=True)
class ValidatedImage:
    """Result of successful image validation."""

    filename: str | None
    format: str
    mime_type: str
    size_bytes: int
    size_readable: str
    width: int
    height: int
    aspect_ratio: float
    pixel_count: int
    mode: str
    has_transparency: bool


def _has_transparency(image: Image.Image) -> bool:
    """Detect whether the image has an alpha channel or transparency info."""
    if image.mode in TRANSPARENT_MODES:
        return True
    if image.mode == "P":
        transparency = image.info.get("transparency")
        return transparency is not None
    return "transparency" in image.info


def validate_image(
    data: bytes,
    *,
    filename: str | None = None,
    declared_content_type: str | None = None,
    settings: Settings | None = None,
) -> ValidatedImage:
    """Validate uploaded bytes and extract image properties.

    Does not trust filename extensions or declared MIME types alone.
    The image must decode as JPEG, PNG, or WEBP within configured limits.

    Args:
        data: Raw uploaded file bytes.
        filename: Optional original filename from the client.
        declared_content_type: Optional Content-Type from multipart metadata.
        settings: Optional settings override (useful in tests).

    Returns:
        ValidatedImage with properties derived from the decoded image.

    Raises:
        PayloadTooLargeError: If byte size exceeds the configured maximum.
        ValidationFailedError: If the file is empty, unsupported, corrupt,
            or exceeds dimension/pixel limits.
    """
    cfg = settings or get_settings()

    if data is None:
        raise ValidationFailedError("No file data provided.", code="missing_file")

    if len(data) == 0:
        raise ValidationFailedError("Empty file rejected.", code="empty_file")

    if len(data) > cfg.max_upload_bytes:
        raise PayloadTooLargeError(
            f"File exceeds the maximum upload size of {format_bytes(cfg.max_upload_bytes)}."
        )

    image = open_image(data, cfg)
    try:
        image_format = (image.format or "").upper()
        if image_format == "JPG":
            image_format = "JPEG"

        if image_format not in cfg.supported_formats:
            raise ValidationFailedError(
                f"Unsupported image format '{image_format or 'unknown'}'. "
                f"Supported formats: JPEG, PNG, WEBP.",
                code="unsupported_format",
            )

        mime_type = mime_for_format(image_format)
        if mime_type is None:
            raise ValidationFailedError(
                "Unable to determine MIME type for the decoded image.",
                code="unsupported_format",
            )

        # Declared MIME is advisory only; reject clear mismatches when present.
        if declared_content_type:
            normalized = declared_content_type.split(";")[0].strip().lower()
            if normalized and normalized not in {
                "application/octet-stream",
                mime_type,
            }:
                # Still allow if Pillow decoded a supported image — many browsers
                # send incorrect types. Only hard-fail non-image declarations
                # that clearly cannot be images.
                if normalized.startswith("text/") or normalized in {
                    "application/json",
                    "application/xml",
                    "application/pdf",
                    "image/svg+xml",
                }:
                    raise ValidationFailedError(
                        f"Declared content type '{normalized}' is not a supported image type.",
                        code="mime_mismatch",
                    )

        width, height = image.size
        if width <= 0 or height <= 0:
            raise ValidationFailedError(
                "Image dimensions must be positive.",
                code="invalid_dimensions",
            )

        if width > cfg.max_image_dimension or height > cfg.max_image_dimension:
            raise ValidationFailedError(
                f"Image dimensions {width}x{height} exceed the maximum "
                f"allowed dimension of {cfg.max_image_dimension} pixels.",
                code="dimension_limit",
            )

        pixel_count = width * height
        if pixel_count > cfg.max_pixel_count:
            raise ValidationFailedError(
                f"Image pixel count {pixel_count:,} exceeds the maximum "
                f"allowed {cfg.max_pixel_count:,} pixels.",
                code="pixel_limit",
            )

        # Exact ratio; JSON serialization may show finite float precision.
        aspect_ratio = width / height

        return ValidatedImage(
            filename=filename,
            format=image_format,
            mime_type=mime_type,
            size_bytes=len(data),
            size_readable=format_bytes(len(data)),
            width=width,
            height=height,
            aspect_ratio=aspect_ratio,
            pixel_count=pixel_count,
            mode=image.mode,
            has_transparency=_has_transparency(image),
        )
    finally:
        image.close()
