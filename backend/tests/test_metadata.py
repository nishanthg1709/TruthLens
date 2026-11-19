"""Tests for Phase 2A EXIF / metadata analysis."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.models.schemas import AnalyzeResponse, MetadataDetails
from app.services.metadata import (
    build_metadata_analysis,
    extract_metadata,
    response_contains_gps_coordinates,
)
from tests.conftest import make_image_bytes, make_jpeg_with_exif


def test_jpeg_with_exif_camera_fields() -> None:
    data = make_jpeg_with_exif(
        make="Canon",
        model="EOS R5",
        software="TruthLens Test Suite",
        orientation=1,
        datetime_original="2024:01:15 12:30:00",
    )
    result = extract_metadata(data, "JPEG")
    assert result.exif_present is True
    assert result.camera_make == "Canon"
    assert result.camera_model == "EOS R5"
    assert result.software == "TruthLens Test Suite"
    assert result.orientation == 1
    assert result.capture_datetime == "2024:01:15 12:30:00"


def test_jpeg_without_exif() -> None:
    data = make_image_bytes(fmt="JPEG", size=(32, 32))
    result = extract_metadata(data, "JPEG")
    assert result.exif_present is False
    assert result.camera_make is None
    assert result.gps_present is False


def test_png_without_exif() -> None:
    data = make_image_bytes(fmt="PNG", size=(32, 32))
    result = extract_metadata(data, "PNG")
    assert result.exif_present is False
    assert result.format_notes is not None


def test_webp_without_exif() -> None:
    try:
        data = make_image_bytes(fmt="WEBP", size=(32, 32))
    except OSError:
        pytest.skip("WEBP encoder unavailable")
    result = extract_metadata(data, "WEBP")
    assert result.exif_present is False


def test_orientation_extraction() -> None:
    data = make_jpeg_with_exif(orientation=6)
    result = extract_metadata(data, "JPEG")
    assert result.orientation == 6
    assert "orientation" in result.fields_found


def test_software_tag_extraction() -> None:
    data = make_jpeg_with_exif(software="Adobe Photoshop 24.0")
    result = extract_metadata(data, "JPEG")
    assert result.software == "Adobe Photoshop 24.0"


def test_gps_present_but_coordinates_withheld() -> None:
    data = make_jpeg_with_exif(include_gps=True, make="Sony", model="A7IV")
    analysis = build_metadata_analysis(data, "JPEG")
    assert analysis.status == "completed"
    assert isinstance(analysis.details, MetadataDetails)
    assert analysis.details.gps_present is True
    assert analysis.details.gps_fields_present
    assert analysis.details.camera_make == "Sony"

    payload = json.loads(analysis.model_dump_json())
    assert response_contains_gps_coordinates(payload) is False
    dumped = json.dumps(payload)
    assert "37.0" not in dumped
    assert "122.0" not in dumped
    assert "GPSLatitude" in analysis.details.gps_fields_present or any(
        "Latitude" in name for name in analysis.details.gps_fields_present
    )


def test_missing_metadata_not_classified_as_manipulation() -> None:
    data = make_image_bytes(fmt="JPEG", size=(40, 40))
    analysis = build_metadata_analysis(data, "JPEG")
    assert analysis.status == "completed"
    assert analysis.details is not None
    assert analysis.details.exif_present is False  # type: ignore[union-attr]
    joined = " ".join(analysis.observations).lower()
    assert "not evidence" in joined or "not evidence of ai" in joined
    assert "ai-generated" not in joined or "not" in joined
    assert "manipulation" in joined
    # Must not claim authenticity or fakeness.
    assert "definitely authentic" not in joined
    assert "definitely fake" not in joined


def test_invalid_metadata_handling() -> None:
    # Valid JPEG with a truncated / corrupt EXIF APP1 segment injected.
    base = make_image_bytes(fmt="JPEG", size=(24, 24))
    # JPEG SOI + bogus APP1 + remainder of file (skip original SOI).
    corrupt_exif = b"\xff\xd8\xff\xe1\x00\x08Exif\x00\x00\x00\x00" + base[2:]
    result = extract_metadata(corrupt_exif, "JPEG")
    # Should not raise; either no EXIF or parse_errors populated.
    assert isinstance(result.exif_present, bool)
    analysis = build_metadata_analysis(corrupt_exif, "JPEG")
    assert analysis.name == "metadata"
    assert analysis.status in {"completed", "failed"}


def test_corrupt_image_rejected_before_metadata(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("corrupt.jpg", b"not-a-real-image", "image/jpeg")},
    )
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_api_metadata_integration(client: TestClient) -> None:
    data = make_jpeg_with_exif(
        make="Nikon",
        model="Z8",
        software="TruthLens",
        orientation=1,
    )
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("camera.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 200
    payload = response.json()
    model = AnalyzeResponse.model_validate(payload)

    assert model.phase == "phase_2a"
    assert len(model.analyses) == 1
    meta = model.analyses[0]
    assert meta.name == "metadata"
    assert meta.status == "completed"
    assert meta.details is not None
    details = meta.details
    if isinstance(details, dict):
        details = MetadataDetails.model_validate(details)
    assert details.exif_present is True
    assert details.camera_make == "Nikon"
    assert details.camera_model == "Z8"
    assert details.software == "TruthLens"

    assert model.assessment.status == "INCOMPLETE"
    assert all("Metadata analysis has not yet been performed" != item for item in model.assessment.limitations)
    assert "is_fake" not in payload
    assert "is_authentic" not in payload
    assert "authenticity_score" not in payload
    assert response_contains_gps_coordinates(payload) is False


def test_api_no_exif_still_completed(client: TestClient) -> None:
    data = make_image_bytes(fmt="PNG", size=(20, 20))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("plain.png", data, "image/png")},
    )
    payload = response.json()
    meta = payload["analyses"][0]
    assert meta["name"] == "metadata"
    assert meta["status"] == "completed"
    assert meta["details"]["exif_present"] is False
    joined = " ".join(meta["observations"]).lower()
    assert "no exif" in joined or "not evidence" in joined


def test_build_analysis_observations_from_real_data() -> None:
    data = make_jpeg_with_exif(make="Fujifilm", model="X-T5", software="Capture One")
    analysis = build_metadata_analysis(data, "JPEG")
    assert any("Camera information is present" in obs for obs in analysis.observations)
    assert any("Software information is recorded" in obs for obs in analysis.observations)
