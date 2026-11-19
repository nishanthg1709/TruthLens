"""Shared pytest fixtures for TruthLens backend tests."""

from __future__ import annotations

from io import BytesIO
from typing import Iterator

import piexif
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import Settings, get_settings
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    """Return deterministic settings for tests."""
    return Settings(
        app_name="TruthLens",
        app_version="1.0.0",
        debug=False,
        cors_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        max_upload_bytes=15 * 1024 * 1024,
        max_image_dimension=12_000,
        max_pixel_count=40_000_000,
    )


@pytest.fixture
def client(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Create a TestClient with get_settings patched for deterministic config."""
    get_settings.cache_clear()
    monkeypatch.setattr("app.core.config.get_settings", lambda: settings)
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    monkeypatch.setattr("app.api.routes.health.get_settings", lambda: settings)
    monkeypatch.setattr("app.api.routes.analyze.get_settings", lambda: settings)
    monkeypatch.setattr("app.services.validation.get_settings", lambda: settings)

    application = create_app()
    with TestClient(application) as test_client:
        yield test_client

    get_settings.cache_clear()


def make_image_bytes(
    *,
    fmt: str = "JPEG",
    size: tuple[int, int] = (64, 48),
    mode: str = "RGB",
    color: tuple[int, ...] | int = (20, 40, 60),
) -> bytes:
    """Generate an in-memory image and return encoded bytes."""
    image = Image.new(mode, size, color=color)
    buffer = BytesIO()
    save_kwargs: dict = {}
    fmt_upper = fmt.upper()
    if fmt_upper == "JPEG":
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        save_kwargs["quality"] = 90
    elif fmt_upper == "WEBP":
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGB")
    image.save(buffer, format=fmt_upper, **save_kwargs)
    return buffer.getvalue()


def make_jpeg_with_exif(
    *,
    size: tuple[int, int] = (64, 48),
    make: str | None = "TestMake",
    model: str | None = "TestModel",
    software: str | None = None,
    orientation: int | None = 1,
    datetime_original: str | None = None,
    include_gps: bool = False,
) -> bytes:
    """Create a JPEG with controlled EXIF tags via piexif."""
    zeroth: dict = {}
    exif_ifd: dict = {}
    gps_ifd: dict = {}

    if make is not None:
        zeroth[piexif.ImageIFD.Make] = make.encode("utf-8")
    if model is not None:
        zeroth[piexif.ImageIFD.Model] = model.encode("utf-8")
    if software is not None:
        zeroth[piexif.ImageIFD.Software] = software.encode("utf-8")
    if orientation is not None:
        zeroth[piexif.ImageIFD.Orientation] = orientation
    if datetime_original is not None:
        encoded = datetime_original.encode("utf-8")
        zeroth[piexif.ImageIFD.DateTime] = encoded
        exif_ifd[piexif.ExifIFD.DateTimeOriginal] = encoded
        exif_ifd[piexif.ExifIFD.DateTimeDigitized] = encoded

    if include_gps:
        # Deterministic fake coordinates used only to verify privacy withholding.
        gps_ifd[piexif.GPSIFD.GPSVersionID] = (2, 3, 0, 0)
        gps_ifd[piexif.GPSIFD.GPSLatitudeRef] = b"N"
        gps_ifd[piexif.GPSIFD.GPSLatitude] = ((37, 1), (0, 1), (0, 1))
        gps_ifd[piexif.GPSIFD.GPSLongitudeRef] = b"W"
        gps_ifd[piexif.GPSIFD.GPSLongitude] = ((122, 1), (0, 1), (0, 1))

    exif_dict = {"0th": zeroth, "Exif": exif_ifd, "GPS": gps_ifd, "1st": {}, "thumbnail": None}
    exif_bytes = piexif.dump(exif_dict)

    image = Image.new("RGB", size, color=(12, 34, 56))
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90, exif=exif_bytes)
    return buffer.getvalue()
