"""Comprehensive unit and forensic tests for the Noise Residual Analysis service."""

from __future__ import annotations

import base64
import json
from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from app.models.schemas import AnalysisItem, NoiseDetails
from app.services.noise import (
    DEFAULT_SMOOTHING_SIGMA,
    MAX_VISUALIZATION_DIMENSION,
    build_noise_analysis,
    compute_noise_residual,
)
from tests.conftest import make_image_bytes


def make_gradient_image(size: tuple[int, int] = (64, 48), fmt: str = "PNG") -> bytes:
    """Generate an image with a non-trivial spatial gradient for residual testing."""
    w, h = size
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            arr[y, x] = [int((x / max(1, w - 1)) * 255), int((y / max(1, h - 1)) * 255), 128]
    img = Image.fromarray(arr)
    buf = BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_noise_residual_basic() -> None:
    data = make_gradient_image((60, 40), fmt="PNG")
    item = build_noise_analysis(data, "PNG")

    assert item.name == "noise"
    assert item.status == "completed"
    assert len(item.observations) > 0
    assert len(item.limitations) >= 5

    # Check details
    assert item.details is not None
    details = item.details
    if isinstance(details, dict):
        details = NoiseDetails.model_validate(details)
    assert isinstance(details, NoiseDetails)
    assert details.smoothing_sigma == DEFAULT_SMOOTHING_SIGMA

    # Check metrics
    metrics = item.metrics
    assert "residual_mean" in metrics
    assert "residual_std" in metrics
    assert "mean_absolute_residual" in metrics
    assert "median_absolute_residual" in metrics
    assert "max_absolute_residual" in metrics
    assert "p95_absolute_residual" in metrics
    assert "p99_absolute_residual" in metrics
    assert "regional_mean_spread" in metrics
    assert "regional_std_mean" in metrics


def test_noise_signed_arithmetic_and_invariants() -> None:
    data = make_gradient_image((80, 80), fmt="PNG")
    result = compute_noise_residual(data, sigma=1.0)

    # Invariants on absolute residuals
    assert 0.0 <= result.mean_absolute_residual <= result.max_absolute_residual <= 255.0
    assert 0.0 <= result.median_absolute_residual <= result.p95_absolute_residual <= result.p99_absolute_residual <= result.max_absolute_residual

    # Standard deviation must be non-negative
    assert result.residual_std >= 0.0

    # Types must be native Python floats
    assert type(result.residual_mean) is float
    assert type(result.residual_std) is float
    assert type(result.mean_absolute_residual) is float
    assert type(result.median_absolute_residual) is float
    assert type(result.max_absolute_residual) is float


def test_noise_constant_image_behavior() -> None:
    # A perfectly uniform solid image should yield zero residual everywhere
    data = make_image_bytes(fmt="PNG", size=(50, 50), color=(100, 100, 100))
    result = compute_noise_residual(data, sigma=1.0)

    assert result.residual_mean == pytest.approx(0.0, abs=1e-5)
    assert result.residual_std == pytest.approx(0.0, abs=1e-5)
    assert result.mean_absolute_residual == pytest.approx(0.0, abs=1e-5)
    assert result.max_absolute_residual == pytest.approx(0.0, abs=1e-5)

    # Visualization must handle zero max residual without dividing by zero
    assert result.visualization_data_url is not None
    assert result.visualization_data_url.startswith("data:image/png;base64,")


def test_noise_channel_metrics_independent() -> None:
    # Red-only gradient image
    w, h = 40, 40
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :, 0] = np.tile(np.linspace(0, 255, w, dtype=np.uint8), (h, 1))
    buf = BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    data = buf.getvalue()

    result = compute_noise_residual(data, sigma=1.0)
    assert result.channel_mean_absolute_residuals["red"] > 0.0
    assert result.channel_mean_absolute_residuals["green"] == pytest.approx(0.0, abs=1e-5)
    assert result.channel_mean_absolute_residuals["blue"] == pytest.approx(0.0, abs=1e-5)


def test_noise_configurable_sigma() -> None:
    data = make_gradient_image((60, 60))
    result_s1 = compute_noise_residual(data, sigma=1.0)
    result_s3 = compute_noise_residual(data, sigma=3.0)

    assert result_s1.smoothing_sigma == 1.0
    assert result_s3.smoothing_sigma == 3.0
    # Larger sigma low-pass filter suppresses more structure, producing higher residual
    assert result_s3.mean_absolute_residual > result_s1.mean_absolute_residual


def test_noise_invalid_sigma_handling() -> None:
    data = make_image_bytes(fmt="PNG", size=(20, 20))
    with pytest.raises(ValueError):
        compute_noise_residual(data, sigma=0.0)
    with pytest.raises(ValueError):
        compute_noise_residual(data, sigma=-1.5)

    failed_item = build_noise_analysis(data, "PNG", sigma=-2.0)
    assert failed_item.status == "failed"
    assert "could not be computed" in failed_item.observations[0]


def test_noise_tiny_images() -> None:
    # 1x1, 2x2, 1x7, 7x1
    for size in [(1, 1), (2, 2), (1, 7), (7, 1)]:
        data = make_image_bytes(fmt="PNG", size=size, color=(80, 120, 160))
        item = build_noise_analysis(data, "PNG")
        assert item.status == "completed"
        assert item.details is not None
        assert len(item.details.regional_metrics) > 0


def test_noise_uneven_dimensions() -> None:
    data = make_gradient_image((101, 73))
    item = build_noise_analysis(data, "PNG", grid_size=(4, 4))
    assert item.status == "completed"
    assert len(item.details.regional_metrics) == 16


def test_noise_regional_grid_metrics() -> None:
    data = make_gradient_image((80, 80))
    item = build_noise_analysis(data, "PNG", grid_size=(4, 4))
    details = item.details
    if isinstance(details, dict):
        details = NoiseDetails.model_validate(details)

    assert len(details.regional_metrics) == 16
    for reg in details.regional_metrics:
        assert reg.region_id.startswith("r")
        assert 0 <= reg.row < 4
        assert 0 <= reg.col < 4
        assert reg.width > 0
        assert reg.height > 0
        assert reg.mean_difference >= 0.0
        assert reg.std >= 0.0
        assert not hasattr(reg, "variance")

    summary = details.regional_summary
    assert "mean_min" in summary
    assert "mean_max" in summary
    assert "mean_spread" in summary
    assert "std_min" in summary
    assert "std_max" in summary
    assert "std_mean" in summary
    assert summary["mean_spread"] == pytest.approx(summary["mean_max"] - summary["mean_min"])


def test_noise_visualization_validity() -> None:
    data = make_gradient_image((50, 40))
    item = build_noise_analysis(data, "PNG")
    data_url = item.details.visualization_data_url

    assert data_url is not None
    assert data_url.startswith("data:image/png;base64,")

    # Decode and check valid image
    header, b64_payload = data_url.split(",", 1)
    raw_png = base64.b64decode(b64_payload)
    with Image.open(BytesIO(raw_png)) as decoded:
        assert decoded.format == "PNG"
        assert decoded.size == (50, 40)


def test_noise_large_image_visualization_downsampled() -> None:
    data = make_image_bytes(fmt="PNG", size=(MAX_VISUALIZATION_DIMENSION + 200, 30))
    item = build_noise_analysis(data, "PNG")
    assert item.status == "completed"

    data_url = item.details.visualization_data_url
    _, b64_payload = data_url.split(",", 1)
    raw_png = base64.b64decode(b64_payload)
    with Image.open(BytesIO(raw_png)) as decoded:
        assert max(decoded.size) <= MAX_VISUALIZATION_DIMENSION


def test_noise_supported_formats() -> None:
    # JPEG
    jpg_data = make_image_bytes(fmt="JPEG", size=(40, 40))
    assert build_noise_analysis(jpg_data, "JPEG").status == "completed"

    # PNG
    png_data = make_image_bytes(fmt="PNG", size=(40, 40))
    assert build_noise_analysis(png_data, "PNG").status == "completed"

    # WEBP
    try:
        webp_data = make_image_bytes(fmt="WEBP", size=(40, 40))
        assert build_noise_analysis(webp_data, "WEBP").status == "completed"
    except OSError:
        pass  # Skip if WEBP encoder unavailable in environment

    # Unsupported format
    unsupported = build_noise_analysis(b"dummy", "TIFF")
    assert unsupported.status == "unavailable"


def test_noise_corrupt_input_defensive() -> None:
    corrupt = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\xff" * 50
    item = build_noise_analysis(corrupt, "PNG")
    assert item.status == "failed"
    assert item.details is None
    assert len(item.observations) == 1
    assert "could not be computed" in item.observations[0]


def test_noise_deterministic_execution() -> None:
    data = make_gradient_image((60, 40))
    item1 = build_noise_analysis(data, "PNG", sigma=1.0)
    item2 = build_noise_analysis(data, "PNG", sigma=1.0)

    assert item1.metrics == item2.metrics
    assert item1.observations == item2.observations
    assert item1.details.visualization_data_url == item2.details.visualization_data_url


def test_noise_json_serializability() -> None:
    data = make_gradient_image((40, 40))
    item = build_noise_analysis(data, "PNG")
    raw_json = item.model_dump_json()
    parsed = json.loads(raw_json)

    assert parsed["name"] == "noise"
    assert parsed["status"] == "completed"
    assert isinstance(parsed["metrics"]["residual_std"], float)
    assert isinstance(parsed["details"]["regional_metrics"], list)


def test_noise_no_fabrication_or_verdicts() -> None:
    data = make_gradient_image((50, 50))
    item = build_noise_analysis(data, "PNG")
    payload_str = json.dumps(item.model_dump()).lower()

    assert "is_fake" not in payload_str
    assert "is_authentic" not in payload_str
    assert "authenticity_score" not in payload_str
    assert "authenticity_percentage" not in payload_str
    assert "probability" not in payload_str
    assert "classification" not in payload_str
