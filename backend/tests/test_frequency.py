"""Comprehensive unit and forensic tests for the 2D FFT Frequency Domain Analysis service."""

from __future__ import annotations

import base64
import json
from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from app.models.schemas import FrequencyDetails
from app.services.frequency import (
    DEFAULT_FFT_MAX_DIMENSION,
    LOW_FREQ_CUTOFF,
    MAX_VISUALIZATION_DIMENSION,
    MID_FREQ_CUTOFF,
    build_frequency_analysis,
    compute_frequency_analysis,
)
from tests.conftest import make_image_bytes


def make_sinusoid_image(
    size: tuple[int, int] = (64, 64),
    frequency: float = 2.0,
    axis: str = "horizontal",
    fmt: str = "PNG",
) -> bytes:
    """Generate a 2D sinusoidal luminance pattern."""
    w, h = size
    if axis == "horizontal":
        x = np.arange(w)[None, :]
        pattern = 128.0 + 100.0 * np.sin(2 * np.pi * frequency * x / w)
        arr = np.tile(pattern, (h, 1))
    elif axis == "vertical":
        y = np.arange(h)[:, None]
        pattern = 128.0 + 100.0 * np.sin(2 * np.pi * frequency * y / h)
        arr = np.tile(pattern, (1, w))
    else:
        raise ValueError(f"Unknown axis {axis}")

    arr_rgb = np.repeat(np.clip(arr, 0, 255).astype(np.uint8)[:, :, None], 3, axis=2)
    img = Image.fromarray(arr_rgb)
    buf = BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def make_checkerboard_image(size: tuple[int, int] = (64, 64), fmt: str = "PNG") -> bytes:
    """Generate a high-frequency alternating checkerboard."""
    w, h = size
    arr = np.zeros((h, w), dtype=np.uint8)
    arr[::2, ::2] = 255
    arr[1::2, 1::2] = 255
    arr_rgb = np.repeat(arr[:, :, None], 3, axis=2)
    img = Image.fromarray(arr_rgb)
    buf = BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def make_impulse_image(size: tuple[int, int] = (64, 64), fmt: str = "PNG") -> bytes:
    """Generate an image with a single pixel delta impulse at center."""
    w, h = size
    arr = np.zeros((h, w), dtype=np.uint8)
    arr[h // 2, w // 2] = 255
    arr_rgb = np.repeat(arr[:, :, None], 3, axis=2)
    img = Image.fromarray(arr_rgb)
    buf = BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# --- Mathematical and Pipeline Tests ---


def test_frequency_basic() -> None:
    data = make_sinusoid_image((64, 64), frequency=2.0)
    item = build_frequency_analysis(data, "PNG")

    assert item.name == "frequency"
    assert item.status == "completed"
    assert len(item.observations) > 0
    assert len(item.limitations) >= 4

    assert item.details is not None
    details = item.details
    if isinstance(details, dict):
        details = FrequencyDetails.model_validate(details)
    assert isinstance(details, FrequencyDetails)

    # Invariants
    assert details.total_non_dc_power >= 0.0
    assert details.low_frequency_power >= 0.0
    assert details.mid_frequency_power >= 0.0
    assert details.high_frequency_power >= 0.0

    # Percentages must sum to ~100%
    pct_sum = (
        details.low_frequency_energy_pct
        + details.mid_frequency_energy_pct
        + details.high_frequency_energy_pct
    )
    assert pct_sum == pytest.approx(100.0, abs=0.1)


def test_frequency_energy_percentages_sum_to_100() -> None:
    for shape in [(64, 64), (101, 73), (32, 48)]:
        data = make_sinusoid_image(shape, frequency=5.0)
        result = compute_frequency_analysis(data)
        pct_sum = (
            result.low_frequency_energy_pct
            + result.mid_frequency_energy_pct
            + result.high_frequency_energy_pct
        )
        assert pct_sum == pytest.approx(100.0, abs=0.1)


def test_frequency_spectral_centroid_and_entropy_bounds() -> None:
    data = make_sinusoid_image((60, 60), frequency=3.0)
    result = compute_frequency_analysis(data)

    assert 0.0 <= result.spectral_centroid <= 1.4142
    assert 0.0 <= result.spectral_entropy <= 1.0


# --- Synthetic Pattern Tests ---


def test_frequency_constant_image() -> None:
    data = make_image_bytes(fmt="PNG", size=(40, 40), color=(128, 128, 128))
    result = compute_frequency_analysis(data)

    # Mean subtraction eliminates flat field; non-DC power is 0
    assert result.total_non_dc_power == pytest.approx(0.0, abs=1e-5)
    assert result.low_frequency_energy_pct == 0.0
    assert result.mid_frequency_energy_pct == 0.0
    assert result.high_frequency_energy_pct == 0.0
    assert result.spectral_centroid == 0.0
    assert result.spectral_entropy == 0.0
    assert any("zero non-DC spectral energy" in obs for obs in result.observations)


def test_frequency_horizontal_vs_vertical_sinusoid() -> None:
    h_data = make_sinusoid_image((64, 64), frequency=2.0, axis="horizontal")
    v_data = make_sinusoid_image((64, 64), frequency=2.0, axis="vertical")

    res_h = compute_frequency_analysis(h_data)
    res_v = compute_frequency_analysis(v_data)

    # Both low-frequency sinusoids must concentrate overwhelmingly in the low band
    assert res_h.low_frequency_energy_pct > 90.0
    assert res_v.low_frequency_energy_pct > 90.0


def test_frequency_checkerboard_high_frequency() -> None:
    data = make_checkerboard_image((64, 64))
    result = compute_frequency_analysis(data)

    # Checkerboard is maximum spatial frequency (Nyquist corner)
    assert result.high_frequency_energy_pct > 95.0
    assert result.low_frequency_energy_pct < 5.0
    # Spectral centroid must reflect high-frequency energy
    assert result.spectral_centroid > MID_FREQ_CUTOFF


def test_frequency_impulse_broadband_entropy() -> None:
    data = make_impulse_image((64, 64))
    result = compute_frequency_analysis(data)

    # Delta impulse has flat theoretical spectrum -> high entropy
    assert result.spectral_entropy > 0.80
    assert result.total_non_dc_power > 0.0


# --- Robustness & Dimension Tests ---


def test_frequency_tiny_images() -> None:
    for size in [(1, 1), (2, 2), (1, 7), (7, 1)]:
        data = make_image_bytes(fmt="PNG", size=size, color=(100, 150, 200))
        item = build_frequency_analysis(data, "PNG")
        assert item.status == "completed"
        assert item.details is not None


def test_frequency_odd_and_uneven_dimensions() -> None:
    for size in [(63, 47), (101, 73), (33, 33)]:
        data = make_sinusoid_image(size, frequency=2.0)
        item = build_frequency_analysis(data, "PNG")
        assert item.status == "completed"
        assert item.details.analysis_width == size[0]
        assert item.details.analysis_height == size[1]


def test_frequency_deterministic_execution() -> None:
    data = make_sinusoid_image((50, 50), frequency=3.0)
    item1 = build_frequency_analysis(data, "PNG")
    item2 = build_frequency_analysis(data, "PNG")

    assert item1.metrics == item2.metrics
    assert item1.observations == item2.observations
    assert item1.details.visualization_data_url == item2.details.visualization_data_url


def test_frequency_corrupt_input_defensive() -> None:
    corrupt = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\xff" * 50
    item = build_frequency_analysis(corrupt, "PNG")
    assert item.status == "failed"
    assert item.details is None
    assert len(item.observations) == 1
    assert "could not be computed" in item.observations[0]


def test_frequency_unsupported_format() -> None:
    item = build_frequency_analysis(b"dummy", "TIFF")
    assert item.status == "unavailable"
    assert item.details is None


# --- Memory and Downsampling Tests ---


def test_frequency_downsampling_for_large_images() -> None:
    # Set max_dimension=100 and pass 160x80 image
    data = make_sinusoid_image((160, 80), frequency=2.0)
    result = compute_frequency_analysis(data, max_dimension=100)

    assert result.is_downsampled is True
    assert result.original_width == 160
    assert result.original_height == 80
    assert max(result.analysis_width, result.analysis_height) <= 100
    assert any("downsampled" in obs for obs in result.observations)
    assert any("downsampled" in lim for lim in result.limitations)


# --- Visualization Tests ---


def test_frequency_visualization_data_url_valid() -> None:
    data = make_sinusoid_image((60, 40), frequency=2.0)
    item = build_frequency_analysis(data, "PNG")
    data_url = item.details.visualization_data_url

    assert data_url is not None
    assert data_url.startswith("data:image/png;base64,")

    header, b64_payload = data_url.split(",", 1)
    raw_png = base64.b64decode(b64_payload)
    with Image.open(BytesIO(raw_png)) as decoded:
        assert decoded.format == "PNG"
        assert decoded.size == (60, 40)


def test_frequency_large_visualization_downsampled() -> None:
    data = make_image_bytes(fmt="PNG", size=(MAX_VISUALIZATION_DIMENSION + 200, 30))
    item = build_frequency_analysis(data, "PNG", max_dimension=MAX_VISUALIZATION_DIMENSION + 300)
    assert item.status == "completed"

    data_url = item.details.visualization_data_url
    _, b64_payload = data_url.split(",", 1)
    raw_png = base64.b64decode(b64_payload)
    with Image.open(BytesIO(raw_png)) as decoded:
        assert max(decoded.size) <= MAX_VISUALIZATION_DIMENSION


# --- Forensic Integrity Tests ---


def test_frequency_no_fabrication_or_verdicts() -> None:
    data = make_sinusoid_image((50, 50), frequency=2.0)
    item = build_frequency_analysis(data, "PNG")
    payload_str = json.dumps(item.model_dump()).lower()

    assert "is_fake" not in payload_str
    assert "is_authentic" not in payload_str
    assert "authenticity_score" not in payload_str
    assert "authenticity_percentage" not in payload_str
    assert "probability" not in payload_str
    assert "classification" not in payload_str
