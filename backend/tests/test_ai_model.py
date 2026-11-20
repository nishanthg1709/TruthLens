"""Tests ensuring forensic image analysis works independently without an AI detection model."""

from __future__ import annotations

from unittest.mock import patch
from fastapi.testclient import TestClient

from app.services.ai_model import check_ai_model_status, run_ai_detection
from tests.conftest import make_image_bytes


def test_ai_model_status_defaults_to_unavailable() -> None:
    """Verify check_ai_model_status returns unavailable with the expected message."""
    status = check_ai_model_status()
    assert status.available is False
    assert status.status == "unavailable"
    assert "AI detection model unavailable — traditional forensic analysis is still active." in status.message


def test_run_ai_detection_returns_none_and_no_fake_scores() -> None:
    """Verify run_ai_detection never returns fake scores when model is unavailable."""
    data = make_image_bytes(fmt="JPEG", size=(50, 50))
    status, result = run_ai_detection(data, "JPEG")
    assert status.available is False
    assert result is None


def test_analyze_endpoint_succeeds_without_ai_model(client: TestClient) -> None:
    """Image analysis must succeed with all 6 traditional forensic modules when AI model is unavailable."""
    data = make_image_bytes(fmt="JPEG", size=(80, 80), color=(100, 150, 200))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("test.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["success"] is True
    assert "model_status" in payload
    assert payload["model_status"] == (
        "AI detection model unavailable — traditional forensic analysis is still active."
    )
    assert payload["ai_model"]["available"] is False
    assert payload["ai_model"]["status"] == "unavailable"

    # All traditional modules must be present and completed
    analyses = {a["name"]: a for a in payload["analyses"]}
    assert set(analyses.keys()) == {"metadata", "ela", "noise", "frequency", "regional", "synthesis"}

    # 1. Metadata / EXIF
    assert analyses["metadata"]["status"] == "completed"
    assert "exif_present" in analyses["metadata"]["details"]

    # 2. ELA
    assert analyses["ela"]["status"] == "completed"
    assert "mean_difference" in analyses["ela"]["metrics"]
    assert analyses["ela"]["details"]["difference_image_data_url"] is not None

    # 3. Noise Residual
    assert analyses["noise"]["status"] == "completed"
    assert "residual_std" in analyses["noise"]["metrics"]
    assert analyses["noise"]["details"]["residual_std"] >= 0

    # 4. 2D FFT Frequency Analysis
    assert analyses["frequency"]["status"] == "completed"
    assert "total_non_dc_power" in analyses["frequency"]["metrics"]

    # 5. Regional Anomaly (4x4)
    assert analyses["regional"]["status"] == "completed"
    assert len(analyses["regional"]["details"]["regional_anomalies"]) == 16

    # 6. Synthesis
    assert analyses["synthesis"]["status"] == "completed"

    # No fake scores
    assert "ai_score" not in payload
    assert "fake_probability" not in payload
    assert "deepfake_confidence" not in payload


def test_analyze_endpoint_gracefully_handles_ai_model_failure(client: TestClient) -> None:
    """If an AI model throws an error during execution, traditional forensics must still complete."""
    data = make_image_bytes(fmt="JPEG", size=(60, 60))

    with patch("app.api.routes.analyze.run_ai_detection", side_effect=RuntimeError("AI weights missing")):
        response = client.post(
            "/api/v1/analyze",
            files={"file": ("error_case.jpg", data, "image/jpeg")},
        )

    # Must NOT fail with 500 or 400
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["ai_model"]["available"] is False
    assert payload["ai_model"]["status"] == "failed"
    assert "AI weights missing" in payload["ai_model"]["warning"]
    assert payload["model_status"] == (
        "AI detection model unavailable — traditional forensic analysis is still active."
    )

    # All 6 traditional analyses must still be completed
    assert len(payload["analyses"]) == 6
    for analysis in payload["analyses"]:
        assert analysis["status"] == "completed"
