"""Frequency Domain Analysis engine using 2D Fast Fourier Transform (FFT).

Mathematical Pipeline:
1. Decode image to RGB in memory.
2. Convert to grayscale luminance using standard ITU-R BT.601 coefficients:
       Y = 0.299 * R + 0.587 * G + 0.114 * B
3. Subtract luminance mean to eliminate the dominant DC component (zero spatial frequency).
4. Apply a 2D separable Hann window to reduce boundary discontinuities and spectral leakage:
       W(y, x) = w_H(y) * w_W(x)
5. Calculate the two-dimensional discrete Fourier transform using `numpy.fft.fft2`.
6. Center spatial frequencies with `numpy.fft.fftshift`, placing DC at (H // 2, W // 2).
7. Compute magnitude |F| and spectral power P = |F|^2.
8. Normalize radial frequency r relative to Nyquist boundaries:
       r(y, x) = sqrt((|y - c_y| / (H / 2))^2 + (|x - c_x| / (W / 2))^2)
9. Partition non-DC spectral power into three continuous, non-overlapping radial bands:
       - Low frequency:  0.00 < r < 0.10
       - Mid frequency:  0.10 <= r < 0.40
       - High frequency: r >= 0.40 (all remaining non-DC frequencies)
10. Calculate spectral centroid and normalized Shannon spectral entropy.
11. Generate a normalized log-magnitude visualization without altering analytical measurements.
12. Return cautious, factual observations and documented limitations.

This module does not classify images as real or fake, does not calculate
authenticity probabilities, and does not invent or hardcode metrics.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image

from app.models.schemas import AnalysisItem, FrequencyDetails

DEFAULT_FFT_MAX_DIMENSION: int = 2048
MAX_VISUALIZATION_DIMENSION: int = 1200
LOW_FREQ_CUTOFF: float = 0.10
MID_FREQ_CUTOFF: float = 0.40


@dataclass
class FrequencyResult:
    """Computed 2D FFT spectral metrics and visual artifacts."""

    image_format: str
    analysis_width: int
    analysis_height: int
    original_width: int
    original_height: int
    is_downsampled: bool
    window_function: str
    total_non_dc_power: float
    low_frequency_power: float
    mid_frequency_power: float
    high_frequency_power: float
    low_frequency_energy_pct: float
    mid_frequency_energy_pct: float
    high_frequency_energy_pct: float
    spectral_centroid: float
    spectral_entropy: float
    band_boundaries: dict[str, list[float]]
    visualization_data_url: str | None = None
    observations: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)


def _create_2d_hann(h: int, w: int) -> np.ndarray:
    """Construct a 2D separable Hann window function.

    Falls back to a rectangular window (ones) for dimensions <= 2 to prevent
    complete signal annihilation on tiny image dimensions.
    """
    wy = np.hanning(h) if h > 2 else np.ones(h, dtype=np.float64)
    wx = np.hanning(w) if w > 2 else np.ones(w, dtype=np.float64)
    return np.outer(wy, wx)


def _generate_spectrum_visualization(magnitude: np.ndarray) -> str:
    """Generate a base64-encoded PNG data URL of the centered log-magnitude spectrum.

    Uses logarithmic dynamic range compression: L = log(1 + |F|).
    Normalizes contrast safely to [0, 255] avoiding divide-by-zero on zero-energy spectra.
    """
    log_mag = np.log1p(magnitude)
    max_val = float(np.max(log_mag))
    scale = (255.0 / max_val) if max_val > 0.0 else 1.0
    scaled = np.clip(log_mag * scale, 0.0, 255.0).astype(np.uint8)
    vis_img = Image.fromarray(scaled)

    # Limit visualization preview size
    if max(vis_img.size) > MAX_VISUALIZATION_DIMENSION:
        preview = vis_img.copy()
        preview.thumbnail(
            (MAX_VISUALIZATION_DIMENSION, MAX_VISUALIZATION_DIMENSION),
            Image.Resampling.LANCZOS,
        )
    else:
        preview = vis_img

    buffer = BytesIO()
    preview.save(buffer, format="PNG", optimize=True)
    b64_str = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64_str}"


def compute_frequency_analysis(
    data: bytes,
    *,
    max_dimension: int = DEFAULT_FFT_MAX_DIMENSION,
    include_visualization: bool = True,
) -> FrequencyResult:
    """Compute 2D Fast Fourier Transform frequency domain analysis.

    Args:
        data: Validated image bytes.
        max_dimension: Maximum dimension for FFT analysis before downsampling.
        include_visualization: Whether to render and encode the spectrum image.

    Returns:
        FrequencyResult containing spectral band metrics, centroid, entropy,
        and generated observations/limitations.
    """
    with Image.open(BytesIO(data)) as raw_img:
        fmt = (raw_img.format or "UNKNOWN").upper()
        if fmt == "JPG":
            fmt = "JPEG"
        orig_w, orig_h = raw_img.size
        work_img = raw_img.convert("RGB") if raw_img.mode != "RGB" else raw_img.copy()

    try:
        # Transparent memory safety check: downsample analysis copy if image exceeds threshold
        is_downsampled = False
        if max(orig_w, orig_h) > max_dimension:
            is_downsampled = True
            work_img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        analysis_w, analysis_h = work_img.size

        # 1. Convert to float64 RGB and compute luminance via ITU-R BT.601
        rgb_arr = np.asarray(work_img, dtype=np.float64)
        luminance = 0.299 * rgb_arr[:, :, 0] + 0.587 * rgb_arr[:, :, 1] + 0.114 * rgb_arr[:, :, 2]

        # 2. Subtract luminance mean to suppress DC peak
        mean_val = float(np.mean(luminance))
        zero_mean = luminance - mean_val

        # 3. 2D Hann windowing
        window = _create_2d_hann(analysis_h, analysis_w)
        windowed = zero_mean * window

        # 4. 2D Fast Fourier Transform & Shift
        fft_raw = np.fft.fft2(windowed)
        fft_shifted = np.fft.fftshift(fft_raw)
        magnitude = np.abs(fft_shifted)
        power = magnitude ** 2

        # 5. Normalized radial frequency grid
        cy, cx = analysis_h // 2, analysis_w // 2
        y_coords = np.arange(analysis_h)[:, None]
        x_coords = np.arange(analysis_w)[None, :]
        fy = np.abs(y_coords - cy) / (analysis_h / 2.0) if analysis_h > 1 else np.zeros((analysis_h, 1), dtype=np.float64)
        fx = np.abs(x_coords - cx) / (analysis_w / 2.0) if analysis_w > 1 else np.zeros((1, analysis_w), dtype=np.float64)
        r = np.sqrt(fy ** 2 + fx ** 2)

        # 6. Non-DC frequency partitioning
        dc_mask = (y_coords == cy) & (x_coords == cx)
        non_dc_mask = ~dc_mask

        low_mask = non_dc_mask & (r < LOW_FREQ_CUTOFF)
        mid_mask = (r >= LOW_FREQ_CUTOFF) & (r < MID_FREQ_CUTOFF)
        high_mask = (r >= MID_FREQ_CUTOFF)

        # 7. Energy calculation across bands
        total_non_dc_power = float(np.sum(power[non_dc_mask]))
        low_power = float(np.sum(power[low_mask]))
        mid_power = float(np.sum(power[mid_mask]))
        high_power = float(np.sum(power[high_mask]))

        if total_non_dc_power > 0.0:
            low_pct = float((low_power / total_non_dc_power) * 100.0)
            mid_pct = float((mid_power / total_non_dc_power) * 100.0)
            high_pct = float((high_power / total_non_dc_power) * 100.0)
            spectral_centroid = float(np.sum(r[non_dc_mask] * power[non_dc_mask]) / total_non_dc_power)

            # Shannon spectral entropy normalized to [0, 1]
            p_norm = power[non_dc_mask] / total_non_dc_power
            p_pos = p_norm[p_norm > 0.0]
            k = len(power[non_dc_mask])
            spectral_entropy = float(-np.sum(p_pos * np.log(p_pos)) / np.log(k)) if k > 1 else 0.0
        else:
            low_pct = 0.0
            mid_pct = 0.0
            high_pct = 0.0
            spectral_centroid = 0.0
            spectral_entropy = 0.0

        band_boundaries = {
            "low": [0.0, LOW_FREQ_CUTOFF],
            "mid": [LOW_FREQ_CUTOFF, MID_FREQ_CUTOFF],
            "high": [MID_FREQ_CUTOFF, round(float(np.max(r)), 4) if r.size > 0 else 1.0],
        }

        vis_url = (
            _generate_spectrum_visualization(magnitude)
            if include_visualization
            else None
        )

        result = FrequencyResult(
            image_format=fmt,
            analysis_width=analysis_w,
            analysis_height=analysis_h,
            original_width=orig_w,
            original_height=orig_h,
            is_downsampled=is_downsampled,
            window_function="hann",
            total_non_dc_power=round(total_non_dc_power, 4),
            low_frequency_power=round(low_power, 4),
            mid_frequency_power=round(mid_power, 4),
            high_frequency_power=round(high_power, 4),
            low_frequency_energy_pct=round(low_pct, 2),
            mid_frequency_energy_pct=round(mid_pct, 2),
            high_frequency_energy_pct=round(high_pct, 2),
            spectral_centroid=round(spectral_centroid, 4),
            spectral_entropy=round(spectral_entropy, 4),
            band_boundaries=band_boundaries,
            visualization_data_url=vis_url,
        )

        result.observations = interpret_frequency(result)
        result.limitations = frequency_limitations(is_downsampled, (analysis_w, analysis_h))
        return result

    finally:
        work_img.close()


def interpret_frequency(result: FrequencyResult) -> list[str]:
    """Generate neutral, factual forensic observations from frequency metrics.

    Does not invent findings, make authenticity claims, or predict manipulation.
    """
    downsample_note = " (downsampled for memory safety)" if result.is_downsampled else ""
    observations: list[str] = [
        f"2D Fast Fourier Transform computed using {result.window_function.title()} windowing "
        f"on {result.analysis_width}x{result.analysis_height} luminance matrix{downsample_note}.",
        f"Spectral energy distribution: Low frequency (r < {LOW_FREQ_CUTOFF:.2f}): "
        f"{result.low_frequency_energy_pct:.2f}%, Mid frequency ({LOW_FREQ_CUTOFF:.2f} <= r < {MID_FREQ_CUTOFF:.2f}): "
        f"{result.mid_frequency_energy_pct:.2f}%, High frequency (r >= {MID_FREQ_CUTOFF:.2f}): "
        f"{result.high_frequency_energy_pct:.2f}%.",
        f"Spectral centroid is {result.spectral_centroid:.3f} (normalized radial frequency) "
        f"with normalized spectral entropy of {result.spectral_entropy:.3f}.",
    ]

    if result.total_non_dc_power == 0.0:
        observations.append("Image contains zero non-DC spectral energy (uniform constant luminance).")
    elif result.low_frequency_energy_pct >= 80.0:
        observations.append(
            "Spectral energy is predominantly concentrated in lower spatial frequencies, "
            "typical of smooth gradients, out-of-focus areas, and broad image structures."
        )
    elif result.high_frequency_energy_pct >= 50.0:
        observations.append(
            "A substantial proportion of spectral energy lies in higher spatial frequencies, "
            "consistent with fine textures, sharp transitions, or sensor noise."
        )
    else:
        observations.append(
            "Spectral energy is distributed across both lower and higher spatial frequencies, "
            "reflecting a combination of structural content and fine detail."
        )

    observations.append(
        "Frequency domain analysis evaluates spatial-frequency energy distribution via 2D FFT; "
        "it does not classify an image as real or fake, and cannot prove AI generation or manipulation."
    )

    return observations


def frequency_limitations(is_downsampled: bool, analysis_size: tuple[int, int]) -> list[str]:
    """Return standard forensic limitations for Frequency Domain Analysis."""
    limitations = [
        "Frequency domain patterns are strongly governed by image semantic content, sharp edges, and detailed textures.",
        "Lossy compression algorithms (such as JPEG DCT quantization), sharpening, downsampling, and denoising alter high-frequency spectral roll-off.",
        "Natural photographs, digital artwork, and generative AI outputs can exhibit overlapping frequency characteristics depending on resolution, content, and post-processing.",
        "2D FFT evaluates global spatial frequencies and does not isolate localized spatial manipulations or splices.",
    ]
    if is_downsampled:
        limitations.append(
            f"Analysis was performed on a downsampled {analysis_size[0]}x{analysis_size[1]} copy "
            "to prevent excessive memory usage during FFT calculation; fine pixel-level Nyquist frequencies "
            "of the original image were band-limited."
        )
    return limitations


def build_frequency_analysis(
    data: bytes,
    image_format: str,
    *,
    max_dimension: int = DEFAULT_FFT_MAX_DIMENSION,
    include_visualization: bool = True,
) -> AnalysisItem:
    """Run 2D FFT analysis and return a structured AnalysisItem.

    Supports JPEG, PNG, and WEBP formats.
    Handles corrupt bytes or unexpected errors defensively by returning status='failed'.
    """
    normalized_format = (image_format or "").upper()
    if normalized_format in {"JPG", "JPEG"}:
        normalized_format = "JPEG"

    if normalized_format not in {"JPEG", "PNG", "WEBP"}:
        return AnalysisItem(
            name="frequency",
            status="unavailable",
            observations=[
                f"Frequency domain analysis is unavailable for format '{image_format}'."
            ],
            metrics={},
            limitations=[
                "Frequency domain analysis requires decoding to RGB pixels and is only available for supported image formats.",
            ],
            details=None,
        )

    try:
        result = compute_frequency_analysis(
            data,
            max_dimension=max_dimension,
            include_visualization=include_visualization,
        )

        details = FrequencyDetails(
            analysis_width=result.analysis_width,
            analysis_height=result.analysis_height,
            original_width=result.original_width,
            original_height=result.original_height,
            is_downsampled=result.is_downsampled,
            window_function=result.window_function,
            total_non_dc_power=result.total_non_dc_power,
            low_frequency_power=result.low_frequency_power,
            mid_frequency_power=result.mid_frequency_power,
            high_frequency_power=result.high_frequency_power,
            low_frequency_energy_pct=result.low_frequency_energy_pct,
            mid_frequency_energy_pct=result.mid_frequency_energy_pct,
            high_frequency_energy_pct=result.high_frequency_energy_pct,
            spectral_centroid=result.spectral_centroid,
            spectral_entropy=result.spectral_entropy,
            band_boundaries=result.band_boundaries,
            visualization_data_url=result.visualization_data_url,
        )

        metrics: dict[str, Any] = {
            "total_non_dc_power": result.total_non_dc_power,
            "low_frequency_power": result.low_frequency_power,
            "mid_frequency_power": result.mid_frequency_power,
            "high_frequency_power": result.high_frequency_power,
            "low_frequency_energy_pct": result.low_frequency_energy_pct,
            "mid_frequency_energy_pct": result.mid_frequency_energy_pct,
            "high_frequency_energy_pct": result.high_frequency_energy_pct,
            "spectral_centroid": result.spectral_centroid,
            "spectral_entropy": result.spectral_entropy,
            "is_downsampled": result.is_downsampled,
        }

        return AnalysisItem(
            name="frequency",
            status="completed",
            observations=result.observations,
            metrics=metrics,
            limitations=result.limitations,
            details=details,
        )

    except Exception as exc:
        return AnalysisItem(
            name="frequency",
            status="failed",
            observations=[f"Frequency domain analysis could not be computed: {str(exc)}"],
            metrics={},
            limitations=frequency_limitations(False, (0, 0)),
            details=None,
        )
