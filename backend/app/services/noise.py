"""Noise Residual Analysis engine for image forensics.

Mathematical Model:
    Residual = Original Image - Smoothed Image

Algorithm:
1. Decode the image to RGB.
2. Convert original RGB channels to float32.
3. Apply a Gaussian low-pass filter to each channel using a documented sigma value.
4. Convert smoothed RGB channels to float32.
5. Compute signed residual matrix: Residual = Original - Smoothed.
6. Preserve signed residual values for statistical calculations.
7. Compute magnitude (absolute residual) for distribution metrics and visualization.
8. Partition into a spatial grid to compute regional mean, standard deviation, and peak metrics.
9. Normalize a separate visualization array without altering analytical measurements.
10. Generate neutral, factual observations and forensic limitations.

This module does not classify images as real or fake, does not calculate
authenticity probabilities, and does not invent or hardcode metrics.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image, ImageFilter

from app.models.schemas import AnalysisItem, NoiseDetails, RegionalNoiseMetric
from app.utils.image_io import partition_grid

DEFAULT_SMOOTHING_SIGMA: float = 1.0
DEFAULT_GRID_SIZE: tuple[int, int] = (4, 4)
MAX_VISUALIZATION_DIMENSION: int = 1200


@dataclass
class NoiseResult:
    """Computed noise residual metrics and visual artifacts."""

    image_format: str
    smoothing_sigma: float
    residual_mean: float
    residual_std: float
    mean_absolute_residual: float
    median_absolute_residual: float
    max_absolute_residual: float
    p95_absolute_residual: float
    p99_absolute_residual: float
    channel_residual_means: dict[str, float]
    channel_residual_stds: dict[str, float]
    channel_mean_absolute_residuals: dict[str, float]
    regional_metrics: list[RegionalNoiseMetric]
    regional_summary: dict[str, float]
    visualization_data_url: str | None = None
    observations: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)


def _generate_visualization_data_url(
    abs_residual: np.ndarray,
) -> str:
    """Generate a base64-encoded PNG data URL of the normalized residual magnitude.

    Prevents divide-by-zero for constant residual images. Large images are
    downsampled for the preview to keep JSON response sizes manageable without
    sacrificing visual clarity.
    """
    max_val = float(np.max(abs_residual))
    # Normalize contrast: stretch peak absolute residual to 255; avoid divide-by-zero
    scale = (255.0 / max_val) if max_val > 0.0 else 1.0
    scaled = np.clip(abs_residual * scale, 0.0, 255.0).astype(np.uint8)
    vis_img = Image.fromarray(scaled)

    # Downsample preview if dimensions exceed threshold
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


def compute_noise_residual(
    data: bytes,
    *,
    sigma: float = DEFAULT_SMOOTHING_SIGMA,
    grid_size: tuple[int, int] = DEFAULT_GRID_SIZE,
    include_visualization: bool = True,
) -> NoiseResult:
    """Compute Noise Residual Analysis on image bytes.

    Args:
        data: Validated image bytes.
        sigma: Standard deviation for Gaussian low-pass filter (must be > 0).
        grid_size: (rows, cols) tile partition for regional metrics.
        include_visualization: Whether to render and encode the residual image.

    Returns:
        NoiseResult containing residual distribution metrics, regional metrics,
        and generated observations/limitations.
    """
    if sigma <= 0.0:
        raise ValueError(f"Smoothing sigma must be positive, got {sigma}")

    # 1. Decode original to RGB
    with Image.open(BytesIO(data)) as raw_img:
        image_format = (raw_img.format or "UNKNOWN").upper()
        if image_format == "JPG":
            image_format = "JPEG"
        orig_rgb = raw_img.convert("RGB") if raw_img.mode != "RGB" else raw_img.copy()

    try:
        # 2. Apply Gaussian low-pass filter to RGB image
        smoothed_img = orig_rgb.filter(ImageFilter.GaussianBlur(radius=sigma))

        try:
            # 3. Convert to float32 arrays
            orig_arr = np.asarray(orig_rgb, dtype=np.float32)
            smoothed_arr = np.asarray(smoothed_img, dtype=np.float32)

            # 4. Calculate signed residual: Residual = Original - Smoothed
            residual = orig_arr - smoothed_arr  # Shape (H, W, 3), range [-255, 255]

            # 5. Calculate magnitude (absolute residual)
            abs_residual = np.abs(residual)

            # Global signed residual statistics
            res_mean = float(np.mean(residual))
            res_std = float(np.std(residual))

            # Magnitude statistics
            mean_abs = float(np.mean(abs_residual))
            median_abs = float(np.median(abs_residual))
            max_abs = float(np.max(abs_residual))
            p95_abs = float(np.percentile(abs_residual, 95))
            p99_abs = float(np.percentile(abs_residual, 99))

            # Channel-level statistics
            ch_names = ("red", "green", "blue")
            ch_means: dict[str, float] = {}
            ch_stds: dict[str, float] = {}
            ch_mean_abs: dict[str, float] = {}

            for idx, name in enumerate(ch_names):
                ch_res = residual[:, :, idx]
                ch_abs = abs_residual[:, :, idx]
                ch_means[name] = round(float(np.mean(ch_res)), 4)
                ch_stds[name] = round(float(np.std(ch_res)), 4)
                ch_mean_abs[name] = round(float(np.mean(ch_abs)), 4)

            # Regional residual statistics (shared grid partition)
            tiles = partition_grid(orig_rgb.width, orig_rgb.height, grid_size)
            regional_metrics: list[RegionalMetric] = []
            regional_means: list[float] = []
            regional_stds: list[float] = []

            for r, c, x1, y1, x2, y2, reg_id in tiles:
                block_res = residual[y1:y2, x1:x2]
                block_abs = abs_residual[y1:y2, x1:x2]
                if block_abs.size == 0:
                    continue

                b_mean_abs = float(np.mean(block_abs))
                b_std = float(np.std(block_res))
                b_max_abs = float(np.max(block_abs))

                regional_means.append(b_mean_abs)
                regional_stds.append(b_std)

                regional_metrics.append(
                    RegionalNoiseMetric(
                        region_id=reg_id,
                        row=r,
                        col=c,
                        x=x1,
                        y=y1,
                        width=x2 - x1,
                        height=y2 - y1,
                        mean_difference=round(b_mean_abs, 4),
                        std=round(b_std, 4),
                        max_difference=round(b_max_abs, 4),
                    )
                )

            regional_summary: dict[str, float] = {
                "mean_min": round(min(regional_means), 4) if regional_means else 0.0,
                "mean_max": round(max(regional_means), 4) if regional_means else 0.0,
                "mean_spread": round(max(regional_means) - min(regional_means), 4)
                if regional_means
                else 0.0,
                "std_min": round(min(regional_stds), 4) if regional_stds else 0.0,
                "std_max": round(max(regional_stds), 4) if regional_stds else 0.0,
                "std_mean": round(float(np.mean(regional_stds)), 4) if regional_stds else 0.0,
            }

            # Visualization
            vis_url = (
                _generate_visualization_data_url(abs_residual)
                if include_visualization
                else None
            )

            result = NoiseResult(
                image_format=image_format,
                smoothing_sigma=sigma,
                residual_mean=round(res_mean, 4),
                residual_std=round(res_std, 4),
                mean_absolute_residual=round(mean_abs, 4),
                median_absolute_residual=round(median_abs, 4),
                max_absolute_residual=round(max_abs, 4),
                p95_absolute_residual=round(p95_abs, 4),
                p99_absolute_residual=round(p99_abs, 4),
                channel_residual_means=ch_means,
                channel_residual_stds=ch_stds,
                channel_mean_absolute_residuals=ch_mean_abs,
                regional_metrics=regional_metrics,
                regional_summary=regional_summary,
                visualization_data_url=vis_url,
            )

            result.observations = interpret_noise(result)
            result.limitations = noise_limitations(sigma)
            return result

        finally:
            smoothed_img.close()
    finally:
        orig_rgb.close()


def interpret_noise(result: NoiseResult) -> list[str]:
    """Generate neutral, factual forensic observations from noise residual metrics.

    Does not invent findings, make authenticity claims, or predict manipulation.
    """
    observations: list[str] = [
        f"Noise residual analysis evaluated using Gaussian low-pass filter (sigma={result.smoothing_sigma:.2f}).",
        f"Global mean absolute residual is {result.mean_absolute_residual:.2f} on a 0–255 scale "
        f"(residual standard deviation: {result.residual_std:.2f}, signed mean: {result.residual_mean:.2f}).",
        f"Median absolute residual is {result.median_absolute_residual:.2f}; 95th percentile is "
        f"{result.p95_absolute_residual:.2f}, and 99th percentile is {result.p99_absolute_residual:.2f} "
        f"(peak observed: {result.max_absolute_residual:.2f}).",
    ]

    spread = result.regional_summary.get("mean_spread", 0.0)
    mean_min = result.regional_summary.get("mean_min", 0.0)
    mean_max = result.regional_summary.get("mean_max", 0.0)

    if spread < 3.0:
        observations.append(
            f"Residual intensity is relatively uniform across spatial regions "
            f"(regional mean range: {mean_min:.2f}–{mean_max:.2f}, spread: {spread:.2f})."
        )
    else:
        observations.append(
            f"Residual intensity varies across spatial regions "
            f"(regional mean range: {mean_min:.2f} to {mean_max:.2f}, spread: {spread:.2f}). "
            f"This can reflect varying edge density, texture detail, or localized processing."
        )

    observations.append(
        "Higher residual magnitudes naturally concentrate along edges, textures, and "
        "high-frequency structures where the low-pass filter suppresses sharp transitions."
    )

    observations.append(
        "Noise residual analysis examines high-frequency deviations from a low-pass baseline; "
        "it does not classify an image as real or fake, and cannot prove manipulation or AI generation."
    )

    return observations


def noise_limitations(sigma: float = DEFAULT_SMOOTHING_SIGMA) -> list[str]:
    """Return standard forensic limitations for Noise Residual Analysis."""
    return [
        "Noise residual patterns are heavily influenced by high-frequency image content, sharp edges, and detailed textures.",
        "Image processing operations such as JPEG compression, downsampling, sharpening, and denoising alter noise residual distributions.",
        "Uniform or non-uniform noise residuals do not establish whether an image is authentic, edited, or synthetic.",
        f"Residual analysis depends on the chosen filtering model and smoothing parameter (sigma={sigma}).",
        "Sensor noise characteristics vary widely across camera models, ISO settings, and lighting conditions.",
    ]


def build_noise_analysis(
    data: bytes,
    image_format: str,
    *,
    sigma: float = DEFAULT_SMOOTHING_SIGMA,
    grid_size: tuple[int, int] = DEFAULT_GRID_SIZE,
    include_visualization: bool = True,
) -> AnalysisItem:
    """Run Noise Residual Analysis and return a structured AnalysisItem.

    Supports JPEG, PNG, and WEBP formats.
    Handles corrupt bytes or unexpected errors defensively by returning status='failed'.
    """
    normalized_format = (image_format or "").upper()
    if normalized_format in {"JPG", "JPEG"}:
        normalized_format = "JPEG"

    if normalized_format not in {"JPEG", "PNG", "WEBP"}:
        return AnalysisItem(
            name="noise",
            status="unavailable",
            observations=[
                f"Noise residual analysis is unavailable for format '{image_format}'."
            ],
            metrics={},
            limitations=[
                "Noise residual analysis requires decoding to RGB pixels and is only available for supported image formats.",
            ],
            details=None,
        )

    try:
        result = compute_noise_residual(
            data,
            sigma=sigma,
            grid_size=grid_size,
            include_visualization=include_visualization,
        )

        details = NoiseDetails(
            smoothing_sigma=result.smoothing_sigma,
            residual_mean=result.residual_mean,
            residual_std=result.residual_std,
            mean_absolute_residual=result.mean_absolute_residual,
            median_absolute_residual=result.median_absolute_residual,
            max_absolute_residual=result.max_absolute_residual,
            p95_absolute_residual=result.p95_absolute_residual,
            p99_absolute_residual=result.p99_absolute_residual,
            channel_residual_means=result.channel_residual_means,
            channel_residual_stds=result.channel_residual_stds,
            channel_mean_absolute_residuals=result.channel_mean_absolute_residuals,
            regional_metrics=result.regional_metrics,
            regional_summary=result.regional_summary,
            visualization_data_url=result.visualization_data_url,
        )

        metrics: dict[str, Any] = {
            "smoothing_sigma": result.smoothing_sigma,
            "residual_mean": result.residual_mean,
            "residual_std": result.residual_std,
            "mean_absolute_residual": result.mean_absolute_residual,
            "median_absolute_residual": result.median_absolute_residual,
            "max_absolute_residual": result.max_absolute_residual,
            "p95_absolute_residual": result.p95_absolute_residual,
            "p99_absolute_residual": result.p99_absolute_residual,
            "channel_residual_means": result.channel_residual_means,
            "channel_residual_stds": result.channel_residual_stds,
            "channel_mean_absolute_residuals": result.channel_mean_absolute_residuals,
            "regional_mean_min": result.regional_summary.get("mean_min", 0.0),
            "regional_mean_max": result.regional_summary.get("mean_max", 0.0),
            "regional_mean_spread": result.regional_summary.get("mean_spread", 0.0),
            "regional_std_mean": result.regional_summary.get("std_mean", 0.0),
            "regional_std_max": result.regional_summary.get("std_max", 0.0),
        }

        return AnalysisItem(
            name="noise",
            status="completed",
            observations=result.observations,
            metrics=metrics,
            limitations=result.limitations,
            details=details,
        )

    except Exception as exc:
        return AnalysisItem(
            name="noise",
            status="failed",
            observations=[f"Noise residual analysis could not be computed: {str(exc)}"],
            metrics={},
            limitations=noise_limitations(sigma),
            details=None,
        )
