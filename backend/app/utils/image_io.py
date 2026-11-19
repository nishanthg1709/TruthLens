"""In-memory image I/O helpers."""

from __future__ import annotations

import warnings
from io import BytesIO

from PIL import Image, ImageFile, UnidentifiedImageError

from app.core.config import Settings
from app.core.errors import ValidationFailedError

# Avoid truncated-image surprises during decode.
ImageFile.LOAD_TRUNCATED_IMAGES = False


FORMAT_TO_MIME: dict[str, str] = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def open_image(data: bytes, settings: Settings) -> Image.Image:
    """Open and fully load an image from bytes with decompression safeguards.

    Args:
        data: Raw uploaded file bytes.
        settings: Application settings providing pixel limits.

    Returns:
        A loaded Pillow Image instance. Caller should close it when done.

    Raises:
        ValidationFailedError: If the bytes cannot be decoded as a safe image.
    """
    if not data:
        raise ValidationFailedError("Empty file rejected.", code="empty_file")

    # Enforce Pillow's decompression-bomb threshold from configuration.
    previous_limit = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = settings.max_pixel_count

    try:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                image = Image.open(BytesIO(data))
                # Force full decode so corrupt payloads fail here, not later.
                image.load()
        except Image.DecompressionBombError as exc:
            raise ValidationFailedError(
                "Image exceeds the maximum allowed pixel count "
                f"({settings.max_pixel_count:,} pixels).",
                code="decompression_bomb",
            ) from exc
        except Image.DecompressionBombWarning as exc:
            # Treat warnings as hard failures for forensic safety.
            raise ValidationFailedError(
                "Image triggered a decompression-bomb warning and was rejected.",
                code="decompression_bomb",
            ) from exc
        except UnidentifiedImageError as exc:
            raise ValidationFailedError(
                "File is not a recognized image format.",
                code="unrecognized_image",
            ) from exc
        except OSError as exc:
            raise ValidationFailedError(
                "Image data is corrupt or could not be decoded.",
                code="corrupt_image",
            ) from exc
        return image
    finally:
        Image.MAX_IMAGE_PIXELS = previous_limit


def mime_for_format(image_format: str | None) -> str | None:
    """Map a Pillow format name to a MIME type, if known."""
    if not image_format:
        return None
    return FORMAT_TO_MIME.get(image_format.upper())


def format_bytes(num_bytes: int) -> str:
    """Return a human-readable file size string."""
    if num_bytes < 0:
        raise ValueError("num_bytes must be non-negative")

    units = ("B", "KB", "MB", "GB", "TB")
    size = float(num_bytes)
    unit_index = 0
    while size >= 1024.0 and unit_index < len(units) - 1:
        size /= 1024.0
        unit_index += 1

    if unit_index == 0:
        return f"{int(size)} B"
    return f"{size:.1f} {units[unit_index]}"
