"""Comprehensive unit and forensic tests for the Error Level Analysis (ELA) service."""

from __future__ import annotations

import base64
import json
from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from app.models.schemas import AnalysisItem, ELADetails
from app.services.ela import (
    DEFAULT_ELA_QUALITY,
    MAX_VISUALIZATION_DIMENSION,
    build_ela_analysis,
    compute_ela,
)
from tests.conftest import make_image_bytes


def make_patterned_jpeg(
    size: tuple[int, int] = (120, 80),
    quality: int = 80,
) -> bytes:
    """Generate a JPEG with textured regions and sharp contrast edges."""
    arr = np.zeros((size[1], size[0], 3), dtype=np.uint8)
    # Left half: flat color
    arr[:, : size[0] // 2] = [40, 80, 120]
    # Right half: high frequency checkerboard
    arr[::4, size[0] // 2 :] = [240, 240, 240]
    arr[1::4, size[0] // 2 :] = [10, 20, 30]

    img = Image.fromarray(arr)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def test_ela_jpeg_basic() -> None:
    data = make_image_bytes(fmt="JPEG", size=(64, 48), color=(30, 60, 90))
    item = build_ela_analysis(data, "JPEG")

    assert item.name == "ela"
    assert item.status == "completed"
    assert len(item.observations) > 0
    assert len(item.limitations) >= 5

    # Details check
    assert item.details is not None
    details = item.details
    if isinstance(details, dict):
        details = ELADetails.model_validate(details)
    assert isinstance(details, ELADetails)
    assert details.recompression_quality == DEFAULT_ELA_QUALITY
    assert details.scale_factor > 0

    # Metrics check
    metrics = item.metrics
    assert "mean_difference" in metrics
    assert "median_difference" in metrics
    assert "max_difference" in metrics
    assert "p95_difference" in metrics
    assert "p99_difference" in metrics
    assert "regional_mean_spread" in metrics
    assert "regional_variance_mean" in metrics


def test_ela_metrics_scales_and_types() -> None:
    data = make_patterned_jpeg(size=(100, 100), quality=75)
    item = build_ela_analysis(data, "JPEG")
    details = item.details
    if isinstance(details, dict):
        details = ELADetails.model_validate(details)

    # Values must be python native floats/ints
    assert type(details.mean_difference) is float
    assert type(details.median_difference) is float
    assert type(details.max_difference) is float
    assert type(details.p95_difference) is float
    assert type(details.p99_difference) is float

    # Range and ordering invariants
    assert 0.0 <= details.mean_difference <= details.max_difference <= 255.0
    assert 0.0 <= details.median_difference <= details.p95_difference <= details.p99_difference <= details.max_difference

    # Threshold percentages must be monotonically non-increasing
    t_pcts = details.threshold_percentages
    assert 100.0 >= t_pcts["above_5"] >= t_pcts["above_10"] >= t_pcts["above_20"] >= t_pcts["above_50"] >= 0.0


def test_ela_channel_metrics_present() -> None:
    data = make_patterned_jpeg(size=(60, 60))
    item = build_ela_analysis(data, "JPEG")
    details = item.details
    if isinstance(details, dict):
        details = ELADetails.model_validate(details)

    assert set(details.channel_means.keys()) == {"red", "green", "blue"}
    assert set(details.channel_maxes.keys()) == {"red", "green", "blue"}
    for ch in ("red", "green", "blue"):
        assert 0.0 <= details.channel_means[ch] <= 255.0
        assert 0.0 <= details.channel_maxes[ch] <= 255.0


def test_ela_deterministic() -> None:
    data = make_patterned_jpeg(size=(80, 60), quality=85)
    item1 = build_ela_analysis(data, "JPEG", quality=90)
    item2 = build_ela_analysis(data, "JPEG", quality=90)

    assert item1.metrics == item2.metrics
    assert item1.observations == item2.observations
    assert item1.details.difference_image_data_url == item2.details.difference_image_data_url


def test_ela_non_jpeg_unavailable() -> None:
    png_data = make_image_bytes(fmt="PNG", size=(32, 32))
    png_item = build_ela_analysis(png_data, "PNG")
    assert png_item.status == "unavailable"
    assert png_item.metrics == {}
    assert png_item.details is None
    assert any("not JPEG" in obs for obs in png_item.observations)
    assert any("PNG" in lim for lim in png_item.limitations)

    webp_data = make_image_bytes(fmt="WEBP", size=(32, 32))
    webp_item = build_ela_analysis(webp_data, "WEBP")
    assert webp_item.status == "unavailable"
    assert webp_item.details is None


def test_ela_configurable_quality() -> None:
    data = make_patterned_jpeg(size=(80, 80), quality=70)

    item_q95 = build_ela_analysis(data, "JPEG", quality=95)
    item_q60 = build_ela_analysis(data, "JPEG", quality=60)

    assert item_q95.metrics["recompression_quality"] == 95
    assert item_q60.metrics["recompression_quality"] == 60
    # Different recompression qualities produce distinct difference profiles
    assert item_q95.metrics["mean_difference"] != item_q60.metrics["mean_difference"]


def test_ela_invalid_quality_handling() -> None:
    data = make_image_bytes(fmt="JPEG", size=(32, 32))
    # compute_ela raises ValueError for out of bounds quality
    with pytest.raises(ValueError):
        compute_ela(data, quality=0)
    with pytest.raises(ValueError):
        compute_ela(data, quality=101)

    # build_ela_analysis catches defensively and returns status='failed'
    failed_item = build_ela_analysis(data, "JPEG", quality=150)
    assert failed_item.status == "failed"
    assert "could not be computed" in failed_item.observations[0]


def test_ela_corrupt_data_defensive() -> None:
    corrupt = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 50
    item = build_ela_analysis(corrupt, "JPEG")
    assert item.status == "failed"
    assert item.details is None
    assert len(item.observations) == 1
    assert "could not be computed" in item.observations[0]


def test_ela_visualization_data_url_valid() -> None:
    data = make_patterned_jpeg(size=(64, 48))
    item = build_ela_analysis(data, "JPEG")
    data_url = item.details.difference_image_data_url

    assert data_url is not None
    assert data_url.startswith("data:image/png;base64,")

    # Decode base64 and verify valid PNG bytes
    header, b64_payload = data_url.split(",", 1)
    png_bytes = base64.b64decode(b64_payload)
    with Image.open(BytesIO(png_bytes)) as decoded:
        assert decoded.format == "PNG"
        assert decoded.size == (64, 48)


def test_ela_custom_scale_factor() -> None:
    data = make_patterned_jpeg(size=(40, 40))
    item = build_ela_analysis(data, "JPEG", scale_factor=12.5)
    assert item.details.scale_factor == 12.5
    assert item.metrics["scale_factor"] == 12.5


def test_ela_regional_metrics_grid() -> None:
    data = make_patterned_jpeg(size=(100, 80))
    item = build_ela_analysis(data, "JPEG", grid_size=(4, 4))
    details = item.details
    if isinstance(details, dict):
        details = ELADetails.model_validate(details)

    assert len(details.regional_metrics) == 16
    for reg in details.regional_metrics:
        assert reg.region_id.startswith("r")
        assert 0 <= reg.row < 4
        assert 0 <= reg.col < 4
        assert reg.width > 0
        assert reg.height > 0
        assert reg.mean_difference >= 0.0
        assert reg.variance >= 0.0

    # Summary metrics
    assert "mean_min" in details.regional_summary
    assert "mean_max" in details.regional_summary
    assert "mean_spread" in details.regional_summary
    assert details.regional_summary["mean_spread"] == pytest.approx(
        details.regional_summary["mean_max"] - details.regional_summary["mean_min"]
    )


def test_ela_uniform_vs_textured_contrast() -> None:
    # Uniform solid color
    flat_data = make_image_bytes(fmt="JPEG", size=(80, 80), color=(100, 100, 100))
    flat_item = build_ela_analysis(flat_data, "JPEG")
    assert any("relatively uniform across spatial regions" in obs for obs in flat_item.observations)

    # Patterned with sharp edge contrast
    pattern_data = make_patterned_jpeg(size=(120, 80), quality=75)
    pattern_item = build_ela_analysis(pattern_data, "JPEG")
    assert any("Spatial variations" in obs or "uniform" in obs for obs in pattern_item.observations)


def test_ela_json_serialization() -> None:
    data = make_patterned_jpeg(size=(50, 50))
    item = build_ela_analysis(data, "JPEG")

    # Pydantic v2 JSON export
    raw_json = item.model_dump_json()
    parsed = json.loads(raw_json)

    assert parsed["name"] == "ela"
    assert parsed["status"] == "completed"
    assert isinstance(parsed["metrics"]["mean_difference"], float)
    assert isinstance(parsed["details"]["regional_metrics"], list)


def test_ela_large_image_preview_downsampled() -> None:
    # Construct an image exceeding MAX_VISUALIZATION_DIMENSION in width
    data = make_image_bytes(fmt="JPEG", size=(MAX_VISUALIZATION_DIMENSION + 200, 40))
    item = build_ela_analysis(data, "JPEG")
    assert item.status == "completed"

    data_url = item.details.difference_image_data_url
    _, b64_payload = data_url.split(",", 1)
    png_bytes = base64.b64decode(b64_payload)
    with Image.open(BytesIO(png_bytes)) as decoded:
        # Preview must be capped at MAX_VISUALIZATION_DIMENSION
        assert max(decoded.size) <= MAX_VISUALIZATION_DIMENSION


def test_ela_no_fabrication_or_verdicts() -> None:
    data = make_patterned_jpeg(size=(64, 48))
    item = build_ela_analysis(data, "JPEG")
    payload_str = json.dumps(item.model_dump()).lower()

    # Absolute ban on fake/authentic verdicts
    assert "is_fake" not in payload_str
    assert "is_authentic" not in payload_str
    assert "authenticity_score" not in payload_str
    assert "authenticity_percentage" not in payload_str
    assert "probability" not in payload_str
    assert "classification" not in payload_str
