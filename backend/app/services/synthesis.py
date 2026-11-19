"""Evidence Aggregation & Synthesis Engine (Phase 3).

Synthesizes multi-signal forensic evidence across five domains:
1. Metadata & Provenance (EXIF, camera make/model, timestamps, software)
2. Compression & Recompression (JPEG Error Level Analysis)
3. Noise & Texture (Gaussian residual filtering, spatial noise distribution)
4. Frequency Spectrum (2D FFT radial energy bands, spectral centroid, entropy)
5. Spatial Consistency (Regional grid anomaly analysis, cross-tile deviation)

Core Principles:
- This engine is NOT a fake-image detector or binary classifier.
- Never produces authenticity percentages, manipulation confidence scores, or verdicts.
- Addresses correlated feature weighting by aggregating within domains first.
- Identifies spatial convergence where multiple independent signals coincide.
- Resilient to missing, unavailable, or failed modules without fabricating data.
- Employs strictly neutral, scientifically defensible forensic language.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from app.models.schemas import (
    AnalysisItem,
    CrossDomainRelationship,
    ELADetails,
    EvidenceDomainItem,
    EvidenceSummary,
    FrequencyDetails,
    ImageProperties,
    KeyObservation,
    MetadataDetails,
    MethodologyInfo,
    NoiseDetails,
    RegionalAnomalyDetails,
    RegionalSynthesis,
    RegionalSynthesisTile,
    SynthesisDetails,
)

SYNTHESIS_VERSION: str = "3.0"

KNOWN_EDITING_SOFTWARE_KEYWORDS: tuple[str, ...] = (
    "photoshop",
    "gimp",
    "lightroom",
    "canva",
    "snapseed",
    "paint.net",
    "pixlr",
    "affinity",
    "vsco",
    "facetune",
    "picsart",
    "coreldraw",
)


def _evaluate_metadata_domain(item: AnalysisItem | None) -> EvidenceDomainItem:
    """Evaluate Domain 1: Metadata & Provenance."""
    if item is None or item.status == "unavailable":
        return EvidenceDomainItem(
            domain_id="metadata",
            domain_name="Metadata & Provenance",
            status="unavailable",
            has_notable_variation=False,
            summary="Metadata extraction was unavailable for this image.",
            metrics={},
            observations=["No metadata extraction was performed."],
        )

    if item.status == "failed":
        return EvidenceDomainItem(
            domain_id="metadata",
            domain_name="Metadata & Provenance",
            status="failed",
            has_notable_variation=False,
            summary="Metadata extraction encountered an unhandled error.",
            metrics={},
            observations=item.observations or ["Metadata extraction failed."],
        )

    details = item.details
    if details is None:
        return EvidenceDomainItem(
            domain_id="metadata",
            domain_name="Metadata & Provenance",
            status="insufficient_data",
            has_notable_variation=False,
            summary="Metadata details were not returned.",
            metrics={},
            observations=[],
        )

    exif_present = bool(getattr(details, "exif_present", False))
    camera_make = getattr(details, "camera_make", None)
    camera_model = getattr(details, "camera_model", None)
    software = getattr(details, "software", None)
    capture_datetime = getattr(details, "capture_datetime", None)
    gps_present = bool(getattr(details, "gps_present", False))
    parse_errors = list(getattr(details, "parse_errors", []))
    fields_found = list(getattr(details, "fields_found", []))
    fields_missing = list(getattr(details, "fields_missing", []))

    # Detect post-processing software keywords
    is_editing_software = False
    if software and any(kw in software.lower() for kw in KNOWN_EDITING_SOFTWARE_KEYWORDS):
        is_editing_software = True

    has_camera_info = bool(camera_make or camera_model)
    has_notable_variation = is_editing_software or len(parse_errors) > 0

    metrics: dict[str, Any] = {
        "exif_present": exif_present,
        "has_camera_info": has_camera_info,
        "camera_make": camera_make,
        "camera_model": camera_model,
        "software": software,
        "is_editing_software_indicated": is_editing_software,
        "capture_datetime": capture_datetime,
        "gps_present": gps_present,
        "fields_found_count": len(fields_found),
        "fields_missing_count": len(fields_missing),
        "parse_error_count": len(parse_errors),
    }

    if not exif_present:
        summary = (
            "No EXIF metadata was detected. Metadata absence is common across web uploads, "
            "messaging platforms, screenshots, and stripped exports; it does not indicate manipulation."
        )
    elif is_editing_software:
        summary = (
            f"EXIF metadata indicates image editing or export software ({software}). "
            "This confirms software-assisted processing or export."
        )
    elif has_camera_info:
        summary = (
            f"Camera hardware provenance metadata detected ({camera_make or ''} {camera_model or ''}). "
            "Standard capture metadata fields are populated."
        )
    else:
        summary = "EXIF metadata is present with basic capture or format properties."

    return EvidenceDomainItem(
        domain_id="metadata",
        domain_name="Metadata & Provenance",
        status="available",
        has_notable_variation=has_notable_variation,
        summary=summary,
        metrics=metrics,
        observations=item.observations,
    )


def _evaluate_compression_domain(item: AnalysisItem | None) -> EvidenceDomainItem:
    """Evaluate Domain 2: Compression & Recompression (ELA)."""
    if item is None or item.status == "unavailable":
        return EvidenceDomainItem(
            domain_id="compression",
            domain_name="Compression & Recompression",
            status="unavailable",
            has_notable_variation=False,
            summary=(
                "Error Level Analysis is unavailable for this image format. "
                "ELA is specifically designed for JPEG lossy DCT compression artifacts."
            ),
            metrics={},
            observations=["Compression analysis skipped: non-JPEG format."],
        )

    if item.status == "failed":
        return EvidenceDomainItem(
            domain_id="compression",
            domain_name="Compression & Recompression",
            status="failed",
            has_notable_variation=False,
            summary="Error Level Analysis failed to compute.",
            metrics={},
            observations=item.observations or ["ELA computation failed."],
        )

    details = item.details
    if details is None:
        return EvidenceDomainItem(
            domain_id="compression",
            domain_name="Compression & Recompression",
            status="insufficient_data",
            has_notable_variation=False,
            summary="ELA details were not returned.",
            metrics={},
            observations=[],
        )

    mean_diff = float(getattr(details, "mean_difference", 0.0))
    max_diff = float(getattr(details, "max_difference", 0.0))
    p95_diff = float(getattr(details, "p95_difference", 0.0))
    p99_diff = float(getattr(details, "p99_difference", 0.0))
    regional_summary = dict(getattr(details, "regional_summary", {}))
    threshold_percentages = dict(getattr(details, "threshold_percentages", {}))
    recompression_quality = int(getattr(details, "recompression_quality", 90))

    mean_spread = float(regional_summary.get("mean_spread", 0.0))
    above_20_pct = float(threshold_percentages.get("above_20", 0.0))

    # De-correlate: evaluate global error magnitude and regional spread as primary signals
    has_notable_variation = (mean_spread >= 4.0 and above_20_pct >= 5.0) or (mean_diff >= 18.0)

    metrics = {
        "recompression_quality": recompression_quality,
        "mean_difference": round(mean_diff, 4),
        "max_difference": round(max_diff, 4),
        "p95_difference": round(p95_diff, 4),
        "p99_difference": round(p99_diff, 4),
        "regional_mean_spread": round(mean_spread, 4),
        "pixels_above_threshold_20_pct": round(above_20_pct, 2),
    }

    if has_notable_variation:
        summary = (
            f"Spatial variation in recompression error levels observed (regional spread: {mean_spread:.2f}, "
            f"global mean difference: {mean_diff:.2f}). Error levels reflect differing edge density or compression histories."
        )
    else:
        summary = (
            f"Recompression error levels are relatively uniform across the image (mean difference: {mean_diff:.2f}, "
            f"regional spread: {mean_spread:.2f})."
        )

    return EvidenceDomainItem(
        domain_id="compression",
        domain_name="Compression & Recompression",
        status="available",
        has_notable_variation=has_notable_variation,
        summary=summary,
        metrics=metrics,
        observations=item.observations,
    )


def _evaluate_noise_domain(item: AnalysisItem | None) -> EvidenceDomainItem:
    """Evaluate Domain 3: Noise & Texture."""
    if item is None or item.status == "unavailable":
        return EvidenceDomainItem(
            domain_id="noise",
            domain_name="Noise & Texture",
            status="unavailable",
            has_notable_variation=False,
            summary="Noise residual analysis was unavailable.",
            metrics={},
            observations=[],
        )

    if item.status == "failed":
        return EvidenceDomainItem(
            domain_id="noise",
            domain_name="Noise & Texture",
            status="failed",
            has_notable_variation=False,
            summary="Noise residual analysis failed to compute.",
            metrics={},
            observations=item.observations or ["Noise residual computation failed."],
        )

    details = item.details
    if details is None:
        return EvidenceDomainItem(
            domain_id="noise",
            domain_name="Noise & Texture",
            status="insufficient_data",
            has_notable_variation=False,
            summary="Noise details were not returned.",
            metrics={},
            observations=[],
        )

    res_std = float(getattr(details, "residual_std", 0.0))
    res_mean = float(getattr(details, "residual_mean", 0.0))
    mean_abs = float(getattr(details, "mean_absolute_residual", 0.0))
    p95_abs = float(getattr(details, "p95_absolute_residual", 0.0))
    regional_summary = dict(getattr(details, "regional_summary", {}))

    std_min = float(regional_summary.get("std_min", 0.0))
    std_max = float(regional_summary.get("std_max", 0.0))
    std_mean = float(regional_summary.get("std_mean", 0.0))
    std_spread = round(std_max - std_min, 4)

    # Heterogeneity ratio
    heterogeneity = (std_spread / max(1.0, std_mean)) if std_mean > 0.0 else 0.0

    # Rule: Notable regional noise variation if spread >= 3.0 and relative heterogeneity >= 0.50
    has_notable_variation = (std_spread >= 3.0 and heterogeneity >= 0.50)

    metrics = {
        "residual_std": round(res_std, 4),
        "residual_mean": round(res_mean, 4),
        "mean_absolute_residual": round(mean_abs, 4),
        "p95_absolute_residual": round(p95_abs, 4),
        "regional_std_spread": std_spread,
        "regional_noise_heterogeneity": round(heterogeneity, 4),
    }

    if has_notable_variation:
        summary = (
            f"Regional variation in high-frequency residual distribution observed (residual std spread: {std_spread:.2f}, "
            f"heterogeneity ratio: {heterogeneity:.2f})."
        )
    else:
        summary = (
            f"High-frequency residual patterns are spatially consistent (residual std: {res_std:.2f}, "
            f"regional std spread: {std_spread:.2f})."
        )

    return EvidenceDomainItem(
        domain_id="noise",
        domain_name="Noise & Texture",
        status="available",
        has_notable_variation=has_notable_variation,
        summary=summary,
        metrics=metrics,
        observations=item.observations,
    )


def _evaluate_frequency_domain(item: AnalysisItem | None) -> EvidenceDomainItem:
    """Evaluate Domain 4: Frequency Spectrum."""
    if item is None or item.status == "unavailable":
        return EvidenceDomainItem(
            domain_id="frequency",
            domain_name="Frequency Spectrum",
            status="unavailable",
            has_notable_variation=False,
            summary="Frequency domain analysis was unavailable.",
            metrics={},
            observations=[],
        )

    if item.status == "failed":
        return EvidenceDomainItem(
            domain_id="frequency",
            domain_name="Frequency Spectrum",
            status="failed",
            has_notable_variation=False,
            summary="Frequency domain analysis failed to compute.",
            metrics={},
            observations=item.observations or ["Frequency analysis failed."],
        )

    details = item.details
    if details is None:
        return EvidenceDomainItem(
            domain_id="frequency",
            domain_name="Frequency Spectrum",
            status="insufficient_data",
            has_notable_variation=False,
            summary="Frequency details were not returned.",
            metrics={},
            observations=[],
        )

    non_dc_power = float(getattr(details, "total_non_dc_power", 0.0))
    low_pct = float(getattr(details, "low_frequency_energy_pct", 0.0))
    mid_pct = float(getattr(details, "mid_frequency_energy_pct", 0.0))
    high_pct = float(getattr(details, "high_frequency_energy_pct", 0.0))
    centroid = float(getattr(details, "spectral_centroid", 0.0))
    entropy = float(getattr(details, "spectral_entropy", 0.0))
    is_downsampled = bool(getattr(details, "is_downsampled", False))

    # Threshold rules: extreme frequency concentration
    is_high_heavy = (high_pct >= 55.0)
    is_low_heavy = (low_pct >= 85.0)
    is_low_entropy = (entropy <= 0.40 and non_dc_power > 0.0)
    has_notable_variation = is_high_heavy or is_low_heavy or is_low_entropy

    metrics = {
        "total_non_dc_power": round(non_dc_power, 4),
        "low_frequency_energy_pct": round(low_pct, 2),
        "mid_frequency_energy_pct": round(mid_pct, 2),
        "high_frequency_energy_pct": round(high_pct, 2),
        "spectral_centroid": round(centroid, 4),
        "spectral_entropy": round(entropy, 4),
        "is_downsampled": is_downsampled,
    }

    if non_dc_power == 0.0:
        summary = "Zero non-DC spectral energy detected; image has completely uniform constant luminance."
    elif is_high_heavy:
        summary = (
            f"Elevated concentration of high-frequency spectral power ({high_pct:.1f}%); "
            "consistent with fine texture, sharp boundaries, or high-frequency grain."
        )
    elif is_low_heavy:
        summary = (
            f"Predominant concentration of low-frequency spectral power ({low_pct:.1f}%); "
            "typical of smooth gradients, broad structural content, or blur."
        )
    else:
        summary = (
            f"Balanced frequency spectrum distribution (low: {low_pct:.1f}%, mid: {mid_pct:.1f}%, "
            f"high: {high_pct:.1f}%, centroid: {centroid:.3f})."
        )

    return EvidenceDomainItem(
        domain_id="frequency",
        domain_name="Frequency Spectrum",
        status="available",
        has_notable_variation=has_notable_variation,
        summary=summary,
        metrics=metrics,
        observations=item.observations,
    )


def _evaluate_spatial_domain(item: AnalysisItem | None) -> EvidenceDomainItem:
    """Evaluate Regional Anomaly findings as a supporting spatial localization dimension."""
    if item is None or item.status == "unavailable":
        return EvidenceDomainItem(
            domain_id="spatial",
            domain_name="Spatial Consistency",
            status="unavailable",
            has_notable_variation=False,
            summary="Regional anomaly analysis was unavailable.",
            metrics={},
            observations=[],
        )

    if item.status == "failed":
        return EvidenceDomainItem(
            domain_id="spatial",
            domain_name="Spatial Consistency",
            status="failed",
            has_notable_variation=False,
            summary="Regional anomaly analysis failed to compute.",
            metrics={},
            observations=item.observations or ["Regional analysis failed."],
        )

    details = item.details
    if details is None:
        return EvidenceDomainItem(
            domain_id="spatial",
            domain_name="Spatial Consistency",
            status="insufficient_data",
            has_notable_variation=False,
            summary="Regional anomaly details were not returned.",
            metrics={},
            observations=[],
        )

    max_dev = float(getattr(details, "max_deviation_score", 0.0))
    mean_dev = float(getattr(details, "mean_deviation_score", 0.0))
    highest_reg_id = getattr(details, "highest_deviation_region_id", None)
    total_regions = int(getattr(details, "total_regions", 16))
    regional_anomalies = list(getattr(details, "regional_anomalies", []))

    elevated_count = sum(
        1 for r in regional_anomalies
        if float(getattr(r, "deviation_score", 0.0)) >= 1.5
    )

    # Notable spatial variation if peak deviation >= 2.0
    has_notable_variation = (max_dev >= 2.0)

    metrics = {
        "grid_total_regions": total_regions,
        "max_deviation_score": round(max_dev, 4),
        "mean_deviation_score": round(mean_dev, 4),
        "highest_deviation_region_id": highest_reg_id,
        "elevated_regions_count": elevated_count,
    }

    if has_notable_variation:
        summary = (
            f"Localized statistical deviation observed across spatial partitions (peak deviation: {max_dev:.2f} "
            f"in region {highest_reg_id}, mean deviation: {mean_dev:.2f}); provides supporting spatial localization."
        )
    elif max_dev < 1.0:
        summary = "Spatial properties are highly homogeneous across all grid partitions."
    else:
        summary = (
            f"Mild spatial variation observed within expected distribution (peak deviation: {max_dev:.2f}, "
            f"mean deviation: {mean_dev:.2f}); provides supporting spatial localization."
        )

    return EvidenceDomainItem(
        domain_id="spatial",
        domain_name="Spatial Consistency",
        status="available",
        has_notable_variation=has_notable_variation,
        summary=summary,
        metrics=metrics,
        observations=item.observations,
    )


def _synthesize_regional_tiles(
    reg_item: AnalysisItem | None,
) -> tuple[list[RegionalSynthesisTile], list[str], list[str], list[str], list[str]]:
    """Synthesize evidence across regions by grouping correlated features into domains.

    Addresses correlated feature weighting (TL-P3-003):
    - Combines mean_gradient, std_gradient, edge_density into a single Texture Domain score.
    - Combines std_luminance, mean_luminance into a single Luminance Domain score.
    - Combines noise_residual_std, noise_mean_abs into a single Noise Domain score.
    - Combines ela_mean, ela_variance into a single Compression Domain score.
    - Keeps regional FFT as a separate Frequency Domain score.
    - Computes composite deviation using the mean of available domain scores rather than raw features.
    """
    if reg_item is None or reg_item.details is None:
        return [], [], [], [], []

    anomalies = getattr(reg_item.details, "regional_anomalies", [])
    if not anomalies:
        return [], [], [], [], []

    tiles: list[RegionalSynthesisTile] = []
    elevated_regions: list[str] = []
    low_variation_regions: list[str] = []
    multi_domain_regions: list[str] = []
    single_domain_regions: list[str] = []

    for reg in anomalies:
        reg_id = getattr(reg, "region_id", "")
        row = int(getattr(reg, "row", 0))
        col = int(getattr(reg, "col", 0))
        raw_dev = float(getattr(reg, "deviation_score", 0.0))
        neighbor_dev = float(getattr(reg, "neighbor_deviation", 0.0))
        z_dict: dict[str, float] = dict(getattr(reg, "z_scores", {}))

        # 1. Group into Domain Z-Scores to remove collinear overweighting (TL-P3-003)
        domain_z_scores: dict[str, float] = {}

        # Texture domain: average of gradient metrics
        texture_keys = [k for k in ("mean_gradient", "std_gradient", "edge_density") if k in z_dict and z_dict[k] is not None]
        if texture_keys:
            domain_z_scores["Texture"] = float(np.mean([float(z_dict[k]) for k in texture_keys]))

        # Luminance domain: average of luminance metrics
        luminance_keys = [k for k in ("std_luminance", "mean_luminance") if k in z_dict and z_dict[k] is not None]
        if luminance_keys:
            domain_z_scores["Luminance"] = float(np.mean([float(z_dict[k]) for k in luminance_keys]))

        # Noise domain: average of noise residual metrics
        noise_keys = [k for k in ("noise_residual_std", "noise_mean_abs") if k in z_dict and z_dict[k] is not None]
        if noise_keys:
            domain_z_scores["Noise"] = float(np.mean([float(z_dict[k]) for k in noise_keys]))

        # Compression domain: average of ELA metrics
        ela_keys = [k for k in ("ela_mean", "ela_variance") if k in z_dict and z_dict[k] is not None]
        if ela_keys:
            domain_z_scores["Compression"] = float(np.mean([float(z_dict[k]) for k in ela_keys]))

        # Regional Frequency domain
        freq_keys = [k for k in ("regional_fft_high_freq_ratio",) if k in z_dict and z_dict[k] is not None]
        if freq_keys:
            domain_z_scores["Frequency"] = float(np.mean([float(z_dict[k]) for k in freq_keys]))

        # Grouped composite deviation score across available domain z-scores (TL-P3-003)
        if domain_z_scores:
            comp_dev = float(np.mean(list(domain_z_scores.values())))
        else:
            comp_dev = raw_dev
        comp_dev = round(comp_dev, 4)

        # Contributing domains: threshold z >= 1.8
        contributing = [d_name for d_name, z_val in domain_z_scores.items() if z_val >= 1.8]
        domain_count = len(contributing)
        is_multi_domain = domain_count >= 2

        # Variation level precedence (TL-P3-002)
        # Low variation is assigned ONLY when zero domains are elevated and composite deviation <= 0.4
        if domain_count >= 3 or comp_dev >= 3.0:
            var_level = "divergent"
        elif is_multi_domain or comp_dev >= 1.5:
            var_level = "elevated"
        elif domain_count == 0 and comp_dev <= 0.4:
            var_level = "low"
        else:
            var_level = "typical"

        # Neighbor contrast
        if neighbor_dev >= 1.8:
            contrast = "sharp"
        elif neighbor_dev >= 0.9:
            contrast = "moderate"
        else:
            contrast = "consistent"

        # Summary
        if is_multi_domain:
            summary = (
                f"Multi-domain statistical variation ({', '.join(contributing)}); "
                f"composite deviation: {comp_dev:.2f}, neighbor contrast: {contrast}."
            )
        elif domain_count == 1:
            if comp_dev >= 1.5:
                summary = (
                    f"Isolated variation in {contributing[0]} domain (z={domain_z_scores[contributing[0]]:.2f}); "
                    f"composite deviation: {comp_dev:.2f}, neighbor contrast: {contrast}."
                )
            else:
                summary = (
                    f"Isolated variation in {contributing[0]} domain (z={domain_z_scores[contributing[0]]:.2f}); "
                    f"other properties align with image medians."
                )
        elif var_level == "low":
            summary = "Measurements are highly uniform and match image-wide medians."
        else:
            summary = f"Measurements are consistent with expected spatial distribution (deviation: {comp_dev:.2f})."

        tile = RegionalSynthesisTile(
            region_id=reg_id,
            row=row,
            col=col,
            variation_level=var_level,  # type: ignore[arg-type]
            contributing_domains=contributing,
            domain_count_with_variation=domain_count,
            is_multi_domain_variation=is_multi_domain,
            neighbor_contrast=contrast,  # type: ignore[arg-type]
            summary=summary,
        )
        tiles.append(tile)

        if var_level in {"elevated", "divergent"}:
            elevated_regions.append(reg_id)
        elif var_level == "low":
            low_variation_regions.append(reg_id)

        if is_multi_domain:
            multi_domain_regions.append(reg_id)
        elif domain_count == 1:
            single_domain_regions.append(reg_id)

    return (
        tiles,
        elevated_regions,
        low_variation_regions,
        multi_domain_regions,
        single_domain_regions,
    )


def _build_key_observations(
    domains: list[EvidenceDomainItem],
    converging_regions: list[str],
    elevated_regions: list[str],
    num_independent_with_obs: int = 0,
) -> list[KeyObservation]:
    """Generate structured, human-readable forensic observations backed by real metrics."""
    observations: list[KeyObservation] = []
    domain_map = {d.domain_id: d for d in domains}

    # 1. Metadata observation
    meta_dom = domain_map.get("metadata")
    if meta_dom and meta_dom.status == "available":
        m = meta_dom.metrics
        if m.get("is_editing_software_indicated"):
            observations.append(
                KeyObservation(
                    observation_id="OBS-META-001",
                    title="Editing Software Signature Detected in EXIF",
                    description=(
                        f"Image metadata indicates post-capture processing or export via {m.get('software')}."
                    ),
                    relevant_domains=["metadata"],
                    supporting_metrics={"software": m.get("software")},
                    region_ids=[],
                    neutral_interpretation=(
                        "Software tags confirm that the file underwent export or editing in an image processing application."
                    ),
                    limitations=[
                        "Software tags can indicate innocent format conversion, cropping, or color adjustment, and can be forged or stripped."
                    ],
                )
            )
        elif not m.get("exif_present"):
            observations.append(
                KeyObservation(
                    observation_id="OBS-META-002",
                    title="Absence of Camera EXIF Metadata",
                    description="No EXIF metadata was detected in the file structure.",
                    relevant_domains=["metadata"],
                    supporting_metrics={"exif_present": False},
                    region_ids=[],
                    neutral_interpretation=(
                        "The absence of EXIF metadata is standard across social media, messaging apps, and web pipelines."
                    ),
                    limitations=[
                        "Absence of metadata does not indicate image manipulation, synthetic generation, or authenticity."
                    ],
                )
            )

    # 2. Compression observation (ELA)
    comp_dom = domain_map.get("compression")
    if comp_dom and comp_dom.status == "available":
        m = comp_dom.metrics
        if comp_dom.has_notable_variation:
            observations.append(
                KeyObservation(
                    observation_id="OBS-ELA-001",
                    title="Spatial Variation in JPEG Recompression Error",
                    description=(
                        f"Regional mean difference spread of {m.get('regional_mean_spread', 0.0):.2f} "
                        f"observed at recompression quality {m.get('recompression_quality')}."
                    ),
                    relevant_domains=["compression"],
                    supporting_metrics={
                        "mean_difference": m.get("mean_difference"),
                        "regional_mean_spread": m.get("regional_mean_spread"),
                    },
                    region_ids=[],
                    neutral_interpretation=(
                        "Non-uniform error levels can stem from varying edge density, detailed textures, or differing compression histories."
                    ),
                    limitations=[
                        "Error Level Analysis measures relative error to an arbitrary baseline; it does not establish tampering."
                    ],
                )
            )

    # 3. Noise observation
    noise_dom = domain_map.get("noise")
    if noise_dom and noise_dom.status == "available":
        m = noise_dom.metrics
        if noise_dom.has_notable_variation:
            observations.append(
                KeyObservation(
                    observation_id="OBS-NOISE-001",
                    title="Elevated Dispersion in High-Frequency Residuals",
                    description=(
                        f"Regional residual standard deviation varies by {m.get('regional_std_spread', 0.0):.2f} "
                        f"(heterogeneity ratio: {m.get('regional_noise_heterogeneity', 0.0):.2f})."
                    ),
                    relevant_domains=["noise"],
                    supporting_metrics={
                        "residual_std": m.get("residual_std"),
                        "regional_std_spread": m.get("regional_std_spread"),
                    },
                    region_ids=[],
                    neutral_interpretation=(
                        "Spatial variations in high-frequency residuals naturally track detailed foreground subjects and sharp contours."
                    ),
                    limitations=[
                        "Gaussian low-pass residuals measure high-frequency image structure rather than pure hardware sensor noise."
                    ],
                )
            )

    # 4. Frequency observation
    freq_dom = domain_map.get("frequency")
    if freq_dom and freq_dom.status == "available":
        m = freq_dom.metrics
        if freq_dom.has_notable_variation:
            observations.append(
                KeyObservation(
                    observation_id="OBS-FREQ-001",
                    title="Distinct Spectral Energy Concentration",
                    description=(
                        f"2D FFT frequency distribution exhibits high-frequency power of {m.get('high_frequency_energy_pct', 0.0):.1f}% "
                        f"and low-frequency power of {m.get('low_frequency_energy_pct', 0.0):.1f}%."
                    ),
                    relevant_domains=["frequency"],
                    supporting_metrics={
                        "high_frequency_energy_pct": m.get("high_frequency_energy_pct"),
                        "low_frequency_energy_pct": m.get("low_frequency_energy_pct"),
                        "spectral_centroid": m.get("spectral_centroid"),
                    },
                    region_ids=[],
                    neutral_interpretation=(
                        "Frequency roll-off reflects global scene sharpness, fine texture density, and compression history."
                    ),
                    limitations=[
                        "Fourier spectral energy reflects photographic scene content and does not isolate localized editing."
                    ],
                )
            )

    # 5. Spatial Anomaly observation
    spat_dom = domain_map.get("spatial")
    if spat_dom and spat_dom.status == "available":
        m = spat_dom.metrics
        if spat_dom.has_notable_variation:
            observations.append(
                KeyObservation(
                    observation_id="OBS-SPAT-001",
                    title="Localized Regional Statistical Outlier Detected",
                    description=(
                        f"Region {m.get('highest_deviation_region_id')} exhibits peak statistical deviation "
                        f"of {m.get('max_deviation_score', 0.0):.2f} from image-wide medians."
                    ),
                    relevant_domains=["spatial"],
                    supporting_metrics={
                        "max_deviation_score": m.get("max_deviation_score"),
                        "highest_deviation_region_id": m.get("highest_deviation_region_id"),
                        "elevated_regions_count": m.get("elevated_regions_count"),
                    },
                    region_ids=[str(m.get("highest_deviation_region_id"))] if m.get("highest_deviation_region_id") else [],
                    neutral_interpretation=(
                        "The identified region demonstrates significant statistical contrast in measured properties against the overall image."
                    ),
                    limitations=[
                        "Regional contrast occurs naturally in photographic compositions due to depth of field, lighting, and focus."
                    ],
                )
            )

    # 6. Cross-domain Coincident observation (TL-P3-001: requires at least 2 independent domains with observations and spatial overlap)
    if num_independent_with_obs >= 2 and converging_regions:
        observations.append(
            KeyObservation(
                observation_id="OBS-CROSS-001",
                title="Coincident Multi-Domain Spatial Variation",
                description=(
                    f"Multiple independent feature domains exhibit coincident statistical variation "
                    f"in region(s): {', '.join(converging_regions)}."
                ),
                relevant_domains=["spatial", "noise", "compression", "frequency"],
                supporting_metrics={
                    "multi_domain_region_count": len(converging_regions),
                    "regions": converging_regions,
                },
                region_ids=converging_regions,
                neutral_interpretation=(
                    "When multiple analytical domains show simultaneous variation in the same spatial tiles, "
                    "it highlights concentrated localized contrast. This typically coincides with intricate foreground "
                    "subjects or sharp texture transitions."
                ),
                limitations=[
                    "Multi-domain coincidence reflects concentrated physical contrast, not diagnostic proof of image manipulation."
                ],
            )
        )

    return observations


def synthesize_evidence(
    analyses: list[AnalysisItem],
    *,
    image_properties: ImageProperties | None = None,
    image_format: str = "UNKNOWN",
) -> SynthesisDetails:
    """Aggregate multi-domain forensic evidence into a unified, explainable interpretation.

    Args:
        analyses: List of existing Phase 2 AnalysisItems (metadata, ela, noise, frequency, regional).
        image_properties: Optional validated image properties.
        image_format: Image format string (JPEG, PNG, WEBP).

    Returns:
        SynthesisDetails containing domain evaluations, cross-domain synthesis,
        key observations, and regional alignment.
    """
    analysis_map: dict[str, AnalysisItem] = {a.name: a for a in analyses}

    # 1. Evaluate individual evidence domains
    dom_meta = _evaluate_metadata_domain(analysis_map.get("metadata"))
    dom_comp = _evaluate_compression_domain(analysis_map.get("ela"))
    dom_noise = _evaluate_noise_domain(analysis_map.get("noise"))
    dom_freq = _evaluate_frequency_domain(analysis_map.get("frequency"))
    dom_spat = _evaluate_spatial_domain(analysis_map.get("regional"))

    # Preserve all 5 domains for API schema compatibility and UI presentation
    domains: list[EvidenceDomainItem] = [
        dom_meta,
        dom_comp,
        dom_noise,
        dom_freq,
        dom_spat,
    ]

    # Independent top-level evidence domains (TL-P3-001)
    # Spatial Consistency serves as a supporting localization dimension, not an independent domain
    independent_domains: list[EvidenceDomainItem] = [
        dom_meta,
        dom_comp,
        dom_noise,
        dom_freq,
    ]

    available_independent = [d for d in independent_domains if d.status == "available"]
    independent_with_obs = [d for d in available_independent if d.has_notable_variation]

    num_available = len(available_independent)
    num_with_obs = len(independent_with_obs)
    primary_contributing = [d.domain_id for d in independent_with_obs]

    # 2. Regional multi-domain synthesis
    (
        tiles,
        elevated_regions,
        low_variation_regions,
        multi_domain_regions,
        single_domain_regions,
    ) = _synthesize_regional_tiles(analysis_map.get("regional"))

    # Map independent domain IDs to tile contributing domain names for spatial convergence (TL-P3-001)
    domain_id_to_tile_name = {
        "compression": "Compression",
        "noise": "Noise",
        "frequency": "Frequency",
    }
    spatial_contributing_domains = {
        domain_id_to_tile_name[d]
        for d in primary_contributing
        if d in domain_id_to_tile_name
    }

    # Converging regions: tiles where at least TWO independent contributing domains show variation
    converging_regions: list[str] = []
    if len(spatial_contributing_domains) >= 2:
        for tile in tiles:
            matched = set(tile.contributing_domains).intersection(spatial_contributing_domains)
            if len(matched) >= 2:
                converging_regions.append(tile.region_id)

    reg_summary_text = (
        f"Evaluated {len(tiles)} spatial partitions. "
        f"Elevated variation found in {len(elevated_regions)} region(s); "
        f"{len(multi_domain_regions)} region(s) exhibited multi-domain coincidence."
    )

    regional_synthesis = RegionalSynthesis(
        grid_rows=4,
        grid_cols=4,
        total_regions=len(tiles),
        elevated_regions=elevated_regions,
        low_variation_regions=low_variation_regions,
        multi_domain_regions=multi_domain_regions,
        single_domain_regions=single_domain_regions,
        tiles=tiles,
        summary=reg_summary_text,
    )

    # 3. Cross-Domain Relationships
    cross_relationships: list[CrossDomainRelationship] = []

    # Check Compression & Noise cross-relationship
    if dom_comp.status == "available" and dom_noise.status == "available":
        if dom_comp.has_notable_variation and dom_noise.has_notable_variation:
            cross_relationships.append(
                CrossDomainRelationship(
                    domains=["compression", "noise"],
                    relationship_type="converging",
                    description="Both compression error levels and residual noise statistics exhibit non-uniform spatial patterns.",
                    supporting_evidence=[
                        f"ELA regional mean spread: {dom_comp.metrics.get('regional_mean_spread', 0.0):.2f}",
                        f"Noise residual std spread: {dom_noise.metrics.get('regional_std_spread', 0.0):.2f}",
                    ],
                )
            )
        elif dom_comp.has_notable_variation != dom_noise.has_notable_variation:
            cross_relationships.append(
                CrossDomainRelationship(
                    domains=["compression", "noise"],
                    relationship_type="diverging",
                    description="Compression error and residual noise distributions show divergent uniformity characteristics.",
                    supporting_evidence=[
                        f"Compression variation: {dom_comp.has_notable_variation}",
                        f"Noise residual variation: {dom_noise.has_notable_variation}",
                    ],
                )
            )
        else:
            cross_relationships.append(
                CrossDomainRelationship(
                    domains=["compression", "noise"],
                    relationship_type="independent",
                    description="Both compression error and residual noise distributions are spatially homogeneous.",
                    supporting_evidence=["Low regional dispersion across both domains."],
                )
            )

    # Check Spatial & Multi-domain alignment (TL-P3-001: requires confirmed convergence across independent domains)
    if converging_regions:
        cross_relationships.append(
            CrossDomainRelationship(
                domains=["spatial"] + [d for d in primary_contributing if d in {"noise", "compression", "frequency"}],
                relationship_type="converging",
                description=f"Spatial anomaly analysis detected multi-domain feature convergence across independent domains in {len(converging_regions)} region(s).",
                supporting_evidence=[f"Regions: {', '.join(converging_regions)}"],
            )
        )

    # 4. Overall Evidence Synthesis Relationship
    if num_available < 2:
        relationship_label = "insufficient_evidence"
        synthesis_statement = (
            "Fewer than two independent forensic domains were available for evaluation. "
            "Insufficient evidence exists to perform cross-domain synthesis."
        )
    elif num_with_obs == 0:
        relationship_label = "no_notable_variation"
        synthesis_statement = (
            f"All {num_available} evaluated independent evidence domains exhibit uniform, expected statistical distributions. "
            "No notable statistical variation was detected across metadata, compression, noise, or frequency domains."
        )
    elif num_with_obs == 1:
        relationship_label = "isolated_observation"
        isolated_domain_name = independent_with_obs[0].domain_name
        synthesis_statement = (
            f"An isolated statistical observation was identified in the {isolated_domain_name} domain, "
            f"while all other {num_available - 1} independent domains show typical distributions."
        )
        if dom_spat.has_notable_variation and dom_spat.metrics.get("highest_deviation_region_id"):
            synthesis_statement += f" Supporting spatial analysis localized peak variation to region {dom_spat.metrics['highest_deviation_region_id']}."
    elif converging_regions:
        relationship_label = "converging_observations"
        synthesis_statement = (
            f"Multiple independent evidence domains ({', '.join(primary_contributing)}) exhibit coincident "
            f"statistical observations, with spatial convergence confirmed in region(s): {', '.join(converging_regions)}."
        )
    else:
        relationship_label = "mixed_observations"
        synthesis_statement = (
            f"Multiple evidence domains ({', '.join(primary_contributing)}) display statistical observations, "
            "but without spatial convergence across identical image regions."
        )

    evidence_summary = EvidenceSummary(
        relationship=relationship_label,  # type: ignore[arg-type]
        domains_available=num_available,
        domains_with_observations=num_with_obs,
        primary_contributing_domains=primary_contributing,
        synthesis_statement=synthesis_statement,
    )

    # 5. Key Observations
    key_observations = _build_key_observations(
        domains,
        converging_regions,
        elevated_regions,
        num_independent_with_obs=num_with_obs,
    )

    # 6. Comprehensive Limitations
    limitations = [
        "Statistical variation across evidence domains reflects natural image characteristics (lighting, depth of field, scene texture, and camera processing) and does not establish image manipulation.",
        "TruthLens evidence synthesis provides explainable statistical observations and does not output authenticity percentages, manipulation confidence scores, or binary real/fake verdicts.",
        "Absence of metadata is standard across web, social media, and messaging pipelines and must never be interpreted as evidence of manipulation or AI generation.",
    ]
    if dom_comp.status == "unavailable":
        limitations.append("Compression domain analysis (ELA) was unavailable because the input format is not JPEG.")
    if any(getattr(d, "status", None) == "failed" for d in domains):
        limitations.append("One or more analytical modules encountered execution errors; synthesis was performed on available domains only.")

    methodology = MethodologyInfo(
        version=SYNTHESIS_VERSION,
        correlated_feature_policy=(
            "Correlated features (e.g. gradient statistics, noise residual mean/std) are aggregated "
            "into unified domain-level metrics to prevent multi-collinear overweighting in composite scores. "
            "Spatial consistency serves as a supporting localization dimension rather than an independent domain."
        ),
        aggregation_approach=(
            "Rule-based deterministic synthesis evaluating domain-level variation, spatial grid alignment, "
            "and cross-domain convergence without machine-learning classifiers or external APIs."
        ),
        disclaimer=(
            "TruthLens is an forensic evidence analysis engine. Regional or cross-domain differences "
            "are descriptive observations, not proof of tampering, AI generation, or authenticity."
        ),
    )

    return SynthesisDetails(
        evidence_summary=evidence_summary,
        domains=domains,
        cross_domain_relationships=cross_relationships,
        key_observations=key_observations,
        regional_synthesis=regional_synthesis,
        limitations=limitations,
        methodology=methodology,
    )


def build_synthesis_analysis(
    analyses: list[AnalysisItem],
    *,
    image_properties: ImageProperties | None = None,
    image_format: str = "UNKNOWN",
) -> AnalysisItem:
    """Run Phase 3 Evidence Aggregation & Synthesis and package it as an AnalysisItem."""
    try:
        details = synthesize_evidence(
            analyses,
            image_properties=image_properties,
            image_format=image_format,
        )

        observations = [
            details.evidence_summary.synthesis_statement,
            f"Available domains: {details.evidence_summary.domains_available}, "
            f"domains with notable observations: {details.evidence_summary.domains_with_observations}.",
        ]

        metrics: dict[str, Any] = {
            "relationship": details.evidence_summary.relationship,
            "domains_available": details.evidence_summary.domains_available,
            "domains_with_observations": details.evidence_summary.domains_with_observations,
            "primary_contributing_domains": details.evidence_summary.primary_contributing_domains,
            "key_observation_count": len(details.key_observations),
            "multi_domain_region_count": len(details.regional_synthesis.multi_domain_regions),
            "elevated_region_count": len(details.regional_synthesis.elevated_regions),
        }

        return AnalysisItem(
            name="synthesis",
            status="completed",
            observations=observations,
            metrics=metrics,
            limitations=details.limitations,
            details=details,
        )

    except Exception as exc:
        return AnalysisItem(
            name="synthesis",
            status="failed",
            observations=[f"Evidence synthesis failed: {str(exc)}"],
            metrics={},
            limitations=[
                "Evidence synthesis failed due to an unexpected processing error.",
            ],
            details=None,
        )
