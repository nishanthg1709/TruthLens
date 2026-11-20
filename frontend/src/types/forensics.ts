export type EvidenceMediaType = 'image' | 'video' | 'audio' | 'text';

export type InvestigationCategory =
  | 'Media Verification'
  | 'Disinformation Review'
  | 'Deepfake Investigation'
  | 'Document & Provenance'
  | 'Incident Response'
  | 'Academic Research';

export type InvestigationStatus = 'Active' | 'In Review' | 'Completed' | 'Archived';

export type EvidenceAnalysisStatus =
  | 'Unanalyzed'
  | 'Queued'
  | 'Analyzing'
  | 'Analyzed'
  | 'Requires Review'
  | 'Engine Unavailable'
  | 'Failed';

export type HashOrigin = 'local_sha256' | 'server_sha256' | 'unavailable';

export interface CustodyEvent {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  origin: 'local_client' | 'forensic_backend' | 'investigator' | 'demo_fixture';
  details: string;
}

export interface InvestigatorNote {
  id: string;
  author: string;
  createdAt: string;
  content: string;
  category: 'Observation' | 'Context' | 'Limitation' | 'Manual Check';
}

export interface RegionObservation {
  regionId: string; // r0_c0 .. r3_c3
  row: number;
  col: number;
  flagged: boolean;
  reviewLevel: 'Nominal' | 'Elevated' | 'Requires Review';
  deviationIndex?: number;
  neighborContrast?: number;
  signals: string[];
  observations: string[];
  limitations: string[];
}

export interface DomainObservationBlock {
  domainKey: 'metadata' | 'compression' | 'noise' | 'frequency' | 'spatial';
  title: string;
  isIndependentDomain: boolean;
  status: 'Available' | 'Limited' | 'Not Available';
  indicatorCount: number;
  summary: string;
  observations: string[];
  technicalValues: Record<string, string | number | boolean | null>;
  limitations: string[];
}

export interface FrequencySpectrumPoint {
  band: string;
  magnitude: number;
  referenceBaseline?: number;
}

export interface AIModelStatus {
  available: boolean;
  status: 'available' | 'unavailable' | 'failed';
  modelName?: string | null;
  message: string;
  warning?: string | null;
}

export interface ImageForensicResult {
  analysisId: string;
  analyzedAt: string;
  isDemoData: boolean;
  engineVersion: string;
  source: 'backend_api' | 'demo_fixture';
  completionStatus: 'Completed' | 'Partial';
  independentDomainsAvailable: number;
  regionsRequiringReview: number;
  evidenceStrengthDescriptor: string;
  summaryObservations: string[];
  limitations: string[];
  recommendedManualChecks: string[];
  alternativeExplanations: string[];
  sanitizedMetadata: Record<string, string | number>;
  gpsStrippedNotice: boolean;
  domains: DomainObservationBlock[];
  regions: RegionObservation[];
  frequencyProfile: FrequencySpectrumPoint[];
  modelStatus?: AIModelStatus;
  visualizations: {
    elaDataUrl?: string | null;
    noiseDataUrl?: string | null;
    frequencyDataUrl?: string | null;
    regionalHeatmapDataUrl?: string | null;
  };
  rawResponse?: unknown;
}

export interface EvidenceItem {
  id: string;
  investigationId: string | null;
  fileName: string;
  mediaType: EvidenceMediaType;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  sha256: string | null;
  hashOrigin: HashOrigin;
  dimensions?: { width: number; height: number; megapixels: number };
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  previewUrl?: string;
  textContent?: string;
  analysisStatus: EvidenceAnalysisStatus;
  analysisResult?: ImageForensicResult | null;
  notes: InvestigatorNote[];
  custodyLog: CustodyEvent[];
  isDemoData?: boolean;
  sourceContext?: string;
}

export interface Investigation {
  id: string;
  caseReference: string;
  title: string;
  description: string;
  category: InvestigationCategory;
  investigator: string;
  status: InvestigationStatus;
  selectedModules: string[];
  contextualNotes: string;
  createdAt: string;
  updatedAt: string;
  evidenceIds: string[];
  reportGeneratedAt?: string | null;
  isDemoData?: boolean;
}

export interface ActivityFeedItem {
  id: string;
  timestamp: string;
  type:
    | 'evidence_uploaded'
    | 'analysis_started'
    | 'analysis_completed'
    | 'report_generated'
    | 'human_review_added'
    | 'investigation_created';
  title: string;
  detail: string;
  investigationId?: string;
  evidenceId?: string;
  isDemoData: boolean;
}

export interface BackendHealthState {
  status: 'checking' | 'connected' | 'disconnected';
  apiBaseUrl: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  responseTimeMs: number | null;
  version: string | null;
  supportedFormats: string[];
  limits: {
    maxFileSizeMb: number;
    maxDimensionPx: number;
    maxMegapixels: number;
  };
  errorMessage: string | null;
  endpointsConfirmed: {
    health: boolean;
    analyze: boolean;
  };
}

export interface AppSettings {
  theme: 'dark' | 'light';
  animationsEnabled: boolean;
  compactMode: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  textScale: 'standard' | 'large' | 'compact';
  apiBaseUrl: string;
  showGridOverlayByDefault: boolean;
  showRegionIdsOnGrid: boolean;
  highlightFlaggedRegions: boolean;
}

export interface ReportConfig {
  title: string;
  investigationId: string;
  reportDate: string;
  preparedBy: string;
  selectedEvidenceIds: string[];
  investigatorNotes: string;
  conclusionDraft: string;
  sections: {
    cover: boolean;
    investigationDetails: boolean;
    executiveSummary: boolean;
    evidenceInventory: boolean;
    fileIntegrity: boolean;
    analysisMethods: boolean;
    observedIndicators: boolean;
    regionObservations: boolean;
    supportingEvidence: boolean;
    crossModalObservations: boolean;
    limitations: boolean;
    alternativeExplanations: boolean;
    recommendedVerification: boolean;
    investigatorNotes: boolean;
    conclusion: boolean;
  };
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'caution' | 'alert';
}
