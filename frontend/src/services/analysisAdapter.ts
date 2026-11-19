import type {
  AnalysisStatus,
  InvestigationResult,
  MediaType,
  RegionalMeasurement,
  Finding,
  AssessmentInfo,
  EvidenceRelationship,
  EXIFMetadata,
  ELAProvisionalResult,
  NoiseResidualProvisionalResult,
  FrequencyDomainResult,
  RegionalAnomalyResult,
  RegionalAnomalyTile,
  SynthesisResult,
  ImageForensicEvidence,
  ImageProperties,
  ModuleStatus,
  KeyObservation,
  CrossDomainRelationship,
  RegionalSynthesis,
  RegionalSynthesisTile,
  EvidenceDomainItem,
  EvidenceSummary,
} from '../types';

export class AnalysisConnectionError extends Error {
  constructor(message = 'Forensic engine not connected') {
    super(message);
    this.name = 'AnalysisConnectionError';
  }
}

export class AnalysisContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisContractError';
  }
}

export class AnalysisTimeoutError extends Error {
  constructor(message = 'The forensic backend request timed out') {
    super(message);
    this.name = 'AnalysisTimeoutError';
  }
}

export type BackendConnectionStatus = 'configured' | 'connected' | 'disconnected' | 'unknown' | 'not-configured';

export interface AnalysisJob {
  jobId: string;
  status: AnalysisStatus;
  statusUrl?: string;
  result?: InvestigationResult;
}

export interface AnalysisSubmission {
  kind: 'result' | 'job';
  result?: InvestigationResult;
  job?: AnalysisJob;
}

export interface AnalysisPayload {
  mediaType: MediaType;
  file?: File;
  text?: string;
}

export interface SubmissionOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface PollOptions extends SubmissionOptions {
  intervalMs?: number;
  onStatus?: (job: AnalysisJob) => void;
}

const envApiUrl = (import.meta.env.VITE_TRUTHLENS_API_URL as string | undefined)?.trim().replace(/\/$/, '');
const backendUrl = envApiUrl !== undefined && envApiUrl !== '' ? envApiUrl : 'http://127.0.0.1:8000';
const submissionPath = (import.meta.env.VITE_TRUTHLENS_ANALYSIS_PATH as string | undefined)?.trim() || '/api/v1/analyze';
const imagePath = (import.meta.env.VITE_TRUTHLENS_IMAGE_ANALYSIS_PATH as string | undefined)?.trim();
const videoPath = (import.meta.env.VITE_TRUTHLENS_VIDEO_ANALYSIS_PATH as string | undefined)?.trim();
const audioPath = (import.meta.env.VITE_TRUTHLENS_AUDIO_ANALYSIS_PATH as string | undefined)?.trim();
const textPath = (import.meta.env.VITE_TRUTHLENS_TEXT_ANALYSIS_PATH as string | undefined)?.trim();
const statusPath = (import.meta.env.VITE_TRUTHLENS_STATUS_PATH as string | undefined)?.trim();
const healthPath = (import.meta.env.VITE_TRUTHLENS_HEALTH_PATH as string | undefined)?.trim() || '/health';
const configuredRequestTimeout = Number(import.meta.env.VITE_TRUTHLENS_REQUEST_TIMEOUT_MS);
const configuredStatusTimeout = Number(import.meta.env.VITE_TRUTHLENS_STATUS_TIMEOUT_MS);
const configuredPollInterval = Number(import.meta.env.VITE_TRUTHLENS_POLL_INTERVAL_MS);

export function isBackendConfigured(): boolean {
  return Boolean(backendUrl);
}

export function getBackendConnectionStatus(): BackendConnectionStatus {
  if (!backendUrl) return 'not-configured';
  if (!healthPath) return 'unknown';
  return 'configured';
}

function joinUrl(path: string): string {
  if (!backendUrl) throw new AnalysisConnectionError();
  if (/^https?:\/\//i.test(path)) return path;
  return `${backendUrl}/${path.replace(/^\//, '')}`;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  const timeout = window.setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } catch {
    if (controller.signal.aborted && externalSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    throw new AnalysisTimeoutError();
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

function getSubmitPath(mediaType: MediaType): string | undefined {
  if (mediaType === 'image') return imagePath || submissionPath;
  if (mediaType === 'video') return videoPath || submissionPath;
  if (mediaType === 'audio') return audioPath || submissionPath;
  return textPath || submissionPath;
}

export async function checkBackendConnection(timeoutMs = 5000): Promise<BackendConnectionStatus> {
  if (!backendUrl) return 'not-configured';
  if (!healthPath) return 'unknown';
  try {
    const response = await fetchWithTimeout(joinUrl(healthPath), { method: 'GET' }, timeoutMs);
    return response.ok ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

const asArray = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

export function normalizeInvestigation(raw: Record<string, unknown>): InvestigationResult {
  const firstObject = (...values: unknown[]) => values.find(value => typeof value === 'object' && value !== null) as Record<string, unknown> | undefined;
  const stringValue = (...values: unknown[]) => values.find(value => typeof value === 'string') as string | undefined;
  const numberValue = (...values: unknown[]) => values.find(value => typeof value === 'number') as number | undefined;
  const arrayValue = (...values: unknown[]) => values.find(value => Array.isArray(value)) as unknown[] | undefined;

  const normalizeStatusValue = (value: unknown): AnalysisStatus => {
    if (value === 'queued' || value === 'pending') return 'pending';
    if (value === 'processing' || value === 'running') return 'running';
    if (value === 'completed' || value === 'ok') return 'completed';
    if (value === 'failed') return 'failed';
    if (value === 'skipped' || value === 'not_implemented') return 'unavailable';
    return 'unavailable';
  };

  // Inspect analyses array from TruthLens AnalyzeResponse (Phase 2 & 3 schema)
  const rawAnalysesList = arrayValue(raw.analyses) as Record<string, unknown>[] | undefined;
  const findAnalysis = (...names: string[]) => rawAnalysesList?.find(item => names.includes(item?.name as string));

  const metaAnalysis = findAnalysis('metadata', 'exif');
  const elaAnalysis = findAnalysis('ela');
  const noiseAnalysis = findAnalysis('noise', 'noise_residual');
  const freqAnalysis = findAnalysis('frequency', 'frequency_domain', 'fft');
  const regAnalysis = findAnalysis('regional', 'regional_anomaly');
  const synthAnalysis = findAnalysis('synthesis', 'evidence_synthesis');

  const rawImageProperties = firstObject(raw.image_properties, raw.imageProperties);

  // Metadata / EXIF normalization
  const metadataRaw = firstObject(metaAnalysis?.details, raw.metadata, raw.exif, raw.exif_metadata, raw.exifMetadata);
  const exif: EXIFMetadata | undefined = metadataRaw ? {
    cameraManufacturer: stringValue(metadataRaw.camera_make, metadataRaw.cameraManufacturer, metadataRaw.camera_model, metadataRaw.make),
    cameraModel: stringValue(metadataRaw.camera_model, metadataRaw.cameraModel, metadataRaw.model),
    originalTimestamp: stringValue(metadataRaw.capture_datetime, metadataRaw.originalTimestamp, metadataRaw.original_timestamp, metadataRaw.dateTimeOriginal),
    modificationTimestamp: stringValue(metadataRaw.digitized_datetime, metadataRaw.modificationTimestamp, metadataRaw.modification_timestamp, metadataRaw.dateTimeModified),
    editingSoftware: stringValue(metadataRaw.software, metadataRaw.editingSoftware, metadataRaw.editing_software),
    gpsPresent: typeof metadataRaw.gps_present === 'boolean' ? metadataRaw.gps_present : typeof metadataRaw.gpsPresent === 'boolean' ? metadataRaw.gpsPresent : false,
    gpsFields: arrayValue(metadataRaw.gps_fields_present)?.map(String),
    lens: stringValue(metadataRaw.lens),
    colorSpace: stringValue(metadataRaw.color_space, metadataRaw.colorSpace),
    exifVersion: stringValue(metadataRaw.exif_version, metadataRaw.exifVersion),
    fieldsFound: arrayValue(metadataRaw.fields_found)?.map(String),
    fieldsMissing: arrayValue(metadataRaw.fields_missing)?.map(String),
    parseErrors: arrayValue(metadataRaw.parse_errors)?.map(String),
    formatNotes: stringValue(metadataRaw.format_notes, metadataRaw.formatNotes),
    observations: arrayValue(metaAnalysis?.observations)?.map(String),
    limitations: arrayValue(metaAnalysis?.limitations)?.map(String),
  } : undefined;

  // Regional metrics helper
  const normalizeRegions = (value: unknown): RegionalMeasurement[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    return value.filter(item => item && typeof item === 'object').map(item => {
      const region = item as Record<string, unknown>;
      return {
        region: stringValue(region.region_id, region.region),
        row: numberValue(region.row),
        column: numberValue(region.col, region.column),
        value: numberValue(region.mean_difference, region.value),
        variance: numberValue(region.variance),
        std: numberValue(region.std),
        maxDifference: numberValue(region.max_difference, region.maxDifference),
        measurements: region.measurements as Record<string, number> | undefined,
      };
    });
  };

  // ELA normalization
  const elaRaw = firstObject(elaAnalysis?.details, raw.ela, raw.elaAnalysis, raw.ela_analysis);
  const ela: ELAProvisionalResult | undefined = elaRaw ? {
    status: normalizeStatusValue(elaAnalysis?.status ?? elaRaw.status),
    visualizationUrl: stringValue(elaRaw.difference_image_data_url, elaRaw.visualizationUrl, elaRaw.visualization_url, elaRaw.imageUrl, elaRaw.image_url),
    recompressionQuality: numberValue(elaRaw.recompression_quality, elaRaw.recompressionQuality),
    scaleFactor: numberValue(elaRaw.scale_factor, elaRaw.scaleFactor),
    difference: {
      'Mean diff': numberValue(elaRaw.mean_difference, (elaRaw.difference as Record<string, number>)?.mean) ?? 0,
      'Median diff': numberValue(elaRaw.median_difference, (elaRaw.difference as Record<string, number>)?.median) ?? 0,
      'Max diff': numberValue(elaRaw.max_difference, (elaRaw.difference as Record<string, number>)?.max) ?? 0,
      'P95 diff': numberValue(elaRaw.p95_difference) ?? 0,
      'P99 diff': numberValue(elaRaw.p99_difference) ?? 0,
    },
    channelMeans: typeof elaRaw.channel_means === 'object' && elaRaw.channel_means !== null ? elaRaw.channel_means as Record<string, number> : undefined,
    channelMaxes: typeof elaRaw.channel_maxes === 'object' && elaRaw.channel_maxes !== null ? elaRaw.channel_maxes as Record<string, number> : undefined,
    thresholdPercentages: typeof elaRaw.threshold_percentages === 'object' && elaRaw.threshold_percentages !== null ? elaRaw.threshold_percentages as Record<string, number> : undefined,
    regional: normalizeRegions(elaRaw.regional_metrics ?? elaRaw.regional),
    observations: arrayValue(elaAnalysis?.observations ?? elaRaw.observations)?.map(String),
    limitations: arrayValue(elaAnalysis?.limitations ?? elaRaw.limitations)?.map(String),
  } : undefined;

  // Noise Residual normalization
  const noiseRaw = firstObject(noiseAnalysis?.details, raw.noise, raw.noiseResidual, raw.noise_residual, raw.noiseResidualAnalysis);
  const noise: NoiseResidualProvisionalResult | undefined = noiseRaw ? {
    status: normalizeStatusValue(noiseAnalysis?.status ?? noiseRaw.status),
    visualizationUrl: stringValue(noiseRaw.visualization_data_url, noiseRaw.visualizationUrl, noiseRaw.visualization_url, noiseRaw.imageUrl, noiseRaw.image_url),
    smoothingSigma: numberValue(noiseRaw.smoothing_sigma, noiseRaw.smoothingSigma),
    gaussianSmoothing: stringValue(noiseRaw.gaussianSmoothing) ?? (numberValue(noiseRaw.smoothing_sigma) !== undefined ? `Gaussian σ = ${numberValue(noiseRaw.smoothing_sigma)}` : undefined),
    statistics: {
      'Mean residual': numberValue(noiseRaw.residual_mean, (noiseRaw.statistics as Record<string, number>)?.mean) ?? 0,
      'Standard deviation (σ)': numberValue(noiseRaw.residual_std, (noiseRaw.statistics as Record<string, number>)?.std) ?? 0,
      'Mean abs residual': numberValue(noiseRaw.mean_absolute_residual) ?? 0,
      'Median abs residual': numberValue(noiseRaw.median_absolute_residual) ?? 0,
      'Max abs residual': numberValue(noiseRaw.max_absolute_residual) ?? 0,
      'P95 abs residual': numberValue(noiseRaw.p95_absolute_residual) ?? 0,
      'P99 abs residual': numberValue(noiseRaw.p99_absolute_residual) ?? 0,
    },
    channelMeans: typeof noiseRaw.channel_residual_means === 'object' && noiseRaw.channel_residual_means !== null ? noiseRaw.channel_residual_means as Record<string, number> : undefined,
    channelStds: typeof noiseRaw.channel_residual_stds === 'object' && noiseRaw.channel_residual_stds !== null ? noiseRaw.channel_residual_stds as Record<string, number> : undefined,
    regional: normalizeRegions(noiseRaw.regional_metrics ?? noiseRaw.regional),
    observations: arrayValue(noiseAnalysis?.observations ?? noiseRaw.observations)?.map(String),
    limitations: arrayValue(noiseAnalysis?.limitations ?? noiseRaw.limitations)?.map(String),
  } : undefined;

  // Frequency Domain (2D FFT) normalization
  const freqRaw = firstObject(freqAnalysis?.details, raw.frequency);
  const frequency: FrequencyDomainResult | undefined = freqRaw ? {
    status: normalizeStatusValue(freqAnalysis?.status ?? freqRaw.status),
    visualizationUrl: stringValue(freqRaw.visualization_data_url, freqRaw.visualizationUrl),
    analysisWidth: numberValue(freqRaw.analysis_width, freqRaw.analysisWidth),
    analysisHeight: numberValue(freqRaw.analysis_height, freqRaw.analysisHeight),
    originalWidth: numberValue(freqRaw.original_width, freqRaw.originalWidth),
    originalHeight: numberValue(freqRaw.original_height, freqRaw.originalHeight),
    isDownsampled: typeof freqRaw.is_downsampled === 'boolean' ? freqRaw.is_downsampled : false,
    windowFunction: stringValue(freqRaw.window_function, freqRaw.windowFunction) ?? 'hann',
    totalPower: numberValue(freqRaw.total_non_dc_power, freqRaw.totalPower),
    lowFrequencyPower: numberValue(freqRaw.low_frequency_power, freqRaw.lowFrequencyPower),
    midFrequencyPower: numberValue(freqRaw.mid_frequency_power, freqRaw.midFrequencyPower),
    highFrequencyPower: numberValue(freqRaw.high_frequency_power, freqRaw.highFrequencyPower),
    lowFrequencyEnergyPct: numberValue(freqRaw.low_frequency_energy_pct, freqRaw.lowFrequencyEnergyPct),
    midFrequencyEnergyPct: numberValue(freqRaw.mid_frequency_energy_pct, freqRaw.midFrequencyEnergyPct),
    highFrequencyEnergyPct: numberValue(freqRaw.high_frequency_energy_pct, freqRaw.highFrequencyEnergyPct),
    spectralCentroid: numberValue(freqRaw.spectral_centroid, freqRaw.spectralCentroid),
    spectralEntropy: numberValue(freqRaw.spectral_entropy, freqRaw.spectralEntropy),
    metrics: {
      lowEnergyPct: numberValue(freqRaw.low_frequency_energy_pct, freqRaw.lowFrequencyEnergyPct) ?? 0,
      midEnergyPct: numberValue(freqRaw.mid_frequency_energy_pct, freqRaw.midFrequencyEnergyPct) ?? 0,
      highEnergyPct: numberValue(freqRaw.high_frequency_energy_pct, freqRaw.highFrequencyEnergyPct) ?? 0,
      spectralCentroid: numberValue(freqRaw.spectral_centroid, freqRaw.spectralCentroid) ?? 0,
      spectralEntropy: numberValue(freqRaw.spectral_entropy, freqRaw.spectralEntropy) ?? 0,
      windowFunction: stringValue(freqRaw.window_function) ?? 'hann',
      isDownsampled: Boolean(freqRaw.is_downsampled),
    },
    observations: arrayValue(freqAnalysis?.observations ?? freqRaw.observations)?.map(String),
    limitations: arrayValue(freqAnalysis?.limitations ?? freqRaw.limitations)?.map(String),
  } : undefined;

  // Regional Anomaly normalization
  const regRaw = firstObject(regAnalysis?.details, raw.regional_anomaly, raw.regionalAnomaly);
  const rawAnomalyItems = arrayValue(regRaw?.regional_anomalies) as Record<string, unknown>[] | undefined;
  const anomalyTiles: RegionalAnomalyTile[] | undefined = rawAnomalyItems?.map(item => ({
    regionId: stringValue(item.region_id) ?? '',
    row: numberValue(item.row) ?? 0,
    col: numberValue(item.col) ?? 0,
    x: numberValue(item.x) ?? 0,
    y: numberValue(item.y) ?? 0,
    width: numberValue(item.width) ?? 0,
    height: numberValue(item.height) ?? 0,
    meanLuminance: numberValue(item.mean_luminance) ?? 0,
    stdLuminance: numberValue(item.std_luminance) ?? 0,
    minLuminance: numberValue(item.min_luminance) ?? 0,
    maxLuminance: numberValue(item.max_luminance) ?? 0,
    meanGradient: numberValue(item.mean_gradient) ?? 0,
    stdGradient: numberValue(item.std_gradient) ?? 0,
    edgeDensity: numberValue(item.edge_density) ?? 0,
    noiseResidualStd: numberValue(item.noise_residual_std),
    noiseMeanAbs: numberValue(item.noise_mean_abs),
    elaMean: numberValue(item.ela_mean),
    elaVariance: numberValue(item.ela_variance),
    regionalFftHighFreqRatio: numberValue(item.regional_fft_high_freq_ratio),
    deviationScore: numberValue(item.deviation_score) ?? 0,
    neighborDeviation: numberValue(item.neighbor_deviation) ?? 0,
    zScores: typeof item.z_scores === 'object' && item.z_scores !== null ? item.z_scores as Record<string, number> : undefined,
    observation: stringValue(item.observation) ?? '',
  }));

  const regionalAnomaly: RegionalAnomalyResult | undefined = regRaw ? {
    status: normalizeStatusValue(regAnalysis?.status ?? regRaw.status),
    visualizationUrl: stringValue(regRaw.visualization_data_url, regRaw.visualizationUrl),
    gridRows: numberValue(regRaw.grid_rows) ?? 4,
    gridCols: numberValue(regRaw.grid_cols) ?? 4,
    totalRegions: numberValue(regRaw.total_regions) ?? 16,
    analyzedFeatures: arrayValue(regRaw.analyzed_features)?.map(String),
    activeModulesUsed: arrayValue(regRaw.active_modules_used)?.map(String),
    maxDeviationScore: numberValue(regRaw.max_deviation_score),
    meanDeviationScore: numberValue(regRaw.mean_deviation_score),
    highestDeviationRegionId: stringValue(regRaw.highest_deviation_region_id),
    tiles: anomalyTiles,
    regionalSummary: typeof regRaw.regional_summary === 'object' && regRaw.regional_summary !== null ? regRaw.regional_summary as Record<string, number> : undefined,
    observations: arrayValue(regAnalysis?.observations ?? regRaw.observations)?.map(String),
    limitations: arrayValue(regAnalysis?.limitations ?? regRaw.limitations)?.map(String),
  } : undefined;

  // Synthesis & Aggregation normalization (Phase 3)
  const synthRaw = firstObject(synthAnalysis?.details, raw.synthesis);
  const evidenceSummaryRaw = firstObject(synthRaw?.evidence_summary);
  const evidenceSummary: EvidenceSummary | undefined = evidenceSummaryRaw ? {
    relationship: (stringValue(evidenceSummaryRaw.relationship) ?? 'insufficient_evidence') as EvidenceRelationship,
    domainsAvailable: numberValue(evidenceSummaryRaw.domains_available) ?? 0,
    domainsWithObservations: numberValue(evidenceSummaryRaw.domains_with_observations) ?? 0,
    primaryContributingDomains: arrayValue(evidenceSummaryRaw.primary_contributing_domains)?.map(String) ?? [],
    synthesisStatement: stringValue(evidenceSummaryRaw.synthesis_statement) ?? '',
  } : undefined;

  const rawDomains = arrayValue(synthRaw?.domains) as Record<string, unknown>[] | undefined;
  const synthDomains: EvidenceDomainItem[] | undefined = rawDomains?.map(d => ({
    domainId: stringValue(d.domain_id) ?? '',
    domainName: stringValue(d.domain_name) ?? '',
    status: stringValue(d.status) ?? '',
    hasNotableVariation: Boolean(d.has_notable_variation),
    summary: stringValue(d.summary) ?? '',
    metrics: typeof d.metrics === 'object' && d.metrics !== null ? d.metrics as Record<string, unknown> : undefined,
    observations: arrayValue(d.observations)?.map(String),
  }));

  const rawKeyObs = arrayValue(synthRaw?.key_observations) as Record<string, unknown>[] | undefined;
  const keyObservations: KeyObservation[] | undefined = rawKeyObs?.map((item, idx) => ({
    observationId: stringValue(item.observation_id) ?? `obs-${idx + 1}`,
    title: stringValue(item.title) ?? 'Observed Pattern',
    description: stringValue(item.description) ?? '',
    relevantDomains: arrayValue(item.relevant_domains)?.map(String) ?? [],
    supportingMetrics: typeof item.supporting_metrics === 'object' && item.supporting_metrics !== null ? item.supporting_metrics as Record<string, unknown> : undefined,
    regionIds: arrayValue(item.region_ids)?.map(String) ?? [],
    neutralInterpretation: stringValue(item.neutral_interpretation) ?? '',
    limitations: arrayValue(item.limitations)?.map(String) ?? [],
  }));

  const rawCrossRel = arrayValue(synthRaw?.cross_domain_relationships) as Record<string, unknown>[] | undefined;
  const crossDomainRelationships: CrossDomainRelationship[] | undefined = rawCrossRel?.map(rel => ({
    domains: arrayValue(rel.domains)?.map(String) ?? [],
    relationshipType: (stringValue(rel.relationship_type) ?? 'independent') as CrossDomainRelationship['relationshipType'],
    description: stringValue(rel.description) ?? '',
    supportingEvidence: arrayValue(rel.supporting_evidence)?.map(String) ?? [],
  }));

  const rawRegSynth = firstObject(synthRaw?.regional_synthesis);
  const rawRegSynthTiles = arrayValue(rawRegSynth?.tiles) as Record<string, unknown>[] | undefined;
  const regionalSynthesis: RegionalSynthesis | undefined = rawRegSynth ? {
    gridRows: numberValue(rawRegSynth.grid_rows) ?? 4,
    gridCols: numberValue(rawRegSynth.grid_cols) ?? 4,
    totalRegions: numberValue(rawRegSynth.total_regions) ?? 16,
    elevatedRegions: arrayValue(rawRegSynth.elevated_regions)?.map(String) ?? [],
    lowVariationRegions: arrayValue(rawRegSynth.low_variation_regions)?.map(String) ?? [],
    multiDomainRegions: arrayValue(rawRegSynth.multi_domain_regions)?.map(String) ?? [],
    singleDomainRegions: arrayValue(rawRegSynth.single_domain_regions)?.map(String) ?? [],
    summary: stringValue(rawRegSynth.summary) ?? '',
    tiles: rawRegSynthTiles?.map(t => ({
      regionId: stringValue(t.region_id) ?? '',
      row: numberValue(t.row) ?? 0,
      col: numberValue(t.col) ?? 0,
      variationLevel: (stringValue(t.variation_level) ?? 'typical') as RegionalSynthesisTile['variationLevel'],
      contributingDomains: arrayValue(t.contributing_domains)?.map(String) ?? [],
      domainCountWithVariation: numberValue(t.domain_count_with_variation) ?? 0,
      isMultiDomainVariation: Boolean(t.is_multi_domain_variation),
      neighborContrast: (stringValue(t.neighbor_contrast) ?? 'consistent') as RegionalSynthesisTile['neighborContrast'],
      summary: stringValue(t.summary) ?? '',
    })) ?? [],
  } : undefined;

  const rawMethodology = firstObject(synthRaw?.methodology);
  const methodology = rawMethodology ? {
    version: stringValue(rawMethodology.version) ?? '3.0',
    correlatedFeaturePolicy: stringValue(rawMethodology.correlated_feature_policy) ?? '',
    aggregationApproach: stringValue(rawMethodology.aggregation_approach) ?? '',
    disclaimer: stringValue(rawMethodology.disclaimer) ?? '',
  } : undefined;

  const synthesis: SynthesisResult | undefined = synthRaw ? {
    status: normalizeStatusValue(synthAnalysis?.status ?? synthRaw.status),
    evidenceSummary,
    domains: synthDomains,
    crossDomainRelationships,
    keyObservations,
    regionalSynthesis,
    methodology,
    observations: arrayValue(synthAnalysis?.observations ?? synthRaw.observations)?.map(String),
    limitations: arrayValue(synthAnalysis?.limitations ?? synthRaw.limitations)?.map(String),
  } : undefined;

  // Structured assessment from backend
  const rawAssessment = firstObject(raw.assessment);
  let assessmentDetails: AssessmentInfo | undefined;
  if (rawAssessment) {
    const statusVal = stringValue(rawAssessment.status)?.toUpperCase();
    const validStatus = statusVal === 'COMPLETE' || statusVal === 'INCOMPLETE' || statusVal === 'INCONCLUSIVE' ? statusVal : 'COMPLETE';
    assessmentDetails = {
      status: validStatus,
      summary: stringValue(rawAssessment.summary) ?? (evidenceSummary?.synthesisStatement || 'Forensic analysis completed.'),
      limitations: asArray(rawAssessment.limitations),
      relationship: evidenceSummary?.relationship,
    };
  }

  // Modules list
  const modules: ModuleStatus[] = rawAnalysesList
    ? rawAnalysesList.map(item => ({
        name: stringValue(item.name) ?? 'Module',
        status: normalizeStatusValue(item.status),
      }))
    : [
        { name: 'Metadata & EXIF', status: exif ? 'completed' : 'unavailable' },
        { name: 'Error Level Analysis', status: ela ? 'completed' : 'unavailable' },
        { name: 'Noise Residual', status: noise ? 'completed' : 'unavailable' },
        { name: 'Frequency Domain (FFT)', status: frequency ? 'completed' : 'unavailable' },
        { name: 'Regional Anomaly', status: regionalAnomaly ? 'completed' : 'unavailable' },
        { name: 'Evidence Synthesis', status: synthesis ? 'completed' : 'unavailable' },
      ];

  // Findings list from key observations or module observations
  const findings: Finding[] = [];
  if (keyObservations && keyObservations.length > 0) {
    keyObservations.forEach(obs => {
      findings.push({
        id: obs.observationId,
        title: obs.title,
        severity: 'informational',
        module: obs.relevantDomains.join(', ') || 'Evidence Synthesis',
        observation: obs.description,
        interpretation: obs.neutralInterpretation,
        evidenceReference: obs.regionIds.length > 0 ? `Regions: ${obs.regionIds.join(', ')}` : undefined,
        limitations: obs.limitations.length > 0 ? obs.limitations.join('; ') : undefined,
      });
    });
  } else if (rawAnalysesList) {
    rawAnalysesList.forEach(a => {
      const obs = arrayValue(a.observations)?.map(String);
      if (obs && obs.length > 0) {
        obs.forEach((text, i) => {
          findings.push({
            id: `${a.name}-obs-${i + 1}`,
            title: `${String(a.name).toUpperCase()} observation`,
            severity: 'informational',
            module: String(a.name),
            observation: text,
          });
        });
      }
    });
  }

  const imageProperties: ImageProperties | undefined = rawImageProperties ? {
    filename: stringValue(rawImageProperties.filename),
    format: stringValue(rawImageProperties.format),
    mimeType: stringValue(rawImageProperties.mime_type, rawImageProperties.mimeType),
    sizeBytes: numberValue(rawImageProperties.size_bytes, rawImageProperties.sizeBytes),
    sizeReadable: stringValue(rawImageProperties.size_readable, rawImageProperties.sizeReadable),
    width: numberValue(rawImageProperties.width),
    height: numberValue(rawImageProperties.height),
    aspectRatio: numberValue(rawImageProperties.aspect_ratio, rawImageProperties.aspectRatio),
    pixelCount: numberValue(rawImageProperties.pixel_count, rawImageProperties.pixelCount),
    mode: stringValue(rawImageProperties.mode),
    hasTransparency: typeof rawImageProperties.has_transparency === 'boolean' ? rawImageProperties.has_transparency : false,
    size: numberValue(rawImageProperties.size_bytes),
  } : undefined;

  const imageEvidence: ImageForensicEvidence | undefined = (exif || ela || noise || frequency || regionalAnomaly || synthesis || rawImageProperties) ? {
    status: normalizeStatusValue(raw.analysisStatus ?? raw.status ?? (rawAnalysesList?.length ? 'completed' : 'unavailable')),
    originalImageUrl: stringValue(raw.originalImageUrl, raw.original_image_url, raw.fileUrl),
    fileFormat: stringValue(imageProperties?.format, raw.fileFormat, raw.format),
    fileSize: numberValue(imageProperties?.sizeBytes, raw.fileSize, raw.size),
    width: numberValue(imageProperties?.width, raw.width),
    height: numberValue(imageProperties?.height, raw.height),
    resolution: imageProperties?.width && imageProperties?.height ? `${imageProperties.width} × ${imageProperties.height} px` : undefined,
    sha256: stringValue(raw.sha256, raw.sha_256),
    exif,
    ela,
    noise,
    frequency,
    regionalAnomaly,
    synthesis,
    frequencyStatus: frequency?.status ?? 'unavailable',
    regionalStatus: regionalAnomaly?.status ?? 'unavailable',
    evidenceStatus: synthesis?.status ?? 'unavailable',
    evidence: {
      observedIndicators: keyObservations?.map(o => o.description) ?? [],
      supportingEvidence: crossDomainRelationships?.map(r => `${r.relationshipType}: ${r.description}`) ?? [],
      potentialAnomalies: regionalSynthesis?.elevatedRegions.map(r => `Elevated regional variation in ${r}`) ?? [],
      limitations: synthesis?.limitations ?? assessmentDetails?.limitations ?? [],
      interpretationNotes: keyObservations?.map(o => o.neutralInterpretation) ?? [],
    },
  } : undefined;

  return {
    id: stringValue(raw.id, raw.investigationId, raw.investigation_id) ?? (raw.sha256 ? String(raw.sha256).slice(0, 16) : undefined),
    filenames: asArray(raw.filenames).length ? asArray(raw.filenames) : typeof imageProperties?.filename === 'string' ? [imageProperties.filename] : typeof raw.filename === 'string' ? [raw.filename] : [],
    mediaTypes: ['image'],
    timestamp: stringValue(raw.timestamp, raw.createdAt, raw.created_at, raw.analysisTimestamp) ?? new Date().toISOString(),
    sha256: typeof raw.sha256 === 'string' ? [raw.sha256] : Array.isArray(raw.sha256) ? asArray(raw.sha256) : [],
    fileFormat: stringValue(imageProperties?.format, raw.fileFormat, raw.format),
    fileSize: numberValue(imageProperties?.sizeBytes, raw.fileSize),
    analysisStatus: normalizeStatusValue(raw.analysisStatus ?? raw.status ?? (rawAnalysesList?.length ? 'completed' : 'unavailable')),
    imageProperties,
    imageEvidence,
    assessment: assessmentDetails ?? (typeof raw.assessment === 'string' ? raw.assessment as InvestigationResult['assessment'] : undefined),
    assessmentDetails,
    modules,
    findings,
    rawResponse: raw,
  };
}

function normalizeStatus(value: unknown): AnalysisStatus {
  if (value === 'pending' || value === 'queued' || value === 'running' || value === 'processing' || value === 'completed' || value === 'ok' || value === 'failed' || value === 'unavailable') {
    if (value === 'queued') return 'pending';
    if (value === 'processing') return 'running';
    if (value === 'ok') return 'completed';
    return value;
  }
  return 'unavailable';
}

export function normalizeAnalysisJob(raw: Record<string, unknown>, statusUrl?: string): AnalysisJob {
  const jobIdValue = raw.jobId ?? raw.job_id ?? raw.id;
  if (typeof jobIdValue !== 'string' && typeof jobIdValue !== 'number') {
    throw new AnalysisContractError('Backend response did not provide a job ID.');
  }
  return {
    jobId: String(jobIdValue),
    status: normalizeStatus(raw.status ?? raw.state),
    statusUrl: typeof raw.statusUrl === 'string' ? raw.statusUrl : typeof raw.status_url === 'string' ? raw.status_url : statusUrl,
  };
}

export async function submitImage(payload: Omit<AnalysisPayload, 'mediaType'> & { file: File }, options: SubmissionOptions = {}) {
  return submitAnalysis({ ...payload, mediaType: 'image' }, options);
}

export async function submitVideo(payload: Omit<AnalysisPayload, 'mediaType'> & { file: File }, options: SubmissionOptions = {}) {
  return submitAnalysis({ ...payload, mediaType: 'video' }, options);
}

export async function submitAudio(payload: Omit<AnalysisPayload, 'mediaType'> & { file: File }, options: SubmissionOptions = {}) {
  return submitAnalysis({ ...payload, mediaType: 'audio' }, options);
}

export async function submitText(payload: Omit<AnalysisPayload, 'mediaType'> & { text: string }, options: SubmissionOptions = {}) {
  return submitAnalysis({ ...payload, mediaType: 'text' }, options);
}

export async function submitAnalysis(payload: AnalysisPayload, options: SubmissionOptions = {}): Promise<AnalysisSubmission> {
  if (!backendUrl) throw new AnalysisConnectionError();
  const path = getSubmitPath(payload.mediaType);
  if (!path) throw new AnalysisContractError('Analysis submission endpoint is not configured. Set VITE_TRUTHLENS_ANALYSIS_PATH.');

  const form = new FormData();
  if (payload.file) {
    // TruthLens backend specifically requires `file: UploadFile = File(...)`
    form.append('file', payload.file);
  }
  if (payload.text) {
    form.append('text', payload.text);
  }

  const response = await fetchWithTimeout(
    joinUrl(path),
    { method: 'POST', body: form },
    options.timeoutMs ?? (Number.isFinite(configuredRequestTimeout) && configuredRequestTimeout > 0 ? configuredRequestTimeout : 60000),
    options.signal
  );

  if (!response.ok) {
    let errorMessage = `Backend request failed (${response.status})`;
    try {
      const errBody = await response.json() as Record<string, unknown>;
      if (errBody?.detail) {
        errorMessage = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
      } else if (errBody?.error && typeof errBody.error === 'object') {
        const errorDetail = errBody.error as Record<string, unknown>;
        if (typeof errorDetail.message === 'string') errorMessage = errorDetail.message;
      }
    } catch {
      // fallback to status code message
    }
    throw new Error(errorMessage);
  }

  const raw = await response.json() as Record<string, unknown>;

  const jobId = raw.jobId ?? raw.job_id;
  const statusUrl = typeof raw.statusUrl === 'string' ? raw.statusUrl : typeof raw.status_url === 'string' ? raw.status_url : undefined;
  if (jobId !== undefined || statusUrl) {
    return { kind: 'job', job: normalizeAnalysisJob(raw, statusUrl) };
  }

  return { kind: 'result', result: normalizeInvestigation(raw) };
}

export async function submitInvestigation(payload: AnalysisPayload, signal?: AbortSignal): Promise<InvestigationResult> {
  const submission = await submitAnalysis(payload, { signal });
  if (submission.kind === 'result' && submission.result) return submission.result;
  if (submission.kind === 'job' && submission.job) {
    throw new AnalysisContractError('Backend returned an asynchronous job. Use polling with submitAnalysis and pollAnalysisJob.');
  }
  throw new AnalysisContractError('Backend response did not contain a result or job.');
}

export function buildStatusUrl(job: AnalysisJob): string | undefined {
  if (job.statusUrl) return joinUrl(job.statusUrl);
  if (!statusPath) return undefined;
  return joinUrl(statusPath.replace('{jobId}', encodeURIComponent(job.jobId)));
}

export async function pollAnalysisJob(job: AnalysisJob, options: PollOptions = {}): Promise<AnalysisJob> {
  const url = buildStatusUrl(job);
  if (!url) throw new AnalysisContractError('Job status endpoint is not configured. Set VITE_TRUTHLENS_STATUS_PATH.');

  const interval = options.intervalMs ?? (Number.isFinite(configuredPollInterval) && configuredPollInterval > 0 ? configuredPollInterval : 1500);
  let current = job;
  while (current.status === 'pending' || current.status === 'running') {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { cleanup(); resolve(); }, interval);
      const cleanup = () => options.signal?.removeEventListener('abort', abort);
      const abort = () => { window.clearTimeout(timer); cleanup(); reject(new DOMException('Polling cancelled', 'AbortError')); };
      if (options.signal?.aborted) abort();
      else options.signal?.addEventListener('abort', abort, { once: true });
    });
    const response = await fetchWithTimeout(url, { method: 'GET' }, options.timeoutMs ?? (Number.isFinite(configuredStatusTimeout) && configuredStatusTimeout > 0 ? configuredStatusTimeout : 10000), options.signal);
    if (!response.ok) throw new Error(`Status request failed (${response.status})`);
    const raw = await response.json() as Record<string, unknown>;
    current = normalizeAnalysisJob(raw, url);

    const resultValue = raw.result;
    if (current.status === 'completed' && typeof resultValue === 'object' && resultValue !== null) {
      current.result = normalizeInvestigation(resultValue as Record<string, unknown>);
    }
    options.onStatus?.(current);
  }

  return current;
}
