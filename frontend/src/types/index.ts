export type MediaType = 'image' | 'video' | 'audio' | 'text';
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'unavailable';
export type Assessment = 'NO MAJOR INDICATORS' | 'REQUIRES REVIEW' | 'MULTIPLE ANOMALIES' | 'INCONCLUSIVE';
export type Severity = 'low' | 'medium' | 'high' | 'informational';

export interface MediaFile { file: globalThis.File; type: MediaType; previewUrl?: string }
export interface RGBMeasurements { red?: number; green?: number; blue?: number; r?: number; g?: number; b?: number; mean?: number; [key: string]: number | undefined }
export interface RegionalMeasurement { row?: number; column?: number; region?: string; value?: number; measurements?: RGBMeasurements | Record<string, number>; [key: string]: unknown }
export interface EXIFMetadata {
 cameraManufacturer?: string; cameraModel?: string; originalTimestamp?: string; modificationTimestamp?: string;
 editingSoftware?: string; gpsPresent?: boolean; unavailable?: string[]; [key: string]: unknown;
}
export interface ELAProvisionalResult {
 status: AnalysisStatus; visualizationUrl?: string; difference?: Record<string, number>;
 rgb?: RGBMeasurements; regional?: RegionalMeasurement[]; observations?: string[];
}
export interface NoiseResidualProvisionalResult {
 status: AnalysisStatus; visualizationUrl?: string; gaussianSmoothing?: string | Record<string, unknown>;
 statistics?: Record<string, number>; rgb?: RGBMeasurements; regional?: RegionalMeasurement[]; observations?: string[];
}
export interface EvidenceInterpretation {
 observedIndicators?: string[]; supportingEvidence?: string[]; potentialAnomalies?: string[];
 limitations?: string[]; interpretationNotes?: string[];
}
export interface ImageForensicEvidence {
 status: AnalysisStatus; originalImageUrl?: string; fileFormat?: string; fileSize?: number;
 width?: number; height?: number; resolution?: string; sha256?: string; exif?: EXIFMetadata;
 ela?: ELAProvisionalResult; noise?: NoiseResidualProvisionalResult;
 frequencyStatus?: AnalysisStatus; regionalStatus?: AnalysisStatus; evidenceStatus?: AnalysisStatus;
 evidence?: EvidenceInterpretation;
}
export interface ImageProperties { width?: number; height?: number; format?: string; size?: number }

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
  id?: string; filenames: string[]; mediaTypes: MediaType[]; timestamp?: string;
  imageProperties?: ImageProperties; videoProperties?: VideoProperties; audioProperties?: AudioProperties;
  sha256?: string[]; fileFormat?: string; fileSize?: number; analysisStatus?: AnalysisStatus; imageEvidence?: ImageForensicEvidence; assessment?: Assessment; modules: ModuleStatus[]; findings: Finding[];
  metadata?: MetadataResult; ela?: ELAResult; noise?: NoiseResult; frequency?: FrequencyResult;
  video?: VideoAnalysisResult; audio?: AudioAnalysisResult; text?: TextAnalysisResult; crossModal?: CrossModalResult;
}
export interface Report { id: string; investigationId: string; generatedAt: string; filenames: string[]; assessment?: Assessment; downloadUrl?: string }
