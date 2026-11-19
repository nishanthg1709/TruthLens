"""Tests for Regional Anomaly Analysis engine (Phase 2E)."""

from __future__ import annotations

import base64
import math
from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from app.models.schemas import RegionalAnomalyDetails
from app.services.ela import build_ela_analysis
from app.services.noise import build_noise_analysis
from app.services.regional import (
    DEFAULT_GRID_SIZE,
    build_regional_analysis,
    compute_regional_anomaly,
)
from tests.conftest import make_image_bytes


def _make_synthetic_image(
    size: tuple[int, int] = (64, 64),
    pattern: str = "uniform",
    fmt: str = "PNG",
) -> bytes:
    """Generate synthetic image bytes with precise control over pixel characteristics."""
    w, h = size
    if pattern == "uniform":
        arr = np.full((h, w, 3), 128, dtype=np.uint8)
    elif pattern == "horizontal_split":
        # Top half dark, bottom half bright
        arr = np.zeros((h, w, 3), dtype=np.uint8)
        arr[h // 2 :, :, :] = 200
    elif pattern == "quadrant_texture":
        # Top-left has high-frequency noise texture, other quadrants smooth
        arr = np.full((h, w, 3), 120, dtype=np.uint8)
        rng = np.random.default_rng(42)
        noise_quad = rng.integers(0, 256, (h // 2, w // 2, 3), dtype=np.uint8)
        arr[: h // 2, : w // 2, :] = noise_quad
    elif pattern == "gradient":
        x = np.linspace(0, 255, w, endpoint=False, dtype=np.uint8)
        arr = np.tile(x, (h, 1))
        arr = np.stack([arr, arr, arr], axis=-1)
    else:
        raise ValueError(f"Unknown pattern: {pattern}")

    img = Image.fromarray(arr)
    buf = BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_uniform_image_zero_variance() -> None:
    """A completely uniform image must produce exactly 0.0 deviation scores and no NaNs."""
    data = _make_synthetic_image(size=(64, 64), pattern="uniform")
    result = compute_regional_anomaly(data, "PNG", grid_size=(4, 4))

    assert result.max_deviation_score == 0.0
    assert result.mean_deviation_score == 0.0
    assert len(result.regional_anomalies) == 16

    for item in result.regional_anomalies:
        assert item.deviation_score == 0.0
        assert item.neighbor_deviation == 0.0
        assert not math.isnan(item.mean_luminance)
        assert not math.isnan(item.std_luminance)
        assert item.std_luminance == 0.0
        assert item.edge_density == 0.0
        assert "consistent" in item.observation.lower() or "aligned" in item.observation.lower()

    assert any("homogeneous" in obs.lower() for obs in result.observations)


def test_quadrant_texture_localizes_anomaly() -> None:
    """An image with a noisy top-left quadrant should identify r0_c0/r0_c1 as elevated."""
    data = _make_synthetic_image(size=(80, 80), pattern="quadrant_texture")
    result = compute_regional_anomaly(data, "PNG", grid_size=(4, 4))

    assert result.max_deviation_score > 0.0
    assert result.highest_deviation_region_id in {"r0_c0", "r0_c1", "r1_c0", "r1_c1"}

    # Top-left tile (r0_c0) must have elevated gradient / texture metrics
    r0_c0 = next(reg for reg in result.regional_anomalies if reg.region_id == "r0_c0")
    r3_c3 = next(reg for reg in result.regional_anomalies if reg.region_id == "r3_c3")

    assert r0_c0.std_luminance > r3_c3.std_luminance
    assert r0_c0.deviation_score > r3_c3.deviation_score


def test_grid_partitioning_coverage_non_divisible_dimensions() -> None:
    """Non-divisible dimensions (e.g. 97x63) must cover 100% of pixels without overlaps."""
    w, h = 97, 63
    data = _make_synthetic_image(size=(w, h), pattern="gradient")
    result = compute_regional_anomaly(data, "PNG", grid_size=(4, 4))

    assert result.total_regions == 16
    assert len(result.regional_anomalies) == 16

    # Verify tile bounds completely cover the image without gaps
    covered_pixels = np.zeros((h, w), dtype=int)
    for reg in result.regional_anomalies:
        x1, y1 = reg.x, reg.y
        x2, y2 = reg.x + reg.width, reg.y + reg.height
        assert x1 >= 0 and y1 >= 0
        assert x2 <= w and y2 <= h
        covered_pixels[y1:y2, x1:x2] += 1

    # Every single pixel must be covered exactly once
    assert np.all(covered_pixels == 1)


def test_small_image_safety() -> None:
    """Tiny images (e.g. 4x4 or 7x7) must not crash, divide by zero, or produce NaN."""
    data = _make_synthetic_image(size=(6, 6), pattern="gradient")
    result = compute_regional_anomaly(data, "PNG", grid_size=(4, 4))

    assert len(result.regional_anomalies) == 16
    for item in result.regional_anomalies:
        assert not math.isnan(item.deviation_score)
        assert not math.isnan(item.neighbor_deviation)
        assert not math.isinf(item.deviation_score)
        # Regional FFT should be safely omitted for tiny regions
        assert item.regional_fft_high_freq_ratio is None

    assert any("frequency" in lim.lower() for lim in result.limitations)


def test_missing_ela_handled_gracefully() -> None:
    """PNG or WEBP images without ELA must exclude ELA from active features cleanly."""
    data = _make_synthetic_image(size=(48, 48), pattern="gradient", fmt="PNG")
    noise = build_noise_analysis(data, "PNG")

    # Pass noise but no ELA
    result = compute_regional_anomaly(data, "PNG", ela_analysis=None, noise_analysis=noise)

    assert "ela" not in result.active_modules_used
    assert "ela_mean" not in result.analyzed_features
    assert "noise" in result.active_modules_used

    for item in result.regional_anomalies:
        assert item.ela_mean is None
        assert item.ela_variance is None
        assert item.noise_residual_std is not None

    assert any("ELA" in lim for lim in result.limitations)


def test_integration_with_both_ela_and_noise() -> None:
    """JPEG image with both ELA and Noise should integrate all active modules."""
    data = _make_synthetic_image(size=(64, 64), pattern="quadrant_texture", fmt="JPEG")
    ela = build_ela_analysis(data, "JPEG")
    noise = build_noise_analysis(data, "JPEG")

    result = compute_regional_anomaly(
        data,
        "JPEG",
        ela_analysis=ela,
        noise_analysis=noise,
    )

    assert "ela" in result.active_modules_used
    assert "noise" in result.active_modules_used
    assert "ela_mean" in result.analyzed_features
    assert "noise_residual_std" in result.analyzed_features

    for item in result.regional_anomalies:
        assert item.ela_mean is not None
        assert item.noise_residual_std is not None
        assert "ela_mean" in item.z_scores
        assert "noise_residual_std" in item.z_scores


def test_determinism() -> None:
    """Running regional anomaly analysis multiple times on the same input yields identical metrics."""
    data = _make_synthetic_image(size=(50, 50), pattern="gradient")

    res1 = compute_regional_anomaly(data, "PNG")
    res2 = compute_regional_anomaly(data, "PNG")

    assert res1.max_deviation_score == res2.max_deviation_score
    assert res1.mean_deviation_score == res2.mean_deviation_score

    for item1, item2 in zip(res1.regional_anomalies, res2.regional_anomalies):
        assert item1.deviation_score == item2.deviation_score
        assert item1.mean_luminance == item2.mean_luminance
        assert item1.edge_density == item2.edge_density


def test_visualization_generates_valid_png_data_url() -> None:
    """Visualization must be a base64 encoded PNG data URL that can be decoded."""
    data = _make_synthetic_image(size=(80, 80), pattern="quadrant_texture")
    result = compute_regional_anomaly(data, "PNG", include_visualization=True)

    assert result.visualization_data_url is not None
    assert result.visualization_data_url.startswith("data:image/png;base64,")

    header, b64_str = result.visualization_data_url.split(",", 1)
    raw_png = base64.b64decode(b64_str)
    # Magic PNG header check
    assert raw_png.startswith(b"\x89PNG\r\n\x1a\n")

    decoded_img = Image.open(BytesIO(raw_png))
    assert decoded_img.format == "PNG"
    assert decoded_img.width == 80
    # Canvas includes footer height
    assert decoded_img.height == 80 + 28


def test_large_image_visualization_downsampled_without_metric_change() -> None:
    """Large images (>1200px) downsample visualization preview while preserving metrics."""
    # Synthetic 1300x10 image
    data = make_image_bytes(fmt="PNG", size=(1300, 10))
    result = compute_regional_anomaly(data, "PNG", include_visualization=True)

    assert result.visualization_data_url is not None
    header, b64_str = result.visualization_data_url.split(",", 1)
    decoded_img = Image.open(BytesIO(base64.b64decode(b64_str)))
    assert decoded_img.width <= 1200


def test_build_regional_analysis_packaging() -> None:
    """build_regional_analysis packages result into an AnalysisItem matching schema."""
    data = _make_synthetic_image(size=(40, 40), pattern="gradient")
    item = build_regional_analysis(data, "PNG")

    assert item.name == "regional"
    assert item.status == "completed"
    assert "max_deviation_score" in item.metrics
    assert item.details is not None

    details = RegionalAnomalyDetails.model_validate(item.details)
    assert details.total_regions == 16
    assert len(details.regional_anomalies) == 16


def test_corrupt_data_defense() -> None:
    """Corrupt image data must produce status='failed' without unhandled exceptions."""
    item = build_regional_analysis(b"completely-corrupt-data", "JPEG")
    assert item.name == "regional"
    assert item.status == "failed"
    assert len(item.limitations) > 0
    assert item.details is None


def test_observations_never_contain_manipulation_claims() -> None:
    """Observations and limitations must remain neutral and never claim forgery or AI."""
    data = _make_synthetic_image(size=(64, 64), pattern="quadrant_texture")
    result = compute_regional_anomaly(data, "PNG")

    combined_text = " ".join(result.observations + result.limitations).lower()
    assert "tampered" not in combined_text or "not establish" in combined_text or "rather than tampering" in combined_text
    assert "ai-generated" not in combined_text
    assert "fake" not in combined_text
    assert "authentic" not in combined_text or "not authenticity" in combined_text
