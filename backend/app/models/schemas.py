"""Pydantic response models for the TruthLens API contract."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check payload."""

    application: str
    status: Literal["healthy"]
    version: str


class ImageProperties(BaseModel):
    """Validated image identity and basic properties."""

    filename: str | None = None
    format: str
    mime_type: str
    size_bytes: int = Field(ge=0)
    size_readable: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    aspect_ratio: float = Field(gt=0)
    pixel_count: int = Field(gt=0)
    mode: str
    has_transparency: bool


class MetadataDetails(BaseModel):
    """Structured EXIF / metadata details.

    Exact GPS coordinates are intentionally omitted for privacy.
    """

    exif_present: bool
    camera_make: str | None = None
    camera_model: str | None = None
    lens: str | None = None
    orientation: int | str | None = None
    capture_datetime: str | None = None
    digitized_datetime: str | None = None
    color_space: str | None = None
    exif_version: str | None = None
    software: str | None = None
    gps_present: bool = False
    gps_fields_present: list[str] = Field(default_factory=list)
    fields_found: list[str] = Field(default_factory=list)
    fields_missing: list[str] = Field(default_factory=list)
    parse_errors: list[str] = Field(default_factory=list)
    format_notes: str | None = None


class RegionalMetric(BaseModel):
    """Regional error metrics for a grid tile."""

    region_id: str
    row: int
    col: int
    x: int
    y: int
    width: int
    height: int
    mean_difference: float
    variance: float
    max_difference: float


class RegionalNoiseMetric(BaseModel):
    """Regional noise residual metrics for a grid tile."""

    region_id: str
    row: int
    col: int
    x: int
    y: int
    width: int
    height: int
    mean_difference: float
    std: float
    max_difference: float


class ELADetails(BaseModel):
    """Structured Error Level Analysis (ELA) details."""

    recompression_quality: int
    scale_factor: float
    mean_difference: float
    median_difference: float
    max_difference: float
    p95_difference: float
    p99_difference: float
    threshold_percentages: dict[str, float] = Field(default_factory=dict)
    channel_means: dict[str, float] = Field(default_factory=dict)
    channel_maxes: dict[str, float] = Field(default_factory=dict)
    regional_metrics: list[RegionalMetric] = Field(default_factory=list)
    regional_summary: dict[str, float] = Field(default_factory=dict)
    difference_image_data_url: str | None = None


class NoiseDetails(BaseModel):
    """Structured Noise Residual Analysis details."""

    smoothing_sigma: float
    residual_mean: float
    residual_std: float
    mean_absolute_residual: float
    median_absolute_residual: float
    max_absolute_residual: float
    p95_absolute_residual: float
    p99_absolute_residual: float
    channel_residual_means: dict[str, float] = Field(default_factory=dict)
    channel_residual_stds: dict[str, float] = Field(default_factory=dict)
    channel_mean_absolute_residuals: dict[str, float] = Field(default_factory=dict)
    regional_metrics: list[RegionalNoiseMetric] = Field(default_factory=list)
    regional_summary: dict[str, float] = Field(default_factory=dict)
    visualization_data_url: str | None = None


class FrequencyDetails(BaseModel):
    """Structured 2D Fast Fourier Transform (FFT) frequency analysis details."""

    analysis_width: int
    analysis_height: int
    original_width: int
    original_height: int
    is_downsampled: bool
    window_function: str = "hann"
    total_non_dc_power: float
    low_frequency_power: float
    mid_frequency_power: float
    high_frequency_power: float
    low_frequency_energy_pct: float
    mid_frequency_energy_pct: float
    high_frequency_energy_pct: float
    spectral_centroid: float
    spectral_entropy: float
    band_boundaries: dict[str, list[float]] = Field(default_factory=dict)
    visualization_data_url: str | None = None


class RegionalAnomalyItem(BaseModel):
    """Regional characteristics and statistical deviation metrics for a grid tile."""

    region_id: str
    row: int
    col: int
    x: int
    y: int
    width: int
    height: int
    mean_luminance: float
    std_luminance: float
    min_luminance: float
    max_luminance: float
    mean_gradient: float
    std_gradient: float
    edge_density: float
    noise_residual_std: float | None = None
    noise_mean_abs: float | None = None
    ela_mean: float | None = None
    ela_variance: float | None = None
    regional_fft_high_freq_ratio: float | None = None
    deviation_score: float
    neighbor_deviation: float
    z_scores: dict[str, float] = Field(default_factory=dict)
    observation: str


class RegionalAnomalyDetails(BaseModel):
    """Structured Regional Anomaly Analysis details."""

    grid_rows: int = 4
    grid_cols: int = 4
    total_regions: int = 16
    analyzed_features: list[str] = Field(default_factory=list)
    active_modules_used: list[str] = Field(default_factory=list)
    max_deviation_score: float
    mean_deviation_score: float
    highest_deviation_region_id: str | None = None
    regional_anomalies: list[RegionalAnomalyItem] = Field(default_factory=list)
    regional_summary: dict[str, float] = Field(default_factory=dict)
    visualization_data_url: str | None = None


class EvidenceSummary(BaseModel):
    """High-level evidence synthesis summary."""

    relationship: Literal[
        "converging_observations",
        "isolated_observation",
        "mixed_observations",
        "insufficient_evidence",
        "no_notable_variation",
    ]
    domains_available: int
    domains_with_observations: int
    primary_contributing_domains: list[str] = Field(default_factory=list)
    synthesis_statement: str


class EvidenceDomainItem(BaseModel):
    """Domain-level evidence aggregation entry."""

    domain_id: str
    domain_name: str
    status: Literal["available", "unavailable", "failed", "insufficient_data"]
    has_notable_variation: bool
    summary: str
    metrics: dict[str, Any] = Field(default_factory=dict)
    observations: list[str] = Field(default_factory=list)


class KeyObservation(BaseModel):
    """Structured, human-readable forensic observation backed by metrics."""

    observation_id: str
    title: str
    description: str
    relevant_domains: list[str] = Field(default_factory=list)
    supporting_metrics: dict[str, Any] = Field(default_factory=dict)
    region_ids: list[str] = Field(default_factory=list)
    neutral_interpretation: str
    limitations: list[str] = Field(default_factory=list)


class CrossDomainRelationship(BaseModel):
    """Relationship between multiple evidence domains."""

    domains: list[str] = Field(default_factory=list)
    relationship_type: Literal["converging", "diverging", "independent", "isolated"]
    description: str
    supporting_evidence: list[str] = Field(default_factory=list)


class RegionalSynthesisTile(BaseModel):
    """Multi-domain synthesis for an individual spatial grid tile."""

    region_id: str
    row: int
    col: int
    variation_level: Literal["low", "typical", "elevated", "divergent"]
    contributing_domains: list[str] = Field(default_factory=list)
    domain_count_with_variation: int = 0
    is_multi_domain_variation: bool = False
    neighbor_contrast: Literal["consistent", "moderate", "sharp"]
    summary: str


class RegionalSynthesis(BaseModel):
    """Spatial synthesis across all grid tiles."""

    grid_rows: int = 4
    grid_cols: int = 4
    total_regions: int = 16
    elevated_regions: list[str] = Field(default_factory=list)
    low_variation_regions: list[str] = Field(default_factory=list)
    multi_domain_regions: list[str] = Field(default_factory=list)
    single_domain_regions: list[str] = Field(default_factory=list)
    tiles: list[RegionalSynthesisTile] = Field(default_factory=list)
    summary: str


class MethodologyInfo(BaseModel):
    """Documented rules, thresholds, and policies used in evidence aggregation."""

    version: str = "3.0"
    correlated_feature_policy: str
    aggregation_approach: str
    disclaimer: str


class SynthesisDetails(BaseModel):
    """Structured Evidence Aggregation & Synthesis details (Phase 3)."""

    evidence_summary: EvidenceSummary
    domains: list[EvidenceDomainItem] = Field(default_factory=list)
    cross_domain_relationships: list[CrossDomainRelationship] = Field(default_factory=list)
    key_observations: list[KeyObservation] = Field(default_factory=list)
    regional_synthesis: RegionalSynthesis
    limitations: list[str] = Field(default_factory=list)
    methodology: MethodologyInfo


class AnalysisItem(BaseModel):
    """A single forensic analysis entry.

    Fake or fabricated findings must never appear here.
    """

    name: str
    status: Literal[
        "ok",
        "completed",
        "skipped",
        "failed",
        "unavailable",
        "not_implemented",
    ]
    observations: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    limitations: list[str] = Field(default_factory=list)
    details: (
        MetadataDetails
        | ELADetails
        | NoiseDetails
        | FrequencyDetails
        | RegionalAnomalyDetails
        | SynthesisDetails
        | dict[str, Any]
        | None
    ) = None


class Assessment(BaseModel):
    """High-level assessment synthesizing findings across all modules."""

    status: Literal["INCOMPLETE", "INCONCLUSIVE", "COMPLETE"]
    summary: str
    limitations: list[str]


class AIModelStatus(BaseModel):
    """Status of optional AI image detection model."""

    available: bool = False
    status: Literal["available", "unavailable", "failed"] = "unavailable"
    model_name: str | None = None
    message: str = (
        "AI detection model unavailable — traditional forensic analysis is still active."
    )
    warning: str | None = None


class AnalyzeResponse(BaseModel):
    """Structured analyze response."""

    success: bool = True
    application: str = "TruthLens"
    phase: Literal[
        "phase_1",
        "phase_2a",
        "phase_2b",
        "phase_2c",
        "phase_2d",
        "phase_2e",
        "phase_3",
    ] = "phase_3"
    image_properties: ImageProperties
    sha256: str = Field(min_length=64, max_length=64)
    analyses: list[AnalysisItem] = Field(default_factory=list)
    assessment: Assessment
    ai_model: AIModelStatus = Field(default_factory=AIModelStatus)
    model_status: str = Field(
        default="AI detection model unavailable — traditional forensic analysis is still active."
    )


class ErrorDetail(BaseModel):
    """Client-safe error detail."""

    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    success: Literal[False] = False
    error: ErrorDetail
