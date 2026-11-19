export type MediaType = 'image' | 'video' | 'audio' | 'text';
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'unavailable';
export type Assessment = 'NO MAJOR INDICATORS' | 'REQUIRES REVIEW' | 'MULTIPLE ANOMALIES' | 'INCONCLUSIVE';
export type Severity = 'low' | 'medium' | 'high' | 'informational';

export interface MediaFile { file: globalThis.File; type: MediaType; previewUrl?: string }
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
  sha256?: string[]; assessment?: Assessment; modules: ModuleStatus[]; findings: Finding[];
  metadata?: MetadataResult; ela?: ELAResult; noise?: NoiseResult; frequency?: FrequencyResult;
  video?: VideoAnalysisResult; audio?: AudioAnalysisResult; text?: TextAnalysisResult; crossModal?: CrossModalResult;
}
export interface Report { id: string; investigationId: string; generatedAt: string; filenames: string[]; assessment?: Assessment; downloadUrl?: string }
