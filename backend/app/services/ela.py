"""Error Level Analysis (ELA) engine for JPEG image forensics.

Algorithm:
1. Decode the original validated JPEG to RGB.
2. Recompress it at a controlled quality level (default 90) in memory.
3. Decode the recompressed version into RGB.
4. Verify identical dimensions between original and recompressed images.
5. Compute the absolute pixel difference matrix across RGB channels.
6. Normalize the difference matrix for visualization.
7. Compute image-level and regional difference metrics.
8. Generate factual forensic observations and limitations.

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

from app.models.schemas import AnalysisItem, ELADetails, RegionalMetric
from app.utils.image_io import partition_grid

DEFAULT_ELA_QUALITY: int = 90
DEFAULT_GRID_SIZE: tuple[int, int] = (4, 4)
DEFAULT_THRESHOLDS: tuple[int, ...] = (5, 10, 15, 20, 30, 50)
MAX_VISUALIZATION_DIMENSION: int = 1200


@dataclass
class ELAResult:
    """Computed ELA metrics and visual artifacts."""

    image_format: str
    recompression_quality: int
    scale_factor: float
    mean_difference: float
    median_difference: float
    max_difference: float
    p95_difference: float
    p99_difference: float
    threshold_percentages: dict[str, float]
    channel_means: dict[str, float]
    channel_maxes: dict[str, float]
    regional_metrics: list[RegionalMetric]
    regional_summary: dict[str, float]
    difference_image_data_url: str | None = None
    observations: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)


# Alias shared utility for backwards compatibility
_partition_grid = partition_grid


def _generate_visualization_data_url(
    diff_arr: np.ndarray,
    scale_factor: float,
) -> str:
    """Generate a base64-encoded PNG data URL of the normalized difference image.

    Large difference images are downsampled for preview to keep JSON response sizes
    manageable without sacrificing visual fidelity.
    """
    # Scale difference values and clip to valid uint8 range [0, 255]
    scaled = np.clip(diff_arr.astype(np.float32) * scale_factor, 0, 255).astype(np.uint8)
    norm_img = Image.fromarray(scaled)

    # Limit preview dimensions for responsive data URL transfer
    if max(norm_img.size) > MAX_VISUALIZATION_DIMENSION:
        preview = norm_img.copy()
        preview.thumbnail(
            (MAX_VISUALIZATION_DIMENSION, MAX_VISUALIZATION_DIMENSION),
            Image.Resampling.LANCZOS,
        )
    else:
        preview = norm_img

    buffer = BytesIO()
    preview.save(buffer, format="PNG", optimize=True)
    b64_str = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64_str}"


def compute_ela(
    data: bytes,
    *,
    quality: int = DEFAULT_ELA_QUALITY,
    scale_factor: float | None = None,
    grid_size: tuple[int, int] = DEFAULT_GRID_SIZE,
    include_visualization: bool = True,
) -> ELAResult:
    """Compute Error Level Analysis on JPEG image bytes.

    Args:
        data: Validated JPEG file bytes.
        quality: Recompression JPEG quality level (1-100, default 90).
        scale_factor: Optional fixed visualization scaling factor. If None,
            dynamically computed to map maximum difference to 255.
        grid_size: (rows, cols) tile partition for regional metrics.
        include_visualization: Whether to render and encode the difference image.

    Returns:
        ELAResult containing calculated difference metrics, regional analysis,
        and generated observations/limitations.
    """
    if quality < 1 or quality > 100:
        raise ValueError(f"Quality must be between 1 and 100, got {quality}")

    # 1. Decode original to RGB
    with Image.open(BytesIO(data)) as raw_img:
        orig_rgb = raw_img.convert("RGB") if raw_img.mode != "RGB" else raw_img.copy()

    try:
        # 2. Recompress in memory at the controlled quality level
        recomp_buf = BytesIO()
        orig_rgb.save(recomp_buf, format="JPEG", quality=quality)
        recomp_buf.seek(0)

        # 3. Decode recompressed version to RGB
        with Image.open(recomp_buf) as recomp_img:
            recomp_rgb = recomp_img.convert("RGB")

        try:
            # 4. Ensure identical dimensions
            if orig_rgb.size != recomp_rgb.size:
                raise ValueError(
                    f"Image dimension mismatch after recompression: "
                    f"{orig_rgb.size} vs {recomp_rgb.size}"
                )

            # 5. Compute absolute pixel difference across RGB channels
            orig_arr = np.asarray(orig_rgb, dtype=np.int16)
            recomp_arr = np.asarray(recomp_rgb, dtype=np.int16)
            diff_arr = np.abs(orig_arr - recomp_arr)  # Shape (H, W, 3), range [0, 255]

            # Image-level global statistics (scale 0-255)
            mean_diff = float(np.mean(diff_arr))
            median_diff = float(np.median(diff_arr))
            max_diff = float(np.max(diff_arr))
            p95_diff = float(np.percentile(diff_arr, 95))
            p99_diff = float(np.percentile(diff_arr, 99))

            # Channel-level statistics
            channel_means = {
                "red": round(float(np.mean(diff_arr[:, :, 0])), 4),
                "green": round(float(np.mean(diff_arr[:, :, 1])), 4),
                "blue": round(float(np.mean(diff_arr[:, :, 2])), 4),
            }
            channel_maxes = {
                "red": round(float(np.max(diff_arr[:, :, 0])), 4),
                "green": round(float(np.max(diff_arr[:, :, 1])), 4),
                "blue": round(float(np.max(diff_arr[:, :, 2])), 4),
            }

            # Threshold exceedance percentages
            # Measured as percentage of pixels whose maximum channel difference >= threshold
            pixel_max_diff = np.max(diff_arr, axis=2)
            total_pixels = int(orig_rgb.width * orig_rgb.height)
            threshold_percentages: dict[str, float] = {}
            for t in DEFAULT_THRESHOLDS:
                count = int(np.count_nonzero(pixel_max_diff >= t))
                pct = round((count / total_pixels) * 100.0, 2) if total_pixels > 0 else 0.0
                threshold_percentages[f"above_{t}"] = pct

            # Regional difference metrics (grid partitioning)
            tiles = _partition_grid(orig_rgb.width, orig_rgb.height, grid_size)
            regional_metrics: list[RegionalMetric] = []
            regional_means: list[float] = []
            regional_variances: list[float] = []

            for r, c, x1, y1, x2, y2, region_id in tiles:
                block = diff_arr[y1:y2, x1:x2]
                if block.size == 0:
                    continue
                b_mean = float(np.mean(block))
                b_var = float(np.var(block))
                b_max = float(np.max(block))
                regional_means.append(b_mean)
                regional_variances.append(b_var)
                regional_metrics.append(
                    RegionalMetric(
                        region_id=region_id,
                        row=r,
                        col=c,
                        x=x1,
                        y=y1,
                        width=x2 - x1,
                        height=y2 - y1,
                        mean_difference=round(b_mean, 4),
                        variance=round(b_var, 4),
                        max_difference=round(b_max, 4),
                    )
                )

            regional_summary: dict[str, float] = {
                "mean_min": round(min(regional_means), 4) if regional_means else 0.0,
                "mean_max": round(max(regional_means), 4) if regional_means else 0.0,
                "mean_spread": round(max(regional_means) - min(regional_means), 4)
                if regional_means
                else 0.0,
                "variance_min": round(min(regional_variances), 4) if regional_variances else 0.0,
                "variance_max": round(max(regional_variances), 4) if regional_variances else 0.0,
                "variance_mean": round(float(np.mean(regional_variances)), 4)
                if regional_variances
                else 0.0,
            }

            # Visualization scaling: auto-normalize to full 255 range if not explicitly given
            if scale_factor is not None:
                effective_scale = float(scale_factor)
            else:
                effective_scale = round(float(255.0 / max_diff), 2) if max_diff > 0 else 1.0

            data_url = (
                _generate_visualization_data_url(diff_arr, effective_scale)
                if include_visualization
                else None
            )

            result = ELAResult(
                image_format="JPEG",
                recompression_quality=quality,
                scale_factor=effective_scale,
                mean_difference=round(mean_diff, 4),
                median_difference=round(median_diff, 4),
                max_difference=round(max_diff, 4),
                p95_difference=round(p95_diff, 4),
                p99_difference=round(p99_diff, 4),
                threshold_percentages=threshold_percentages,
                channel_means=channel_means,
                channel_maxes=channel_maxes,
                regional_metrics=regional_metrics,
                regional_summary=regional_summary,
                difference_image_data_url=data_url,
            )

            result.observations = interpret_ela(result)
            result.limitations = ela_limitations(quality)
            return result

        finally:
            recomp_rgb.close()
    finally:
        orig_rgb.close()


def interpret_ela(result: ELAResult) -> list[str]:
    """Generate factual forensic observations from actual ELA metrics.

    Does not invent findings or fabricate authenticity scores.
    """
    observations: list[str] = [
        f"JPEG Error Level Analysis evaluated with recompression quality {result.recompression_quality}."
    ]

    observations.append(
        f"Global mean absolute difference is {result.mean_difference:.2f} on a 0–255 scale "
        f"(maximum observed: {int(result.max_difference)})."
    )

    observations.append(
        f"Median difference is {result.median_difference:.2f}; 95th percentile is "
        f"{result.p95_difference:.2f}, and 99th percentile is {result.p99_difference:.2f}."
    )

    above_10 = result.threshold_percentages.get("above_10", 0.0)
    above_20 = result.threshold_percentages.get("above_20", 0.0)
    observations.append(
        f"{above_10:.1f}% of pixels exceed an error threshold of 10, and "
        f"{above_20:.1f}% exceed a threshold of 20."
    )

    spread = result.regional_summary.get("mean_spread", 0.0)
    mean_min = result.regional_summary.get("mean_min", 0.0)
    mean_max = result.regional_summary.get("mean_max", 0.0)

    if spread < 3.0:
        observations.append(
            f"Error level is relatively uniform across spatial regions "
            f"(regional mean spread: {spread:.2f}, range {mean_min:.2f}–{mean_max:.2f})."
        )
    else:
        observations.append(
            f"Spatial variations in error levels observed across image regions "
            f"(regional mean range: {mean_min:.2f} to {mean_max:.2f}, spread: {spread:.2f}). "
            f"This can reflect varying edge density, texture detail, or differing compression histories."
        )

    observations.append(
        "Higher error levels naturally concentrate along sharp edges, detailed textures, "
        "and high-frequency content due to DCT quantization."
    )

    observations.append(
        "Error Level Analysis provides relative compression error metrics; it does not "
        "compute authenticity scores or determine whether an image is real or fake."
    )

    return observations


def ela_limitations(quality: int = DEFAULT_ELA_QUALITY) -> list[str]:
    """Return standard forensic limitations for Error Level Analysis."""
    return [
        "Error Level Analysis indicates compression error relative to a recompression baseline, not absolute authenticity.",
        "High-frequency content, textures, and edges naturally produce higher error levels under JPEG quantization.",
        "Multiple re-saves, resamplings, and varying JPEG quantization tables alter error patterns non-linearly.",
        "Uniform error levels do not guarantee absence of manipulation, nor do localized error variations prove forgery.",
        f"Results depend on the selected baseline recompression quality (evaluated at quality {quality}).",
    ]


def build_ela_analysis(
    data: bytes,
    image_format: str,
    *,
    quality: int = DEFAULT_ELA_QUALITY,
    scale_factor: float | None = None,
    grid_size: tuple[int, int] = DEFAULT_GRID_SIZE,
    include_visualization: bool = True,
) -> AnalysisItem:
    """Run ELA computation and return a structured AnalysisItem.

    Handles non-JPEG formats gracefully by returning status='unavailable'.
    Catches unhandled decode/compute exceptions defensively by returning status='failed'.
    """
    normalized_format = (image_format or "").upper()
    if normalized_format in {"JPG", "JPEG"}:
        normalized_format = "JPEG"

    if normalized_format != "JPEG":
        return AnalysisItem(
            name="ela",
            status="unavailable",
            observations=[
                f"Error Level Analysis was skipped: image format '{image_format}' is not JPEG."
            ],
            metrics={},
            limitations=[
                "Error Level Analysis is specifically designed for JPEG lossy compression artifacts.",
                "Lossless formats (such as PNG) or alternative compression schemes (such as WEBP) "
                "do not exhibit standard JPEG discrete cosine transform (DCT) quantization error levels.",
            ],
            details=None,
        )

    try:
        result = compute_ela(
            data,
            quality=quality,
            scale_factor=scale_factor,
            grid_size=grid_size,
            include_visualization=include_visualization,
        )

        details = ELADetails(
            recompression_quality=result.recompression_quality,
            scale_factor=result.scale_factor,
            mean_difference=result.mean_difference,
            median_difference=result.median_difference,
            max_difference=result.max_difference,
            p95_difference=result.p95_difference,
            p99_difference=result.p99_difference,
            threshold_percentages=result.threshold_percentages,
            channel_means=result.channel_means,
            channel_maxes=result.channel_maxes,
            regional_metrics=result.regional_metrics,
            regional_summary=result.regional_summary,
            difference_image_data_url=result.difference_image_data_url,
        )

        metrics: dict[str, Any] = {
            "recompression_quality": result.recompression_quality,
            "scale_factor": result.scale_factor,
            "mean_difference": result.mean_difference,
            "median_difference": result.median_difference,
            "max_difference": result.max_difference,
            "p95_difference": result.p95_difference,
            "p99_difference": result.p99_difference,
            "pixels_above_threshold_5_pct": result.threshold_percentages.get("above_5", 0.0),
            "pixels_above_threshold_10_pct": result.threshold_percentages.get("above_10", 0.0),
            "pixels_above_threshold_20_pct": result.threshold_percentages.get("above_20", 0.0),
            "pixels_above_threshold_50_pct": result.threshold_percentages.get("above_50", 0.0),
            "regional_mean_min": result.regional_summary.get("mean_min", 0.0),
            "regional_mean_max": result.regional_summary.get("mean_max", 0.0),
            "regional_mean_spread": result.regional_summary.get("mean_spread", 0.0),
            "regional_variance_mean": result.regional_summary.get("variance_mean", 0.0),
            "regional_variance_max": result.regional_summary.get("variance_max", 0.0),
        }

        return AnalysisItem(
            name="ela",
            status="completed",
            observations=result.observations,
            metrics=metrics,
            limitations=result.limitations,
            details=details,
        )

    except Exception as exc:
        return AnalysisItem(
            name="ela",
            status="failed",
            observations=[f"Error Level Analysis could not be computed: {str(exc)}"],
            metrics={},
            limitations=ela_limitations(quality),
            details=None,
        )
