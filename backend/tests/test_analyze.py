"""Tests for the analyze API endpoint."""

from __future__ import annotations

import hashlib

from fastapi.testclient import TestClient

from app.models.schemas import AnalyzeResponse
from tests.conftest import make_image_bytes


def test_analyze_valid_image_structure(client: TestClient) -> None:
    data = make_image_bytes(fmt="JPEG", size=(100, 50), color=(1, 2, 3))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("example.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 200
    payload = response.json()

    # Schema validation
    model = AnalyzeResponse.model_validate(payload)

    assert model.success is True
    assert model.application == "TruthLens"
    assert model.phase == "phase_2a"
    assert model.image_properties.filename == "example.jpg"
    assert model.image_properties.format == "JPEG"
    assert model.image_properties.width == 100
    assert model.image_properties.height == 50
    assert model.image_properties.pixel_count == 5000
    assert model.image_properties.aspect_ratio == 2.0
    assert model.sha256 == hashlib.sha256(data).hexdigest()

    assert len(model.analyses) == 1
    assert model.analyses[0].name == "metadata"
    assert model.analyses[0].status == "completed"

    assert model.assessment.status == "INCOMPLETE"
    assert "metadata analysis completed" in model.assessment.summary.lower()
    assert len(model.assessment.limitations) >= 4
    assert all(
        "Metadata analysis has not yet been performed." != item
        for item in model.assessment.limitations
    )

    # Ensure no fabricated authenticity fields.
    assert "is_fake" not in payload
    assert "is_authentic" not in payload
    assert "authenticity_score" not in payload
    assert "authenticity_percentage" not in payload


def test_analyze_invalid_file_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("bad.jpg", b"definitely-not-an-image", "image/jpeg")},
    )
    assert response.status_code == 400
    payload = response.json()
    assert payload["success"] is False
    assert "error" in payload
    assert payload["error"]["message"]


def test_analyze_empty_file_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_analyze_missing_file_error(client: TestClient) -> None:
    response = client.post("/api/v1/analyze")
    assert response.status_code == 422
    assert response.json()["success"] is False


def test_unimplemented_modules_remain_listed(client: TestClient) -> None:
    data = make_image_bytes(fmt="PNG", size=(24, 24))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("sample.png", data, "image/png")},
    )
    payload = response.json()
    assert len(payload["analyses"]) == 1
    assert payload["analyses"][0]["name"] == "metadata"
    assert payload["assessment"]["status"] == "INCOMPLETE"
    for limitation in payload["assessment"]["limitations"]:
        assert "not yet been performed" in limitation
        assert "Metadata analysis" not in limitation
