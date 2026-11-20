export type MediaType = 'image' | 'video' | 'audio' | 'text';
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'unavailable' | 'ok' | 'skipped' | 'not_implemented';
export type AssessmentStatus = 'COMPLETE' | 'INCOMPLETE' | 'INCONCLUSIVE';

export type EvidenceRelationship =
  | 'converging_observations'
  | 'isolated_observation'
  | 'mixed_observations'
  | 'insufficient_evidence'
  | 'no_notable_variation';

export interface AssessmentInfo {
  status: AssessmentStatus;
  summary: string;
  limitations: string[];
  relationship?: EvidenceRelationship;
}

export type Assessment = AssessmentInfo | 'NO MAJOR INDICATORS' | 'REQUIRES REVIEW' | 'MULTIPLE ANOMALIES' | 'INCONCLUSIVE';
export type Severity = 'low' | 'medium' | 'high' | 'informational';

export interface MediaFile { file: globalThis.File; type: MediaType; previewUrl?: string }
export interface RGBMeasurements { red?: number; green?: number; blue?: number; r?: number; g?: number; b?: number; mean?: number; [key: string]: number | undefined }
export interface RegionalMeasurement {
  row?: number;
  column?: number;
  region?: string;
  value?: number;
  variance?: number;
  std?: number;
  maxDifference?: number;
  measurements?: RGBMeasurements | Record<string, number>;
  [key: string]: unknown;
}

export interface EXIFMetadata {
  cameraManufacturer?: string;
  cameraModel?: string;
  originalTimestamp?: string;
  modificationTimestamp?: string;
  editingSoftware?: string;
  gpsPresent?: boolean;
  gpsFields?: string[];
  lens?: string;
  colorSpace?: string;
  exifVersion?: string;
  fieldsFound?: string[];
  fieldsMissing?: string[];
  parseErrors?: string[];
  formatNotes?: string;
  observations?: string[];
  limitations?: string[];
  unavailable?: string[];
  [key: string]: unknown;
}

export interface ELAProvisionalResult {
  status: AnalysisStatus;
  visualizationUrl?: string;
  recompressionQuality?: number;
  scaleFactor?: number;
  difference?: Record<string, number>;
  channelMeans?: Record<string, number>;
  channelMaxes?: Record<string, number>;
  thresholdPercentages?: Record<string, number>;
  rgb?: RGBMeasurements;
  regional?: RegionalMeasurement[];
  observations?: string[];
  limitations?: string[];
}

export interface NoiseResidualProvisionalResult {
  status: AnalysisStatus;
  visualizationUrl?: string;
  smoothingSigma?: number;
  gaussianSmoothing?: string | Record<string, unknown>;
  statistics?: Record<string, number>;
  channelMeans?: Record<string, number>;
  channelStds?: Record<string, number>;
  rgb?: RGBMeasurements;
  regional?: RegionalMeasurement[];
  observations?: string[];
  limitations?: string[];
}

export interface FrequencyBandBoundaries {
  low?: [number, number];
  mid?: [number, number];
  high?: [number, number];
  [key: string]: [number, number] | number[] | undefined;
}

export interface FrequencyDomainResult {
  status: AnalysisStatus;
  visualizationUrl?: string;
  analysisWidth?: number;
  analysisHeight?: number;
  originalWidth?: number;
  originalHeight?: number;
  isDownsampled?: boolean;
  windowFunction?: string;
  totalPower?: number;
  lowFrequencyPower?: number;
  midFrequencyPower?: number;
  highFrequencyPower?: number;
  lowFrequencyEnergyPct?: number;
  midFrequencyEnergyPct?: number;
  highFrequencyEnergyPct?: number;
  spectralCentroid?: number;
  spectralEntropy?: number;
  bandBoundaries?: FrequencyBandBoundaries;
  metrics?: Record<string, number | string | boolean>;
  observations?: string[];
  limitations?: string[];
}

export interface RegionalAnomalyTile {
  regionId: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  meanLuminance: number;
  stdLuminance: number;
  minLuminance: number;
  maxLuminance: number;
  meanGradient: number;
  stdGradient: number;
  edgeDensity: number;
  noiseResidualStd?: number | null;
  noiseMeanAbs?: number | null;
  elaMean?: number | null;
  elaVariance?: number | null;
  regionalFftHighFreqRatio?: number | null;
  deviationScore: number;
  neighborDeviation: number;
  zScores?: Record<string, number>;
  observation: string;
}

export interface RegionalAnomalyResult {
  status: AnalysisStatus;
  visualizationUrl?: string;
  gridRows?: number;
  gridCols?: number;
  totalRegions?: number;
  analyzedFeatures?: string[];
  activeModulesUsed?: string[];
  maxDeviationScore?: number;
  meanDeviationScore?: number;
  highestDeviationRegionId?: string;
  tiles?: RegionalAnomalyTile[];
  regionalSummary?: Record<string, number>;
  observations?: string[];
  limitations?: string[];
}

export interface EvidenceDomainItem {
  domainId: string;
  domainName: string;
  status: string;
  hasNotableVariation: boolean;
  summary: string;
  metrics?: Record<string, unknown>;
  observations?: string[];
}

export interface CrossDomainRelationship {
  domains: string[];
  relationshipType: 'converging' | 'diverging' | 'independent' | 'isolated';
  description: string;
  supportingEvidence: string[];
}

export interface KeyObservation {
  observationId: string;
  title: string;
  description: string;
  relevantDomains: string[];
  supportingMetrics?: Record<string, unknown>;
  regionIds: string[];
  neutralInterpretation: string;
  limitations: string[];
}

export interface RegionalSynthesisTile {
  regionId: string;
  row: number;
  col: number;
  variationLevel: 'low' | 'typical' | 'elevated' | 'divergent';
  contributingDomains: string[];
  domainCountWithVariation: number;
  isMultiDomainVariation: boolean;
  neighborContrast: 'consistent' | 'moderate' | 'sharp';
  summary: string;
}

export interface RegionalSynthesis {
  gridRows: number;
  gridCols: number;
  totalRegions: number;
  elevatedRegions: string[];
  lowVariationRegions: string[];
  multiDomainRegions: string[];
  singleDomainRegions: string[];
  tiles: RegionalSynthesisTile[];
  summary: string;
}

export interface MethodologyInfo {
  version: string;
  correlatedFeaturePolicy: string;
  aggregationApproach: string;
  disclaimer: string;
}

export interface EvidenceSummary {
  relationship: EvidenceRelationship;
  domainsAvailable: number;
  domainsWithObservations: number;
  primaryContributingDomains: string[];
  synthesisStatement: string;
}

export interface SynthesisResult {
  status: AnalysisStatus;
  evidenceSummary?: EvidenceSummary;
  domains?: EvidenceDomainItem[];
  crossDomainRelationships?: CrossDomainRelationship[];
  keyObservations?: KeyObservation[];
  regionalSynthesis?: RegionalSynthesis;
  methodology?: MethodologyInfo;
  observations?: string[];
  limitations?: string[];
}

export interface EvidenceInterpretation {
  observedIndicators?: string[];
  supportingEvidence?: string[];
  potentialAnomalies?: string[];
  limitations?: string[];
  interpretationNotes?: string[];
}

export interface ImageForensicEvidence {
  status: AnalysisStatus;
  originalImageUrl?: string;
  fileFormat?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  resolution?: string;
  sha256?: string;
  exif?: EXIFMetadata;
  ela?: ELAProvisionalResult;
  noise?: NoiseResidualProvisionalResult;
  frequencyStatus?: AnalysisStatus;
  regionalStatus?: AnalysisStatus;
  evidenceStatus?: AnalysisStatus;
  frequency?: FrequencyDomainResult;
  regionalAnomaly?: RegionalAnomalyResult;
  synthesis?: SynthesisResult;
  evidence?: EvidenceInterpretation;
}

export interface ImageProperties {
  filename?: string;
  format?: string;
  mimeType?: string;
  sizeBytes?: number;
  sizeReadable?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  pixelCount?: number;
  mode?: string;
  hasTransparency?: boolean;
  size?: number;
}

export interface VideoProperties { width?: number; height?: number; duration?: number; frameRate?: number }
export interface AudioProperties { duration?: number; sampleRate?: number; channels?: number }
export interface TextInput { content: string; sourceName?: string }
export interface ModuleStatus { name: string; status: AnalysisStatus }
export interface MetadataResult { exif?: Record<string, unknown>; observations?: string[] }
export interface ELAResult { status: AnalysisStatus; observations?: string[]; evidenceUrl?: string }
export interface NoiseResult { status: AnalysisStatus; observations?: string[] }
export interface FrequencyResult { status: AnalysisStatus; observations?: string[] }
export interface VideoAnalysisResult { status: AnalysisStatus; frameObservations?: string[]; temporalObservations?: string[]; synchronizationObservations?: string[] }
export interface AudioAnalysisResult { status: AnalysisStatus; metadata?: Record<string, unknown>; waveformUrl?: string; spectrogramUrl?: string; observations?: string[] }
export interface TextAnalysisResult { status: AnalysisStatus; linguisticObservations?: string[]; manipulationIndicators?: string[] }
export interface CrossModalResult { status: AnalysisStatus; observations?: string[] }
export interface Finding { id: string; title: string; severity?: Severity; module: string; observation: string; interpretation?: string; evidenceReference?: string; limitations?: string }

export interface InvestigationResult {
  id?: string;
  filenames: string[];
  mediaTypes: MediaType[];
  timestamp?: string;
  imageProperties?: ImageProperties;
  videoProperties?: VideoProperties;
  audioProperties?: AudioProperties;
  sha256?: string[];
  fileFormat?: string;
  fileSize?: number;
  analysisStatus?: AnalysisStatus;
  imageEvidence?: ImageForensicEvidence;
  assessment?: Assessment;
  assessmentDetails?: AssessmentInfo;
  modules: ModuleStatus[];
  findings: Finding[];
  metadata?: MetadataResult;
  ela?: ELAResult;
  noise?: NoiseResult;
  frequency?: FrequencyResult;
  video?: VideoAnalysisResult;
  audio?: AudioAnalysisResult;
  text?: TextAnalysisResult;
  crossModal?: CrossModalResult;
  rawResponse?: Record<string, unknown>;
}

export interface Report { id: string; investigationId: string; generatedAt: string; filenames: string[]; assessment?: Assessment; downloadUrl?: string }
