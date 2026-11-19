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
    assert model.phase == "phase_3"
    assert model.image_properties.filename == "example.jpg"
    assert model.image_properties.format == "JPEG"
    assert model.image_properties.width == 100
    assert model.image_properties.height == 50
    assert model.image_properties.pixel_count == 5000
    assert model.image_properties.aspect_ratio == 2.0
    assert model.sha256 == hashlib.sha256(data).hexdigest()

    assert len(model.analyses) == 6
    analysis_names = {a.name for a in model.analyses}
    assert analysis_names == {"metadata", "ela", "noise", "frequency", "regional", "synthesis"}

    metadata_item = next(a for a in model.analyses if a.name == "metadata")
    assert metadata_item.status == "completed"

    ela_item = next(a for a in model.analyses if a.name == "ela")
    assert ela_item.status == "completed"
    assert "mean_difference" in ela_item.metrics
    assert ela_item.details is not None

    noise_item = next(a for a in model.analyses if a.name == "noise")
    assert noise_item.status == "completed"
    assert "residual_std" in noise_item.metrics
    assert noise_item.details is not None

    frequency_item = next(a for a in model.analyses if a.name == "frequency")
    assert frequency_item.status == "completed"
    assert "spectral_centroid" in frequency_item.metrics
    assert frequency_item.details is not None

    regional_item = next(a for a in model.analyses if a.name == "regional")
    assert regional_item.status == "completed"
    assert "max_deviation_score" in regional_item.metrics
    assert regional_item.details is not None

    synthesis_item = next(a for a in model.analyses if a.name == "synthesis")
    assert synthesis_item.status == "completed"
    assert "relationship" in synthesis_item.metrics
    assert synthesis_item.details is not None

    assert model.assessment.status == "COMPLETE"
    assert len(model.assessment.summary) > 0
    assert len(model.assessment.limitations) >= 1

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


def test_png_handles_unavailable_ela_in_synthesis(client: TestClient) -> None:
    data = make_image_bytes(fmt="PNG", size=(24, 24))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("sample.png", data, "image/png")},
    )
    payload = response.json()
    assert len(payload["analyses"]) == 6
    analysis_map = {a["name"]: a for a in payload["analyses"]}
    assert "metadata" in analysis_map
    assert "ela" in analysis_map
    assert "noise" in analysis_map
    assert "frequency" in analysis_map
    assert "regional" in analysis_map
    assert "synthesis" in analysis_map
    assert analysis_map["ela"]["status"] == "unavailable"
    assert analysis_map["noise"]["status"] == "completed"
    assert analysis_map["frequency"]["status"] == "completed"
    assert analysis_map["regional"]["status"] == "completed"
    assert analysis_map["synthesis"]["status"] == "completed"
    assert payload["assessment"]["status"] == "COMPLETE"
    assert any("not JPEG" in lim for lim in payload["assessment"]["limitations"])


def test_analyze_jpeg_includes_all_visualizations(client: TestClient) -> None:
    data = make_image_bytes(fmt="JPEG", size=(40, 40), color=(50, 100, 150))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("test.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 200
    payload = response.json()
    ela_item = next(a for a in payload["analyses"] if a["name"] == "ela")
    assert ela_item["status"] == "completed"
    assert ela_item["details"] is not None
    assert ela_item["details"]["difference_image_data_url"].startswith("data:image/png;base64,")
    assert ela_item["metrics"]["mean_difference"] >= 0.0
    assert len(ela_item["details"]["regional_metrics"]) > 0

    noise_item = next(a for a in payload["analyses"] if a["name"] == "noise")
    assert noise_item["status"] == "completed"
    assert noise_item["details"] is not None
    assert noise_item["details"]["visualization_data_url"].startswith("data:image/png;base64,")
    assert noise_item["metrics"]["residual_std"] >= 0.0
    assert "std" in noise_item["details"]["regional_metrics"][0]
    assert "variance" not in noise_item["details"]["regional_metrics"][0]

    freq_item = next(a for a in payload["analyses"] if a["name"] == "frequency")
    assert freq_item["status"] == "completed"
    assert freq_item["details"] is not None
    assert freq_item["details"]["visualization_data_url"].startswith("data:image/png;base64,")
    assert freq_item["metrics"]["spectral_centroid"] >= 0.0

    reg_item = next(a for a in payload["analyses"] if a["name"] == "regional")
    assert reg_item["status"] == "completed"
    assert reg_item["details"] is not None
    assert reg_item["details"]["visualization_data_url"].startswith("data:image/png;base64,")
    assert reg_item["metrics"]["max_deviation_score"] >= 0.0

    synth_item = next(a for a in payload["analyses"] if a["name"] == "synthesis")
    assert synth_item["status"] == "completed"
    assert synth_item["details"] is not None
    assert "evidence_summary" in synth_item["details"]


def test_analyze_uses_configured_sigma(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import Settings
    custom = Settings(noise_default_sigma=2.5)
    monkeypatch.setattr("app.api.routes.analyze.get_settings", lambda: custom)

    data = make_image_bytes(fmt="PNG", size=(30, 30))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("test.png", data, "image/png")},
    )
    assert response.status_code == 200
    noise_item = next(a for a in response.json()["analyses"] if a["name"] == "noise")
    assert noise_item["details"]["smoothing_sigma"] == 2.5
    assert noise_item["metrics"]["smoothing_sigma"] == 2.5
