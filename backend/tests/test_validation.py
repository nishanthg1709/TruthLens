"""Tests for image validation."""

from __future__ import annotations

import pytest
from PIL import Image

from app.core.config import Settings
from app.core.errors import PayloadTooLargeError, ValidationFailedError
from app.services.validation import validate_image
from tests.conftest import make_image_bytes


@pytest.fixture
def strict_settings() -> Settings:
    """Smaller limits to make oversized cases cheap to construct."""
    return Settings(
        max_upload_bytes=1024,
        max_image_dimension=100,
        max_pixel_count=5_000,
    )


def test_valid_jpeg_accepted() -> None:
    data = make_image_bytes(fmt="JPEG", size=(80, 60))
    result = validate_image(data, filename="sample.jpg")
    assert result.format == "JPEG"
    assert result.mime_type == "image/jpeg"
    assert result.width == 80
    assert result.height == 60
    assert result.pixel_count == 4800
    assert result.aspect_ratio == pytest.approx(80 / 60)
    assert result.has_transparency is False


def test_valid_png_accepted() -> None:
    data = make_image_bytes(fmt="PNG", size=(32, 32), mode="RGBA", color=(10, 20, 30, 128))
    result = validate_image(data, filename="sample.png")
    assert result.format == "PNG"
    assert result.mime_type == "image/png"
    assert result.has_transparency is True


def test_valid_webp_accepted() -> None:
    if "WEBP" not in Image.registered_extensions().values() and not hasattr(Image, "SAVE"):
        pytest.skip("WEBP support unavailable")
    try:
        data = make_image_bytes(fmt="WEBP", size=(40, 20))
    except OSError:
        pytest.skip("WEBP encoder unavailable in this Pillow build")
    result = validate_image(data, filename="sample.webp")
    assert result.format == "WEBP"
    assert result.mime_type == "image/webp"
    assert result.aspect_ratio == pytest.approx(2.0)


def test_invalid_file_rejected() -> None:
    with pytest.raises(ValidationFailedError):
        validate_image(b"not-an-image", filename="x.jpg")


def test_empty_file_rejected() -> None:
    with pytest.raises(ValidationFailedError) as exc_info:
        validate_image(b"", filename="empty.jpg")
    assert exc_info.value.code == "empty_file"


def test_corrupted_image_rejected() -> None:
    data = make_image_bytes(fmt="JPEG", size=(20, 20))
    corrupted = data[:20] + b"\x00\x01\x02\xff" + data[40:]
    with pytest.raises(ValidationFailedError):
        validate_image(corrupted, filename="corrupt.jpg")


def test_oversized_file_rejected(strict_settings: Settings) -> None:
    # Valid JPEG bytes padded past the byte limit.
    data = make_image_bytes(fmt="JPEG", size=(16, 16)) + (b"\x00" * 2048)
    with pytest.raises(PayloadTooLargeError):
        validate_image(data, filename="big.jpg", settings=strict_settings)


def test_dimension_limit_enforced(strict_settings: Settings) -> None:
    data = make_image_bytes(fmt="PNG", size=(120, 10))
    with pytest.raises(ValidationFailedError) as exc_info:
        validate_image(data, filename="wide.png", settings=strict_settings)
    assert exc_info.value.code == "dimension_limit"


def test_pixel_limit_enforced(strict_settings: Settings) -> None:
    # 90x90 = 8100 > 5000 pixel limit, but under dimension limit of 100.
    # Pillow may reject via decompression-bomb safeguards before our
    # post-decode pixel_count check; both are valid enforcement paths.
    data = make_image_bytes(fmt="PNG", size=(90, 90))
    with pytest.raises(ValidationFailedError) as exc_info:
        validate_image(data, filename="dense.png", settings=strict_settings)
    assert exc_info.value.code in {"pixel_limit", "decompression_bomb"}


def test_spoofed_extension_rejected() -> None:
    with pytest.raises(ValidationFailedError):
        validate_image(
            b"<html>not an image</html>",
            filename="fake.jpg",
            declared_content_type="image/jpeg",
        )


def test_svg_rejected() -> None:
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
    with pytest.raises(ValidationFailedError):
        validate_image(
            svg,
            filename="image.svg",
            declared_content_type="image/svg+xml",
        )
