"""Comprehensive tests for Evidence Aggregation & Synthesis Engine (Phase 3)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models.schemas import (
    AnalysisItem,
    AnalyzeResponse,
    ELADetails,
    EvidenceSummary,
    FrequencyDetails,
    MetadataDetails,
    NoiseDetails,
    RegionalAnomalyDetails,
    RegionalAnomalyItem,
    SynthesisDetails,
)
from app.services.synthesis import (
    build_synthesis_analysis,
    synthesize_evidence,
)
from tests.conftest import make_image_bytes


def _make_dummy_regional_anomaly(
    region_id: str,
    row: int,
    col: int,
    dev_score: float = 0.0,
    z_scores: dict[str, float] | None = None,
) -> RegionalAnomalyItem:
    """Helper to create dummy RegionalAnomalyItem."""
    return RegionalAnomalyItem(
        region_id=region_id,
        row=row,
        col=col,
        x=col * 20,
        y=row * 20,
        width=20,
        height=20,
        mean_luminance=128.0,
        std_luminance=10.0,
        min_luminance=100.0,
        max_luminance=150.0,
        mean_gradient=5.0,
        std_gradient=2.0,
        edge_density=1.0,
        deviation_score=dev_score,
        neighbor_deviation=0.5,
        z_scores=z_scores or {},
        observation="Normal region.",
    )


def test_1_all_domains_available_converging() -> None:
    """Test 1: All 5 domains available; coincident variations lead to converging_observations."""
    # Metadata with editing software
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(
            exif_present=True,
            software="Adobe Photoshop CC 2024",
            fields_found=["software", "camera_make"],
        ),
    )
    # ELA with notable variation
    ela = AnalysisItem(
        name="ela",
        status="completed",
        details=ELADetails(
            recompression_quality=90,
            scale_factor=10.0,
            mean_difference=12.0,
            median_difference=10.0,
            max_difference=45.0,
            p95_difference=25.0,
            p99_difference=35.0,
            regional_summary={"mean_spread": 6.5},
            threshold_percentages={"above_20": 15.0},
        ),
    )
    # Noise with notable variation
    noise = AnalysisItem(
        name="noise",
        status="completed",
        details=NoiseDetails(
            smoothing_sigma=1.0,
            residual_mean=0.0,
            residual_std=8.0,
            mean_absolute_residual=6.0,
            median_absolute_residual=5.0,
            max_absolute_residual=30.0,
            p95_absolute_residual=15.0,
            p99_absolute_residual=22.0,
            regional_summary={"std_min": 2.0, "std_max": 8.5, "std_mean": 4.0},
        ),
    )
    # Frequency with balanced distribution
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=1000.0,
            low_frequency_power=500.0,
            mid_frequency_power=300.0,
            high_frequency_power=200.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.35,
            spectral_entropy=0.75,
        ),
    )
    # Regional anomaly with multi-domain variation in r0_c0
    anomalies = [
        _make_dummy_regional_anomaly(
            f"r{r}_c{c}",
            r,
            c,
            dev_score=2.8 if (r == 0 and c == 0) else 0.2,
            z_scores={
                "mean_gradient": 2.5,
                "noise_residual_std": 2.4,
                "ela_mean": 2.1,
            }
            if (r == 0 and c == 0)
            else {"mean_gradient": 0.1},
        )
        for r in range(4)
        for c in range(4)
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.8,
            mean_deviation_score=0.4,
            highest_deviation_region_id="r0_c0",
            regional_anomalies=anomalies,
        ),
    )

    details = synthesize_evidence([meta, ela, noise, freq, reg], image_format="JPEG")
    # 4 independent evidence domains (Metadata, Compression, Noise, Frequency); Spatial is supporting
    assert details.evidence_summary.domains_available == 4
    assert len(details.domains) == 5
    assert details.evidence_summary.relationship == "converging_observations"
    assert "r0_c0" in details.regional_synthesis.multi_domain_regions
    assert len(details.key_observations) >= 4


def test_2_ela_unavailable_png() -> None:
    """Test 2: PNG format with ELA unavailable is handled gracefully without crashing."""
    ela = AnalysisItem(
        name="ela",
        status="unavailable",
        observations=["Error Level Analysis skipped: format is not JPEG."],
    )
    noise = AnalysisItem(
        name="noise",
        status="completed",
        details=NoiseDetails(
            smoothing_sigma=1.0,
            residual_mean=0.0,
            residual_std=2.0,
            mean_absolute_residual=1.5,
            median_absolute_residual=1.0,
            max_absolute_residual=10.0,
            p95_absolute_residual=4.0,
            p99_absolute_residual=6.0,
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=500.0,
            low_frequency_power=300.0,
            mid_frequency_power=150.0,
            high_frequency_power=50.0,
            low_frequency_energy_pct=60.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=10.0,
            spectral_centroid=0.25,
            spectral_entropy=0.7,
        ),
    )

    details = synthesize_evidence([ela, noise, freq], image_format="PNG")
    comp_dom = next(d for d in details.domains if d.domain_id == "compression")
    assert comp_dom.status == "unavailable"
    assert comp_dom.has_notable_variation is False
    assert any("JPEG" in lim for lim in details.limitations)


def test_3_other_modules_unavailable() -> None:
    """Test 3: If frequency or noise is unavailable, synthesis evaluates remaining domains."""
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(exif_present=False),
    )
    freq = AnalysisItem(
        name="frequency",
        status="unavailable",
        observations=["Format does not support frequency analysis."],
    )
    noise = AnalysisItem(
        name="noise",
        status="completed",
        details=NoiseDetails(
            smoothing_sigma=1.0,
            residual_mean=0.0,
            residual_std=1.0,
            mean_absolute_residual=0.8,
            median_absolute_residual=0.5,
            max_absolute_residual=5.0,
            p95_absolute_residual=2.0,
            p99_absolute_residual=3.0,
        ),
    )

    details = synthesize_evidence([meta, freq, noise])
    freq_dom = next(d for d in details.domains if d.domain_id == "frequency")
    assert freq_dom.status == "unavailable"
    assert details.evidence_summary.domains_available == 2


def test_4_multiple_domains_showing_observations_mixed() -> None:
    """Test 4: Multiple domains show observations without spatial convergence -> mixed_observations."""
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(
            exif_present=True,
            software="Adobe Lightroom",
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=2000.0,
            low_frequency_power=200.0,
            mid_frequency_power=600.0,
            high_frequency_power=1200.0,
            low_frequency_energy_pct=10.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=60.0,  # Elevated high-frequency
            spectral_centroid=0.55,
            spectral_entropy=0.8,
        ),
    )
    # Regional anomaly has low deviation everywhere
    anomalies = [
        _make_dummy_regional_anomaly(f"r{r}_c{c}", r, c, dev_score=0.3)
        for r in range(4)
        for c in range(4)
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.5,
            mean_deviation_score=0.2,
            regional_anomalies=anomalies,
        ),
    )

    details = synthesize_evidence([meta, freq, reg])
    assert details.evidence_summary.domains_with_observations == 2
    assert details.evidence_summary.relationship == "mixed_observations"


def test_5_only_one_domain_showing_observations() -> None:
    """Test 5: Exactly 1 domain showing observations -> isolated_observation."""
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(
            exif_present=True,
            software="GIMP 2.10",
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=1000.0,
            low_frequency_power=500.0,
            mid_frequency_power=300.0,
            high_frequency_power=200.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.3,
            spectral_entropy=0.75,
        ),
    )

    details = synthesize_evidence([meta, freq])
    assert details.evidence_summary.domains_with_observations == 1
    assert details.evidence_summary.relationship == "isolated_observation"
    assert "Metadata" in details.evidence_summary.synthesis_statement


def test_6_no_notable_variation() -> None:
    """Test 6: All available domains show expected uniform properties -> no_notable_variation."""
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(
            exif_present=True,
            camera_make="Canon",
            camera_model="EOS R5",
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=1000.0,
            low_frequency_power=500.0,
            mid_frequency_power=300.0,
            high_frequency_power=200.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.3,
            spectral_entropy=0.75,
        ),
    )
    anomalies = [
        _make_dummy_regional_anomaly(f"r{r}_c{c}", r, c, dev_score=0.2)
        for r in range(4)
        for c in range(4)
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.4,
            mean_deviation_score=0.2,
            regional_anomalies=anomalies,
        ),
    )

    details = synthesize_evidence([meta, freq, reg])
    assert details.evidence_summary.domains_with_observations == 0
    assert details.evidence_summary.relationship == "no_notable_variation"


def test_7_insufficient_evidence() -> None:
    """Test 7: Fewer than 2 domains available -> insufficient_evidence."""
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=100.0,
            low_frequency_power=50.0,
            mid_frequency_power=30.0,
            high_frequency_power=20.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.3,
            spectral_entropy=0.7,
        ),
    )

    details = synthesize_evidence([freq])
    assert details.evidence_summary.domains_available == 1
    assert details.evidence_summary.relationship == "insufficient_evidence"


def test_8_missing_metrics_resilience() -> None:
    """Test 8: Module with details=None is handled safely without crashing."""
    meta = AnalysisItem(name="metadata", status="completed", details=None)
    ela = AnalysisItem(name="ela", status="completed", details=None)

    details = synthesize_evidence([meta, ela])
    meta_dom = next(d for d in details.domains if d.domain_id == "metadata")
    assert meta_dom.status == "insufficient_data"


def test_9_null_metrics_resilience() -> None:
    """Test 9: Fields with None are handled safely."""
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(
            exif_present=False,
            camera_make=None,
            camera_model=None,
            software=None,
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=10,
            analysis_height=10,
            original_width=10,
            original_height=10,
            is_downsampled=False,
            total_non_dc_power=0.0,
            low_frequency_power=0.0,
            mid_frequency_power=0.0,
            high_frequency_power=0.0,
            low_frequency_energy_pct=0.0,
            mid_frequency_energy_pct=0.0,
            high_frequency_energy_pct=0.0,
            spectral_centroid=0.0,
            spectral_entropy=0.0,
        ),
    )

    details = synthesize_evidence([meta, freq])
    assert details.evidence_summary.domains_available == 2


def test_10_invalid_metrics_resilience() -> None:
    """Test 10: Unexpected metric structures do not cause unhandled exceptions."""
    weird_item = AnalysisItem(
        name="metadata",
        status="completed",
        details={"unknown_field": "test"},  # type: ignore[arg-type]
    )
    details = synthesize_evidence([weird_item])
    assert details is not None


def test_11_correlated_metrics_not_overweighted() -> None:
    """Test 11: Gradient mean, std, and edge density are grouped into one Texture domain."""
    # Create tile with high gradient metrics across all 3 collinear features
    tile = _make_dummy_regional_anomaly(
        "r0_c0",
        0,
        0,
        dev_score=2.2,
        z_scores={
            "mean_gradient": 3.0,
            "std_gradient": 3.0,
            "edge_density": 3.0,
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.2,
            mean_deviation_score=0.5,
            regional_anomalies=[tile],
        ),
    )

    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    # Must be counted as exactly ONE domain ("Texture"), not 3 separate domains!
    assert s_tile.contributing_domains == ["Texture"]
    assert s_tile.domain_count_with_variation == 1
    assert s_tile.is_multi_domain_variation is False


def test_12_regional_metric_alignment_by_id() -> None:
    """Test 12: Tiles are aligned by region_id, not array position."""
    # Reverse tile order
    tiles = [
        _make_dummy_regional_anomaly(f"r{r}_c{c}", r, c, dev_score=float(r * 4 + c))
        for r in reversed(range(4))
        for c in reversed(range(4))
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=15.0,
            mean_deviation_score=7.5,
            regional_anomalies=tiles,
        ),
    )

    details = synthesize_evidence([reg])
    # Check that region_id matching is maintained
    r0_c0_tile = next(t for t in details.regional_synthesis.tiles if t.region_id == "r0_c0")
    assert r0_c0_tile.row == 0 and r0_c0_tile.col == 0


def test_13_tiny_images_synthesis() -> None:
    """Test 13: Extremely small images synthesize without division by zero."""
    data = make_image_bytes(fmt="PNG", size=(4, 4))
    item = build_synthesis_analysis([], image_format="PNG")
    assert item.name == "synthesis"
    assert item.status == "completed"


def test_14_uniform_images_synthesis() -> None:
    """Test 14: Uniform solid-color image yields no_notable_variation."""
    meta = AnalysisItem(name="metadata", status="completed", details=MetadataDetails(exif_present=False))
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=32,
            analysis_height=32,
            original_width=32,
            original_height=32,
            is_downsampled=False,
            total_non_dc_power=0.0,
            low_frequency_power=0.0,
            mid_frequency_power=0.0,
            high_frequency_power=0.0,
            low_frequency_energy_pct=0.0,
            mid_frequency_energy_pct=0.0,
            high_frequency_energy_pct=0.0,
            spectral_centroid=0.0,
            spectral_entropy=0.0,
        ),
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.0,
            mean_deviation_score=0.0,
            regional_anomalies=[
                _make_dummy_regional_anomaly(f"r{r}_c{c}", r, c, dev_score=0.0)
                for r in range(4)
                for c in range(4)
            ],
        ),
    )

    details = synthesize_evidence([meta, freq, reg])
    assert details.evidence_summary.relationship == "no_notable_variation"


def test_15_partial_regional_data() -> None:
    """Test 15: If only some regional anomalies have z_scores, synthesis handles it."""
    tile1 = _make_dummy_regional_anomaly("r0_c0", 0, 0, dev_score=2.0, z_scores={"std_luminance": 2.5})
    tile2 = _make_dummy_regional_anomaly("r0_c1", 0, 1, dev_score=0.0, z_scores={})

    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.0,
            mean_deviation_score=1.0,
            regional_anomalies=[tile1, tile2],
        ),
    )

    details = synthesize_evidence([reg])
    assert len(details.regional_synthesis.tiles) == 2


def test_16_module_failures_handled() -> None:
    """Test 16: Module failures are caught and recorded as limitations."""
    failing_item = AnalysisItem(name="ela", status="failed", observations=["Decode crashed."])
    working_item = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(exif_present=False),
    )

    details = synthesize_evidence([failing_item, working_item])
    assert any("failed" in lim or "errors" in lim for lim in details.limitations)


def test_17_api_integration_post_analyze(client: TestClient) -> None:
    """Test 17: Full API integration in POST /api/v1/analyze returns Phase 3 synthesis."""
    data = make_image_bytes(fmt="JPEG", size=(64, 48), color=(100, 150, 200))
    response = client.post(
        "/api/v1/analyze",
        files={"file": ("test.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 200
    payload = response.json()

    model = AnalyzeResponse.model_validate(payload)
    assert model.phase == "phase_3"
    assert model.assessment.status == "COMPLETE"
    assert len(model.analyses) == 6

    synthesis_item = next(a for a in model.analyses if a.name == "synthesis")
    assert synthesis_item.status == "completed"
    assert "relationship" in synthesis_item.metrics

    details = synthesis_item.details
    assert isinstance(details, SynthesisDetails)
    # 4 independent domains available, while all 5 domains are present in details.domains
    assert details.evidence_summary.domains_available == 4
    assert len(details.domains) == 5
    assert len(details.regional_synthesis.tiles) == 16


def test_18_neutral_language_invariants() -> None:
    """Test 18: No speculative or diagnostic claims (fake, authentic, tampered, AI) are emitted."""
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(exif_present=True, software="Photoshop"),
    )
    item = build_synthesis_analysis([meta], image_format="JPEG")

    combined_text = " ".join(item.observations + item.limitations).lower()
    details = item.details
    if details:
        combined_text += " " + details.evidence_summary.synthesis_statement.lower()
        for obs in details.key_observations:
            combined_text += " " + obs.title.lower() + " " + obs.description.lower()

    # Diagnostic verdict terms must never appear as findings
    assert "is fake" not in combined_text
    assert "is authentic" not in combined_text
    assert "is tampered" not in combined_text
    assert "is forged" not in combined_text
    assert "is ai-generated" not in combined_text
    assert "authenticity score" not in combined_text


# ==============================================================================
# PHASE 3.1 CORRECTIVE TESTS: TL-P3-001, TL-P3-002, TL-P3-003
# ==============================================================================


def test_tl_p3_001_scenario_a_noise_alone_elevated_remains_isolated() -> None:
    """TL-P3-001 Scenario A: Noise alone elevated does not double-count with Spatial.

    - Noise: notable (high residual dispersion)
    - Compression: typical
    - Metadata: typical (no software tag)
    - Frequency: typical
    - Spatial: peak deviation >= 2.0 due to the same noise feature

    Expected:
    - Independent domain count with observations is exactly 1 (Noise).
    - Overall relationship remains isolated_observation.
    - Spatial data describes localized region without causing multi-domain corroboration.
    """
    meta = AnalysisItem(
        name="metadata",
        status="completed",
        details=MetadataDetails(exif_present=True, camera_make="Nikon"),
    )
    ela = AnalysisItem(
        name="ela",
        status="completed",
        details=ELADetails(
            recompression_quality=90,
            scale_factor=10.0,
            mean_difference=2.0,
            median_difference=1.8,
            max_difference=10.0,
            p95_difference=5.0,
            p99_difference=8.0,
            regional_summary={"mean_spread": 1.0},
        ),
    )
    noise = AnalysisItem(
        name="noise",
        status="completed",
        details=NoiseDetails(
            smoothing_sigma=1.0,
            residual_mean=0.0,
            residual_std=8.0,
            mean_absolute_residual=6.0,
            median_absolute_residual=5.0,
            max_absolute_residual=30.0,
            p95_absolute_residual=15.0,
            p99_absolute_residual=22.0,
            regional_summary={"std_min": 2.0, "std_max": 8.5, "std_mean": 4.0},
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=1000.0,
            low_frequency_power=500.0,
            mid_frequency_power=300.0,
            high_frequency_power=200.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.35,
            spectral_entropy=0.75,
        ),
    )
    anomalies = [
        _make_dummy_regional_anomaly(
            f"r{r}_c{c}",
            r,
            c,
            dev_score=2.8 if (r == 0 and c == 0) else 0.2,
            z_scores={"noise_residual_std": 2.8} if (r == 0 and c == 0) else {"noise_residual_std": 0.1},
        )
        for r in range(4)
        for c in range(4)
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.8,
            mean_deviation_score=0.4,
            highest_deviation_region_id="r0_c0",
            regional_anomalies=anomalies,
        ),
    )

    details = synthesize_evidence([meta, ela, noise, freq, reg], image_format="JPEG")

    # Independent domain tally
    assert details.evidence_summary.domains_available == 4
    assert details.evidence_summary.domains_with_observations == 1
    assert details.evidence_summary.relationship == "isolated_observation"
    assert details.evidence_summary.primary_contributing_domains == ["noise"]

    # Spatial Consistency provides supporting localization but did NOT double-count
    spat_dom = next(d for d in details.domains if d.domain_id == "spatial")
    assert spat_dom.has_notable_variation is True
    assert "r0_c0" in details.evidence_summary.synthesis_statement
    assert "Noise" in details.evidence_summary.synthesis_statement

    # Cross-domain coincident observation must NOT be generated for single-domain elevation
    obs_cross = [obs for obs in details.key_observations if obs.observation_id == "OBS-CROSS-001"]
    assert len(obs_cross) == 0


def test_tl_p3_001_scenario_b_noise_and_compression_converge_in_same_region() -> None:
    """TL-P3-001 Scenario B: Noise and Compression elevated in the same region.

    Expected:
    - Exactly 2 independent domains with observations (compression, noise).
    - Spatial overlap confirms convergence in r1_c1.
    - Relationship is converging_observations.
    - Spatial Consistency itself is NOT counted as a 3rd domain.
    """
    meta = AnalysisItem(name="metadata", status="completed", details=MetadataDetails(exif_present=False))
    ela = AnalysisItem(
        name="ela",
        status="completed",
        details=ELADetails(
            recompression_quality=90,
            scale_factor=10.0,
            mean_difference=12.0,
            median_difference=10.0,
            max_difference=45.0,
            p95_difference=25.0,
            p99_difference=35.0,
            regional_summary={"mean_spread": 6.5},
            threshold_percentages={"above_20": 15.0},
        ),
    )
    noise = AnalysisItem(
        name="noise",
        status="completed",
        details=NoiseDetails(
            smoothing_sigma=1.0,
            residual_mean=0.0,
            residual_std=8.0,
            mean_absolute_residual=6.0,
            median_absolute_residual=5.0,
            max_absolute_residual=30.0,
            p95_absolute_residual=15.0,
            p99_absolute_residual=22.0,
            regional_summary={"std_min": 2.0, "std_max": 8.5, "std_mean": 4.0},
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=1000.0,
            low_frequency_power=500.0,
            mid_frequency_power=300.0,
            high_frequency_power=200.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.35,
            spectral_entropy=0.75,
        ),
    )
    # Tile r1_c1 exhibits elevated noise AND elevated compression
    anomalies = [
        _make_dummy_regional_anomaly(
            f"r{r}_c{c}",
            r,
            c,
            dev_score=2.5 if (r == 1 and c == 1) else 0.2,
            z_scores={
                "noise_residual_std": 2.5,
                "ela_mean": 2.2,
            }
            if (r == 1 and c == 1)
            else {"noise_residual_std": 0.1, "ela_mean": 0.1},
        )
        for r in range(4)
        for c in range(4)
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.5,
            mean_deviation_score=0.4,
            highest_deviation_region_id="r1_c1",
            regional_anomalies=anomalies,
        ),
    )

    details = synthesize_evidence([meta, ela, noise, freq, reg], image_format="JPEG")

    assert details.evidence_summary.domains_available == 4
    # Exactly 2 independent domains, NOT 3
    assert details.evidence_summary.domains_with_observations == 2
    assert set(details.evidence_summary.primary_contributing_domains) == {"compression", "noise"}
    assert details.evidence_summary.relationship == "converging_observations"
    assert "r1_c1" in details.evidence_summary.synthesis_statement


def test_tl_p3_001_scenario_c_noise_and_compression_in_disjoint_regions() -> None:
    """TL-P3-001 Scenario C: Noise and Compression elevated in different, disjoint regions.

    Expected:
    - Exactly 2 independent domains with observations.
    - No spatial convergence because the regional observations do not overlap.
    - Relationship is mixed_observations.
    """
    meta = AnalysisItem(name="metadata", status="completed", details=MetadataDetails(exif_present=False))
    ela = AnalysisItem(
        name="ela",
        status="completed",
        details=ELADetails(
            recompression_quality=90,
            scale_factor=10.0,
            mean_difference=12.0,
            median_difference=10.0,
            max_difference=45.0,
            p95_difference=25.0,
            p99_difference=35.0,
            regional_summary={"mean_spread": 6.5},
            threshold_percentages={"above_20": 15.0},
        ),
    )
    noise = AnalysisItem(
        name="noise",
        status="completed",
        details=NoiseDetails(
            smoothing_sigma=1.0,
            residual_mean=0.0,
            residual_std=8.0,
            mean_absolute_residual=6.0,
            median_absolute_residual=5.0,
            max_absolute_residual=30.0,
            p95_absolute_residual=15.0,
            p99_absolute_residual=22.0,
            regional_summary={"std_min": 2.0, "std_max": 8.5, "std_mean": 4.0},
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=1000.0,
            low_frequency_power=500.0,
            mid_frequency_power=300.0,
            high_frequency_power=200.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.35,
            spectral_entropy=0.75,
        ),
    )
    # Tile r0_c0 has elevated Noise only; Tile r3_c3 has elevated Compression only
    anomalies = [
        _make_dummy_regional_anomaly(
            f"r{r}_c{c}",
            r,
            c,
            dev_score=2.0 if (r in (0, 3) and c in (0, 3)) else 0.2,
            z_scores={
                "noise_residual_std": 2.5 if (r == 0 and c == 0) else 0.1,
                "ela_mean": 2.5 if (r == 3 and c == 3) else 0.1,
            },
        )
        for r in range(4)
        for c in range(4)
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.5,
            mean_deviation_score=0.4,
            highest_deviation_region_id="r0_c0",
            regional_anomalies=anomalies,
        ),
    )

    details = synthesize_evidence([meta, ela, noise, freq, reg], image_format="JPEG")

    assert details.evidence_summary.domains_available == 4
    assert details.evidence_summary.domains_with_observations == 2
    assert set(details.evidence_summary.primary_contributing_domains) == {"compression", "noise"}
    # Disjoint spatial regions -> mixed_observations, not converging
    assert details.evidence_summary.relationship == "mixed_observations"
    assert "without spatial convergence" in details.evidence_summary.synthesis_statement


def test_tl_p3_001_spatial_alone_cannot_trigger_observations() -> None:
    """TL-P3-001: Spatial variation alone cannot trigger observations if all independent domains are typical."""
    meta = AnalysisItem(name="metadata", status="completed", details=MetadataDetails(exif_present=False))
    ela = AnalysisItem(
        name="ela",
        status="completed",
        details=ELADetails(
            recompression_quality=90,
            scale_factor=10.0,
            mean_difference=2.0,
            median_difference=1.8,
            max_difference=10.0,
            p95_difference=5.0,
            p99_difference=8.0,
            regional_summary={"mean_spread": 1.0},
        ),
    )
    noise = AnalysisItem(
        name="noise",
        status="completed",
        details=NoiseDetails(
            smoothing_sigma=1.0,
            residual_mean=0.0,
            residual_std=1.0,
            mean_absolute_residual=0.8,
            median_absolute_residual=0.5,
            max_absolute_residual=5.0,
            p95_absolute_residual=2.0,
            p99_absolute_residual=3.0,
            regional_summary={"std_min": 0.8, "std_max": 1.2, "std_mean": 1.0},
        ),
    )
    freq = AnalysisItem(
        name="frequency",
        status="completed",
        details=FrequencyDetails(
            analysis_width=64,
            analysis_height=64,
            original_width=64,
            original_height=64,
            is_downsampled=False,
            total_non_dc_power=1000.0,
            low_frequency_power=500.0,
            mid_frequency_power=300.0,
            high_frequency_power=200.0,
            low_frequency_energy_pct=50.0,
            mid_frequency_energy_pct=30.0,
            high_frequency_energy_pct=20.0,
            spectral_centroid=0.35,
            spectral_entropy=0.75,
        ),
    )
    # Regional anomaly has one tile with high deviation due to texture gradient
    anomalies = [
        _make_dummy_regional_anomaly(
            f"r{r}_c{c}",
            r,
            c,
            dev_score=2.5 if (r == 0 and c == 0) else 0.2,
            z_scores={"mean_gradient": 2.5} if (r == 0 and c == 0) else {"mean_gradient": 0.1},
        )
        for r in range(4)
        for c in range(4)
    ]
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.5,
            mean_deviation_score=0.4,
            highest_deviation_region_id="r0_c0",
            regional_anomalies=anomalies,
        ),
    )

    details = synthesize_evidence([meta, ela, noise, freq, reg], image_format="JPEG")

    assert details.evidence_summary.domains_with_observations == 0
    assert details.evidence_summary.relationship == "no_notable_variation"


# ==============================================================================
# TL-P3-002: REGIONAL CLASSIFICATION PRECEDENCE TESTS
# ==============================================================================


def test_tl_p3_002_zero_domains_low_composite_is_low() -> None:
    """TL-P3-002 Table Row 1: domain_count=0, comp_dev=0.2 -> classified as 'low'."""
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=0.2,
        z_scores={"mean_gradient": 0.2, "noise_residual_std": 0.2, "ela_mean": 0.2},
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.2,
            mean_deviation_score=0.2,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.domain_count_with_variation == 0
    assert s_tile.variation_level == "low"
    assert "r0_c0" in details.regional_synthesis.low_variation_regions
    assert "r0_c0" not in details.regional_synthesis.single_domain_regions
    assert "r0_c0" not in details.regional_synthesis.elevated_regions
    assert s_tile.summary == "Measurements are highly uniform and match image-wide medians."


def test_tl_p3_002_zero_domains_typical_composite_is_typical() -> None:
    """TL-P3-002 Table Row 2: domain_count=0, comp_dev=0.8 -> classified as 'typical'."""
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=0.8,
        z_scores={"mean_gradient": 0.8, "noise_residual_std": 0.8, "ela_mean": 0.8},
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.8,
            mean_deviation_score=0.8,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.domain_count_with_variation == 0
    assert s_tile.variation_level == "typical"
    assert "r0_c0" not in details.regional_synthesis.low_variation_regions
    assert "r0_c0" not in details.regional_synthesis.single_domain_regions
    assert "r0_c0" not in details.regional_synthesis.elevated_regions


def test_tl_p3_002_single_domain_low_composite_never_low() -> None:
    """TL-P3-002 Table Row 3: domain_count=1, comp_dev=0.38 <= 0.4.

    A region with an elevated domain must NEVER receive a 'low' variation label.
    It must be 'typical', preserving the isolated elevation in single_domain_regions and summary.
    """
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=0.38,
        z_scores={
            "mean_gradient": 1.9,  # Texture elevated (z >= 1.8)
            "std_luminance": 0.0,
            "noise_residual_std": 0.0,
            "ela_mean": 0.0,
            "regional_fft_high_freq_ratio": 0.0,
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.38,
            mean_deviation_score=0.38,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.domain_count_with_variation == 1
    assert s_tile.contributing_domains == ["Texture"]
    # Must NOT be 'low'
    assert s_tile.variation_level != "low"
    assert s_tile.variation_level == "typical"
    # Consistency between summary and region lists
    assert "r0_c0" in details.regional_synthesis.single_domain_regions
    assert "r0_c0" not in details.regional_synthesis.low_variation_regions
    assert "Isolated variation in Texture domain" in s_tile.summary


def test_tl_p3_002_single_domain_elevated_composite() -> None:
    """TL-P3-002 Table Row 4: domain_count=1, comp_dev=1.58 >= 1.5 -> 'elevated'."""
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=1.58,
        z_scores={
            "mean_gradient": 3.5,  # Texture strongly elevated
            "std_luminance": 1.1,
            "noise_residual_std": 1.1,
            "ela_mean": 1.1,
            "regional_fft_high_freq_ratio": 1.1,
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=1.58,
            mean_deviation_score=1.58,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.domain_count_with_variation == 1
    assert s_tile.variation_level == "elevated"
    assert "r0_c0" in details.regional_synthesis.elevated_regions
    assert "r0_c0" in details.regional_synthesis.single_domain_regions
    assert "r0_c0" not in details.regional_synthesis.low_variation_regions


def test_tl_p3_002_two_domains_elevated_regardless_of_low_composite() -> None:
    """TL-P3-002 Table Row 5: domain_count=2, comp_dev=0.86 -> 'elevated'."""
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=0.86,
        z_scores={
            "mean_gradient": 2.0,  # Texture
            "noise_residual_std": 2.0,  # Noise
            "std_luminance": 0.1,
            "ela_mean": 0.1,
            "regional_fft_high_freq_ratio": 0.1,
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.86,
            mean_deviation_score=0.86,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.domain_count_with_variation == 2
    assert s_tile.is_multi_domain_variation is True
    assert s_tile.variation_level == "elevated"
    assert "r0_c0" in details.regional_synthesis.elevated_regions
    assert "r0_c0" in details.regional_synthesis.multi_domain_regions
    assert "r0_c0" not in details.regional_synthesis.low_variation_regions


def test_tl_p3_002_three_domains_divergent() -> None:
    """TL-P3-002 Table Row 6: domain_count=3 -> 'divergent'."""
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=2.0,
        z_scores={
            "mean_gradient": 2.0,  # Texture
            "noise_residual_std": 2.0,  # Noise
            "ela_mean": 2.0,  # Compression
            "std_luminance": 0.5,
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.0,
            mean_deviation_score=2.0,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.domain_count_with_variation == 3
    assert s_tile.variation_level == "divergent"
    assert "r0_c0" in details.regional_synthesis.elevated_regions
    assert "r0_c0" in details.regional_synthesis.multi_domain_regions


# ==============================================================================
# TL-P3-003: GROUPED COMPOSITE DEVIATION WEIGHTING TESTS
# ==============================================================================


def test_tl_p3_003_correlated_gradient_metrics_do_not_inflate_composite() -> None:
    """TL-P3-003: 3 correlated gradient metrics do not artificially inflate the grouped composite.

    Raw unweighted average would be: (3.0*3 + 0.2*3) / 6 = 1.60 (elevated).
    Grouped domain calculation: Texture=3.0, Noise=0.2, Compression=0.2, Luminance=0.2
    Grouped composite = (3.0 + 0.2 + 0.2 + 0.2) / 4 = 0.90 (typical, not elevated!).
    """
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=1.60,
        z_scores={
            "mean_gradient": 3.0,
            "std_gradient": 3.0,
            "edge_density": 3.0,
            "noise_residual_std": 0.2,
            "ela_mean": 0.2,
            "std_luminance": 0.2,
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=1.60,
            mean_deviation_score=1.60,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.contributing_domains == ["Texture"]
    assert s_tile.domain_count_with_variation == 1
    # Grouped composite is 0.90, which is < 1.5, so tile is NOT elevated
    assert s_tile.variation_level == "typical"
    assert "r0_c0" not in details.regional_synthesis.elevated_regions


def test_tl_p3_003_only_one_gradient_metric_elevated() -> None:
    """TL-P3-003: A single elevated gradient metric averaged with typical gradient metrics does not exceed threshold."""
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=0.8,
        z_scores={
            "mean_gradient": 0.3,
            "std_gradient": 0.3,
            "edge_density": 3.0,  # only edge density is elevated
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.8,
            mean_deviation_score=0.8,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    # Texture domain average: (0.3 + 0.3 + 3.0) / 3 = 1.20 (< 1.8 threshold)
    assert s_tile.contributing_domains == []
    assert s_tile.domain_count_with_variation == 0


def test_tl_p3_003_png_format_without_ela_no_dilution() -> None:
    """TL-P3-003: In PNG format (no ELA), composite averages across available domains without dilution."""
    tile = _make_dummy_regional_anomaly(
        "r0_c0", 0, 0, dev_score=2.4,
        z_scores={
            "mean_gradient": 2.4,
            "std_luminance": 2.4,
            "noise_residual_std": 2.4,
            # No ela_mean or ela_variance
        },
    )
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=2.4,
            mean_deviation_score=2.4,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg], image_format="PNG")
    s_tile = details.regional_synthesis.tiles[0]

    # 3 domains available (Texture, Luminance, Noise), all z=2.4
    # Grouped composite = (2.4 + 2.4 + 2.4) / 3 = 2.40 (not diluted by missing ELA)
    assert s_tile.domain_count_with_variation == 3
    assert s_tile.variation_level == "divergent"


def test_tl_p3_003_zero_valued_features_and_empty_tiles() -> None:
    """TL-P3-003: Tiles with empty z_scores handle safely without division by zero."""
    tile = _make_dummy_regional_anomaly("r0_c0", 0, 0, dev_score=0.0, z_scores={})
    reg = AnalysisItem(
        name="regional",
        status="completed",
        details=RegionalAnomalyDetails(
            max_deviation_score=0.0,
            mean_deviation_score=0.0,
            regional_anomalies=[tile],
        ),
    )
    details = synthesize_evidence([reg])
    s_tile = details.regional_synthesis.tiles[0]

    assert s_tile.domain_count_with_variation == 0
    assert s_tile.variation_level == "low"
