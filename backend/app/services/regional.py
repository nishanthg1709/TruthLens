"""Regional Anomaly Analysis engine for TruthLens image forensics.

Examines spatial variations in image characteristics and measures the statistical
deviation of individual regions against image-wide distributions and adjacent neighbors.

Regional variation occurs naturally due to lighting, depth of field, scene texture,
camera processing, focus, and compression. This engine reports statistical observations
and deviations; it does NOT produce verdicts of tampering or authenticity.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

from app.models.schemas import (
    AnalysisItem,
    RegionalAnomalyDetails,
    RegionalAnomalyItem,
)
from app.utils.image_io import partition_grid

DEFAULT_GRID_SIZE: tuple[int, int] = (4, 4)
DEFAULT_EDGE_THRESHOLD: float = 15.0
MIN_FFT_REGION_DIM: int = 8
MAX_VISUALIZATION_DIMENSION: int = 1200


@dataclass
class RegionalAnomalyResult:
    """Computed regional anomaly metrics and visual artifacts."""

    image_format: str
    grid_rows: int
    grid_cols: int
    total_regions: int
    analyzed_features: list[str]
    active_modules_used: list[str]
    max_deviation_score: float
    mean_deviation_score: float
    highest_deviation_region_id: str | None
    regional_anomalies: list[RegionalAnomalyItem]
    regional_summary: dict[str, float]
    visualization_data_url: str | None = None
    observations: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)


def _compute_regional_fft_high_freq_ratio(
    lum_tile: np.ndarray,
) -> float | None:
    """Compute high-frequency spectral energy ratio for a single regional tile.

    Returns None if region dimensions are too small (< 8x8) for meaningful
    frequency partitioning.
    """
    th, tw = lum_tile.shape
    if th < MIN_FFT_REGION_DIM or tw < MIN_FFT_REGION_DIM:
        return None

    # Zero-mean tile to eliminate dominant DC spike
    tile_mean = float(np.mean(lum_tile))
    zero_mean = lum_tile - tile_mean

    # Separable 2D Hann window
    wh = np.hanning(th)
    ww = np.hanning(tw)
    window_2d = np.outer(wh, ww)
    windowed = zero_mean * window_2d

    # 2D FFT & shift
    fft_shifted = np.fft.fftshift(np.fft.fft2(windowed))
    power = np.real(fft_shifted * np.conj(fft_shifted))

    cy, cx = th // 2, tw // 2
    total_power = float(np.sum(power))
    dc_power = float(power[cy, cx])
    non_dc_power = total_power - dc_power

    if non_dc_power <= 1e-12:
        return 0.0

    y_idx, x_idx = np.ogrid[:th, :tw]
    ny = max(1.0, th / 2.0)
    nx = max(1.0, tw / 2.0)
    r = np.sqrt(((y_idx - cy) / ny) ** 2 + ((x_idx - cx) / nx) ** 2)

    # High-frequency band defined as r >= 0.40, matching frequency service
    high_freq_power = float(np.sum(power[r >= 0.40]))
    return float(np.clip(high_freq_power / non_dc_power, 0.0, 1.0))


def _generate_visualization_data_url(
    orig_rgb: Image.Image,
    regional_items: list[RegionalAnomalyItem],
    grid_size: tuple[int, int],
    max_score: float,
) -> str:
    """Generate an overlay visualization with region boundaries, deviation colors, and legend."""
    orig_w, orig_h = orig_rgb.size

    # Limit preview dimensions for responsive data URL payload
    if max(orig_w, orig_h) > MAX_VISUALIZATION_DIMENSION:
        scale = MAX_VISUALIZATION_DIMENSION / float(max(orig_w, orig_h))
        vis_w = max(1, int(round(orig_w * scale)))
        vis_h = max(1, int(round(orig_h * scale)))
        base_img = orig_rgb.resize((vis_w, vis_h), Image.Resampling.LANCZOS)
        scale_x = vis_w / float(orig_w)
        scale_y = vis_h / float(orig_h)
    else:
        base_img = orig_rgb.copy()
        vis_w, vis_h = orig_w, orig_h
        scale_x = 1.0
        scale_y = 1.0

    # Create RGBA overlay
    overlay = Image.new("RGBA", (vis_w, vis_h), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    # Reference score for normalization
    norm_denom = max(2.5, max_score)

    for item in regional_items:
        # Scale bounding box to preview dimensions
        x1 = int(round(item.x * scale_x))
        y1 = int(round(item.y * scale_y))
        x2 = min(vis_w, int(round((item.x + item.width) * scale_x)))
        y2 = min(vis_h, int(round((item.y + item.height) * scale_y)))

        if x2 <= x1 or y2 <= y1:
            continue

        # Deviation fraction in [0, 1]
        frac = float(np.clip(item.deviation_score / norm_denom, 0.0, 1.0))

        # Color ramp: Cool Blue (0.0) -> Amber (0.5) -> Crimson (1.0)
        if frac <= 0.5:
            t = frac / 0.5
            r = int(round(46 * (1 - t) + 243 * t))
            g = int(round(134 * (1 - t) + 156 * t))
            b = int(round(193 * (1 - t) + 18 * t))
            a = int(round(50 * (1 - t) + 80 * t))
        else:
            t = (frac - 0.5) / 0.5
            r = int(round(243 * (1 - t) + 231 * t))
            g = int(round(156 * (1 - t) + 76 * t))
            b = int(round(18 * (1 - t) + 60 * t))
            a = int(round(80 * (1 - t) + 110 * t))

        # Fill tile overlay
        overlay_draw.rectangle([x1, y1, x2, y2], fill=(r, g, b, a))

        # Region outline
        overlay_draw.rectangle([x1, y1, x2, y2], outline=(255, 255, 255, 160), width=1)

        # Region ID label if box is large enough
        if (x2 - x1) >= 28 and (y2 - y1) >= 16:
            label_text = f"{item.region_id} ({item.deviation_score:.1f})"
            overlay_draw.text(
                (x1 + 3, y1 + 3),
                label_text,
                fill=(255, 255, 255, 230),
            )

    # Composite overlay onto base image
    base_rgba = base_img.convert("RGBA")
    composited = Image.alpha_composite(base_rgba, overlay)

    # Add legend footer banner
    footer_height = 28
    final_canvas = Image.new("RGBA", (vis_w, vis_h + footer_height), (22, 26, 34, 255))
    final_canvas.paste(composited, (0, 0))

    canvas_draw = ImageDraw.Draw(final_canvas)
    # Legend color bar (small gradient strip on the right)
    legend_bar_w = min(120, max(40, vis_w // 4))
    legend_x = vis_w - legend_bar_w - 10
    legend_y = vis_h + 8
    legend_h = 10

    for i in range(legend_bar_w):
        frac = i / float(legend_bar_w)
        if frac <= 0.5:
            t = frac / 0.5
            lr = int(round(46 * (1 - t) + 243 * t))
            lg = int(round(134 * (1 - t) + 156 * t))
            lb = int(round(193 * (1 - t) + 18 * t))
        else:
            t = (frac - 0.5) / 0.5
            lr = int(round(243 * (1 - t) + 231 * t))
            lg = int(round(156 * (1 - t) + 76 * t))
            lb = int(round(18 * (1 - t) + 60 * t))
        canvas_draw.line(
            [(legend_x + i, legend_y), (legend_x + i, legend_y + legend_h)],
            fill=(lr, lg, lb, 255),
        )

    legend_text = "Regional Deviation: Low -> Elevated (relative statistical contrast)"
    canvas_draw.text((10, vis_h + 8), legend_text, fill=(200, 205, 215, 255))

    # Save to PNG base64
    buffer = BytesIO()
    final_rgb = final_canvas.convert("RGB")
    final_rgb.save(buffer, format="PNG", optimize=True)
    b64_str = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64_str}"


def _format_neutral_observation(
    region_id: str,
    score: float,
    neighbor_dev: float,
    z_scores: dict[str, float],
) -> str:
    """Generate a neutral, objective observation for a single region."""
    if score < 0.8:
        return "Regional measurements are closely aligned with image-wide statistics."

    if score < 1.8:
        return "Mild regional variation observed, consistent with normal spatial distribution."

    # Identify primary contributing feature with highest z-score
    feat_names = {
        "std_luminance": "luminance variation",
        "mean_gradient": "gradient magnitude",
        "std_gradient": "texture variation",
        "edge_density": "edge density",
        "noise_residual_std": "residual variation",
        "noise_mean_abs": "residual magnitude",
        "ela_mean": "recompression difference",
        "ela_variance": "recompression variance",
        "regional_fft_high_freq_ratio": "high-frequency spectral energy",
    }
    sorted_z = sorted(z_scores.items(), key=lambda kv: kv[1], reverse=True)
    top_feature, top_z = sorted_z[0] if sorted_z else ("characteristics", score)
    top_label = feat_names.get(top_feature, top_feature)

    return (
        f"Elevated statistical deviation observed, primarily driven by {top_label} "
        f"(z={top_z:.2f}); regional differences reflect spatial texture rather than tampering."
    )


def compute_regional_anomaly(
    data: bytes,
    image_format: str,
    *,
    grid_size: tuple[int, int] = DEFAULT_GRID_SIZE,
    edge_threshold: float = DEFAULT_EDGE_THRESHOLD,
    ela_analysis: AnalysisItem | None = None,
    noise_analysis: AnalysisItem | None = None,
    include_visualization: bool = True,
) -> RegionalAnomalyResult:
    """Compute regional features, statistical deviation scores, and visualization.

    Args:
        data: Validated image file bytes.
        image_format: Normalized image format (e.g. JPEG, PNG, WEBP).
        grid_size: (rows, cols) tile partition (default 4x4).
        edge_threshold: Minimum gradient magnitude for edge density thresholding.
        ela_analysis: Optional existing ELA AnalysisItem to reuse regional metrics.
        noise_analysis: Optional existing Noise AnalysisItem to reuse regional metrics.
        include_visualization: Whether to render and encode the overlay visualization.

    Returns:
        RegionalAnomalyResult containing regional metrics, deviation scores,
        and factual observations.
    """
    rows, cols = max(1, grid_size[0]), max(1, grid_size[1])

    # 1. Decode original image to RGB
    with Image.open(BytesIO(data)) as raw_img:
        orig_rgb = raw_img.convert("RGB") if raw_img.mode != "RGB" else raw_img.copy()

    width, height = orig_rgb.size
    total_regions = rows * cols

    # 2. Compute image luminance: ITU-R BT.601
    rgb_arr = np.asarray(orig_rgb, dtype=np.float32)
    lum_arr = 0.299 * rgb_arr[:, :, 0] + 0.587 * rgb_arr[:, :, 1] + 0.114 * rgb_arr[:, :, 2]

    # 3. Compute image gradient magnitude
    if height >= 2 and width >= 2:
        grad_y, grad_x = np.gradient(lum_arr)
        grad_mag = np.hypot(grad_x, grad_y)
    else:
        grad_mag = np.zeros_like(lum_arr)

    # 4. Extract existing ELA and Noise regional metrics by region_id if available
    noise_by_id: dict[str, Any] = {}
    if noise_analysis and noise_analysis.status == "completed" and noise_analysis.details:
        metrics_list = (
            noise_analysis.details.regional_metrics
            if hasattr(noise_analysis.details, "regional_metrics")
            else noise_analysis.details.get("regional_metrics", [])  # type: ignore[union-attr]
        )
        for rm in metrics_list:
            rid = rm.region_id if hasattr(rm, "region_id") else rm.get("region_id")
            noise_by_id[rid] = rm

    ela_by_id: dict[str, Any] = {}
    if ela_analysis and ela_analysis.status == "completed" and ela_analysis.details:
        metrics_list = (
            ela_analysis.details.regional_metrics
            if hasattr(ela_analysis.details, "regional_metrics")
            else ela_analysis.details.get("regional_metrics", [])  # type: ignore[union-attr]
        )
        for rm in metrics_list:
            rid = rm.region_id if hasattr(rm, "region_id") else rm.get("region_id")
            ela_by_id[rid] = rm

    # 5. Partition image into grid
    tiles = partition_grid(width, height, (rows, cols))

    # Raw features collection
    raw_regions: list[dict[str, Any]] = []
    has_noise = bool(noise_by_id)
    has_ela = bool(ela_by_id)
    has_regional_fft = (min(width // cols, height // rows) >= MIN_FFT_REGION_DIM)

    active_modules: list[str] = ["luminance", "gradient"]
    if has_noise:
        active_modules.append("noise")
    if has_ela:
        active_modules.append("ela")
    if has_regional_fft:
        active_modules.append("frequency")

    for r, c, x1, y1, x2, y2, region_id in tiles:
        w_tile = x2 - x1
        h_tile = y2 - y1

        if w_tile > 0 and h_tile > 0:
            lum_tile = lum_arr[y1:y2, x1:x2]
            grad_tile = grad_mag[y1:y2, x1:x2]

            mean_lum = float(np.mean(lum_tile))
            std_lum = float(np.std(lum_tile))
            min_lum = float(np.min(lum_tile))
            max_lum = float(np.max(lum_tile))

            mean_grad = float(np.mean(grad_tile))
            std_grad = float(np.std(grad_tile))
            edge_count = int(np.count_nonzero(grad_tile >= edge_threshold))
            edge_dens = float((edge_count / lum_tile.size) * 100.0)

            # Optional regional FFT
            fft_ratio = (
                _compute_regional_fft_high_freq_ratio(lum_tile)
                if has_regional_fft
                else None
            )
        else:
            mean_lum, std_lum, min_lum, max_lum = 0.0, 0.0, 0.0, 0.0
            mean_grad, std_grad, edge_dens = 0.0, 0.0, 0.0
            fft_ratio = None

        # Noise values
        noise_metric = noise_by_id.get(region_id)
        if noise_metric:
            noise_std = float(
                noise_metric.std if hasattr(noise_metric, "std") else noise_metric["std"]
            )
            noise_mean = float(
                noise_metric.mean_difference
                if hasattr(noise_metric, "mean_difference")
                else noise_metric["mean_difference"]
            )
        else:
            noise_std, noise_mean = None, None

        # ELA values
        ela_metric = ela_by_id.get(region_id)
        if ela_metric:
            ela_mean = float(
                ela_metric.mean_difference
                if hasattr(ela_metric, "mean_difference")
                else ela_metric["mean_difference"]
            )
            ela_var = float(
                ela_metric.variance
                if hasattr(ela_metric, "variance")
                else ela_metric["variance"]
            )
        else:
            ela_mean, ela_var = None, None

        raw_regions.append(
            {
                "region_id": region_id,
                "row": r,
                "col": c,
                "x": x1,
                "y": y1,
                "width": w_tile,
                "height": h_tile,
                "mean_luminance": mean_lum,
                "std_luminance": std_lum,
                "min_luminance": min_lum,
                "max_luminance": max_lum,
                "mean_gradient": mean_grad,
                "std_gradient": std_grad,
                "edge_density": edge_dens,
                "noise_residual_std": noise_std,
                "noise_mean_abs": noise_mean,
                "ela_mean": ela_mean,
                "ela_variance": ela_var,
                "regional_fft_high_freq_ratio": fft_ratio,
            }
        )

    # 6. Determine candidate active features across all regions
    candidate_features = [
        "std_luminance",
        "mean_gradient",
        "std_gradient",
        "edge_density",
    ]
    if has_noise:
        candidate_features.extend(["noise_residual_std", "noise_mean_abs"])
    if has_ela:
        candidate_features.extend(["ela_mean", "ela_variance"])
    if has_regional_fft:
        candidate_features.append("regional_fft_high_freq_ratio")

    # Keep only features present in every region without None
    active_features = [
        feat for feat in candidate_features
        if all(reg[feat] is not None for reg in raw_regions)
    ]

    # 7. Compute robust feature medians, MAD, scales
    feature_scales: dict[str, tuple[float, float]] = {}  # feat -> (median, scale)
    for feat in active_features:
        vals = np.array([reg[feat] for reg in raw_regions], dtype=np.float64)
        med = float(np.median(vals))
        mad = float(np.median(np.abs(vals - med)))
        if mad > 1e-6:
            scale = 1.4826 * mad
        else:
            std_val = float(np.std(vals))
            scale = std_val if std_val > 1e-6 else 1.0
        feature_scales[feat] = (med, scale)

    # 8. Compute standardized deviation scores and neighbor deviations
    # Map (row, col) -> region index for 2D spatial adjacency
    grid_map: dict[tuple[int, int], int] = {
        (reg["row"], reg["col"]): idx for idx, reg in enumerate(raw_regions)
    }

    regional_items: list[RegionalAnomalyItem] = []
    deviation_scores: list[float] = []

    for idx, reg in enumerate(raw_regions):
        r, c = reg["row"], reg["col"]
        z_dict: dict[str, float] = {}
        z_list: list[float] = []

        for feat in active_features:
            val = float(reg[feat])
            med, scale = feature_scales[feat]
            # If scale is effectively zero (uniform across all regions), z is 0.0
            if scale <= 1e-6 or np.allclose([r0[feat] for r0 in raw_regions], val):
                z = 0.0
            else:
                z = float(abs(val - med) / scale)
            z_dict[feat] = round(z, 4)
            z_list.append(z)

        # Composite deviation score = mean of robust feature z-scores
        comp_score = float(np.mean(z_list)) if z_list else 0.0
        deviation_scores.append(comp_score)

        # Spatial neighbor deviation (4-connected neighbors)
        neighbor_diffs: list[float] = []
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            n_coord = (r + dr, c + dc)
            if n_coord in grid_map:
                n_idx = grid_map[n_coord]
                n_reg = raw_regions[n_idx]
                feat_diffs = [
                    abs(float(reg[f]) - float(n_reg[f])) / feature_scales[f][1]
                    for f in active_features
                    if feature_scales[f][1] > 1e-6
                ]
                if feat_diffs:
                    neighbor_diffs.append(float(np.mean(feat_diffs)))

        neighbor_dev = float(np.mean(neighbor_diffs)) if neighbor_diffs else 0.0

        observation = _format_neutral_observation(
            reg["region_id"],
            comp_score,
            neighbor_dev,
            z_dict,
        )

        item = RegionalAnomalyItem(
            region_id=reg["region_id"],
            row=r,
            col=c,
            x=reg["x"],
            y=reg["y"],
            width=reg["width"],
            height=reg["height"],
            mean_luminance=round(reg["mean_luminance"], 4),
            std_luminance=round(reg["std_luminance"], 4),
            min_luminance=round(reg["min_luminance"], 4),
            max_luminance=round(reg["max_luminance"], 4),
            mean_gradient=round(reg["mean_gradient"], 4),
            std_gradient=round(reg["std_gradient"], 4),
            edge_density=round(reg["edge_density"], 2),
            noise_residual_std=(
                round(reg["noise_residual_std"], 4)
                if reg["noise_residual_std"] is not None
                else None
            ),
            noise_mean_abs=(
                round(reg["noise_mean_abs"], 4)
                if reg["noise_mean_abs"] is not None
                else None
            ),
            ela_mean=(
                round(reg["ela_mean"], 4)
                if reg["ela_mean"] is not None
                else None
            ),
            ela_variance=(
                round(reg["ela_variance"], 4)
                if reg["ela_variance"] is not None
                else None
            ),
            regional_fft_high_freq_ratio=(
                round(reg["regional_fft_high_freq_ratio"], 4)
                if reg["regional_fft_high_freq_ratio"] is not None
                else None
            ),
            deviation_score=round(comp_score, 4),
            neighbor_deviation=round(neighbor_dev, 4),
            z_scores=z_dict,
            observation=observation,
        )
        regional_items.append(item)

    # 9. Aggregate summary statistics
    max_dev = float(np.max(deviation_scores)) if deviation_scores else 0.0
    mean_dev = float(np.mean(deviation_scores)) if deviation_scores else 0.0

    highest_region_id: str | None = None
    if deviation_scores:
        max_idx = int(np.argmax(deviation_scores))
        highest_region_id = regional_items[max_idx].region_id

    regional_summary = {
        "max_deviation_score": round(max_dev, 4),
        "mean_deviation_score": round(mean_dev, 4),
        "min_deviation_score": round(float(np.min(deviation_scores)), 4) if deviation_scores else 0.0,
        "std_deviation_score": round(float(np.std(deviation_scores)), 4) if deviation_scores else 0.0,
    }

    # 10. Visualization
    vis_url = (
        _generate_visualization_data_url(orig_rgb, regional_items, (rows, cols), max_dev)
        if include_visualization
        else None
    )

    # 11. Module observations and limitations
    observations = [
        f"Partitioned image into {total_regions} regions ({rows}x{cols} grid).",
        f"Analyzed {len(active_features)} features across active modules: {', '.join(active_modules)}.",
        f"Mean regional deviation score: {mean_dev:.2f}; peak deviation score: {max_dev:.2f}.",
    ]
    if highest_region_id and max_dev >= 1.5:
        observations.append(
            f"Region {highest_region_id} exhibited the highest relative statistical variation "
            f"({max_dev:.2f}) across measured properties."
        )
    elif max_dev < 1.0:
        observations.append(
            "Regional characteristics are homogeneous across the entire image."
        )

    limitations = [
        "Regional differences reflect spatial contrast, illumination, and scene texture; they do not establish image manipulation.",
        "Regional deviation scores measure statistical dispersion from image-wide medians, not authenticity or forgery probabilities.",
    ]
    if not has_ela:
        limitations.append(
            "ELA regional metrics were not included because ELA is JPEG-specific and unavailable for this format."
        )
    if not has_regional_fft:
        limitations.append(
            f"Regional frequency analysis was omitted because tile dimensions ({width // cols}x{height // rows}) "
            f"are below the {MIN_FFT_REGION_DIM}x{MIN_FFT_REGION_DIM} resolution threshold."
        )

    return RegionalAnomalyResult(
        image_format=image_format,
        grid_rows=rows,
        grid_cols=cols,
        total_regions=total_regions,
        analyzed_features=active_features,
        active_modules_used=active_modules,
        max_deviation_score=round(max_dev, 4),
        mean_deviation_score=round(mean_dev, 4),
        highest_deviation_region_id=highest_region_id,
        regional_anomalies=regional_items,
        regional_summary=regional_summary,
        visualization_data_url=vis_url,
        observations=observations,
        limitations=limitations,
    )


def build_regional_analysis(
    data: bytes,
    image_format: str,
    *,
    grid_size: tuple[int, int] = DEFAULT_GRID_SIZE,
    edge_threshold: float = DEFAULT_EDGE_THRESHOLD,
    ela_analysis: AnalysisItem | None = None,
    noise_analysis: AnalysisItem | None = None,
    include_visualization: bool = True,
) -> AnalysisItem:
    """Run regional anomaly analysis and package it into an AnalysisItem."""
    try:
        result = compute_regional_anomaly(
            data,
            image_format,
            grid_size=grid_size,
            edge_threshold=edge_threshold,
            ela_analysis=ela_analysis,
            noise_analysis=noise_analysis,
            include_visualization=include_visualization,
        )
    except Exception as exc:
        return AnalysisItem(
            name="regional",
            status="failed",
            observations=[],
            limitations=[f"Regional anomaly analysis failed: {exc}"],
            metrics={},
            details=None,
        )

    details = RegionalAnomalyDetails(
        grid_rows=result.grid_rows,
        grid_cols=result.grid_cols,
        total_regions=result.total_regions,
        analyzed_features=result.analyzed_features,
        active_modules_used=result.active_modules_used,
        max_deviation_score=result.max_deviation_score,
        mean_deviation_score=result.mean_deviation_score,
        highest_deviation_region_id=result.highest_deviation_region_id,
        regional_anomalies=result.regional_anomalies,
        regional_summary=result.regional_summary,
        visualization_data_url=result.visualization_data_url,
    )

    metrics: dict[str, Any] = {
        "grid_rows": result.grid_rows,
        "grid_cols": result.grid_cols,
        "total_regions": result.total_regions,
        "analyzed_feature_count": len(result.analyzed_features),
        "max_deviation_score": result.max_deviation_score,
        "mean_deviation_score": result.mean_deviation_score,
        "highest_deviation_region_id": result.highest_deviation_region_id,
    }

    return AnalysisItem(
        name="regional",
        status="completed",
        observations=result.observations,
        metrics=metrics,
        limitations=result.limitations,
        details=details,
    )
