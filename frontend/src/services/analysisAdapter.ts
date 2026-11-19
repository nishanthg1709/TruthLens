import type { AnalysisStatus, InvestigationResult, MediaType, RegionalMeasurement, Finding } from '../types';

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

const backendUrl = (import.meta.env.VITE_TRUTHLENS_API_URL as string | undefined)?.trim().replace(/\/$/, '');
const submissionPath = (import.meta.env.VITE_TRUTHLENS_ANALYSIS_PATH as string | undefined)?.trim();
const imagePath = (import.meta.env.VITE_TRUTHLENS_IMAGE_ANALYSIS_PATH as string | undefined)?.trim();
const videoPath = (import.meta.env.VITE_TRUTHLENS_VIDEO_ANALYSIS_PATH as string | undefined)?.trim();
const audioPath = (import.meta.env.VITE_TRUTHLENS_AUDIO_ANALYSIS_PATH as string | undefined)?.trim();
const textPath = (import.meta.env.VITE_TRUTHLENS_TEXT_ANALYSIS_PATH as string | undefined)?.trim();
const statusPath = (import.meta.env.VITE_TRUTHLENS_STATUS_PATH as string | undefined)?.trim();
const healthPath = (import.meta.env.VITE_TRUTHLENS_HEALTH_PATH as string | undefined)?.trim();
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
    if (value === 'completed') return 'completed';
    if (value === 'failed') return 'failed';
    return 'unavailable';
  };

  const imageRaw = firstObject(raw.image, raw.imageEvidence, raw.image_evidence, raw.image_analysis);
  const metadataRaw = firstObject(raw.metadata, raw.exif, raw.exif_metadata, raw.exifMetadata, imageRaw?.metadata, imageRaw?.exif);
  const elaRaw = firstObject(raw.ela, raw.elaAnalysis, raw.ela_analysis, imageRaw?.ela);
  const noiseRaw = firstObject(raw.noise, raw.noiseResidual, raw.noise_residual, raw.noiseResidualAnalysis, imageRaw?.noise, imageRaw?.noiseResidual);
  const evidenceRaw = firstObject(raw.evidence, raw.evidenceInterpretation, raw.evidence_interpretation, imageRaw?.evidence);

  const exif = metadataRaw ? {
    cameraManufacturer: stringValue(metadataRaw.cameraManufacturer, metadataRaw.camera_manufacturer, metadataRaw.make),
    cameraModel: stringValue(metadataRaw.cameraModel, metadataRaw.camera_model, metadataRaw.model),
    originalTimestamp: stringValue(metadataRaw.originalTimestamp, metadataRaw.original_timestamp, metadataRaw.dateTimeOriginal, metadataRaw.DateTimeOriginal),
    modificationTimestamp: stringValue(metadataRaw.modificationTimestamp, metadataRaw.modification_timestamp, metadataRaw.dateTimeModified, metadataRaw.DateTimeModified),
    editingSoftware: stringValue(metadataRaw.editingSoftware, metadataRaw.editing_software, metadataRaw.software),
    gpsPresent: typeof metadataRaw.gpsPresent === 'boolean' ? metadataRaw.gpsPresent : typeof metadataRaw.gps_present === 'boolean' ? metadataRaw.gps_present : typeof metadataRaw.gps !== 'undefined' ? metadataRaw.gps !== null : undefined,
  } : undefined;

  const normalizeRgb = (value: unknown) => {
    if (!value || typeof value !== 'object') return undefined;
    const rgb = value as Record<string, unknown>;
    const numeric = (key: string) => typeof rgb[key] === 'number' ? rgb[key] as number : undefined;
    return { red:numeric('red') ?? numeric('r'), green:numeric('green') ?? numeric('g'), blue:numeric('blue') ?? numeric('b'), mean:numeric('mean'), r:numeric('r'), g:numeric('g'), b:numeric('b') };
  };

  const normalizeRegions = (value: unknown) => {
    if (!Array.isArray(value)) return undefined;
    return value.filter(item => item && typeof item === 'object').map(item => item as Record<string, unknown>) as RegionalMeasurement[];
  };

  const ela = elaRaw ? {
    status: normalizeStatusValue(elaRaw.status),
    visualizationUrl: stringValue(elaRaw.visualizationUrl, elaRaw.visualization_url, elaRaw.imageUrl, elaRaw.image_url),
    difference: typeof elaRaw.difference === 'object' && elaRaw.difference !== null ? elaRaw.difference as Record<string, number> : typeof elaRaw.overall === 'object' && elaRaw.overall !== null ? elaRaw.overall as Record<string, number> : undefined,
    rgb: normalizeRgb(elaRaw.rgb ?? elaRaw.rgbMeasurements ?? elaRaw.rgb_measurements),
    regional: normalizeRegions(elaRaw.regional ?? elaRaw.regionalAnalysis ?? elaRaw.regional_analysis ?? elaRaw.regions),
    observations: arrayValue(elaRaw.observations)?.filter((item): item is string => typeof item === 'string'),
  } : undefined;

  const noise = noiseRaw ? {
    status: normalizeStatusValue(noiseRaw.status),
    visualizationUrl: stringValue(noiseRaw.visualizationUrl, noiseRaw.visualization_url, noiseRaw.imageUrl, noiseRaw.image_url),
    gaussianSmoothing: typeof noiseRaw.gaussianSmoothing === 'string' || typeof noiseRaw.gaussianSmoothing === 'object' ? noiseRaw.gaussianSmoothing as string | Record<string, unknown> : typeof noiseRaw.gaussian_smoothing === 'string' || typeof noiseRaw.gaussian_smoothing === 'object' ? noiseRaw.gaussian_smoothing as string | Record<string, unknown> : undefined,
    statistics: typeof noiseRaw.statistics === 'object' && noiseRaw.statistics !== null ? noiseRaw.statistics as Record<string, number> : typeof noiseRaw.measurements === 'object' && noiseRaw.measurements !== null ? noiseRaw.measurements as Record<string, number> : undefined,
    rgb: normalizeRgb(noiseRaw.rgb ?? noiseRaw.rgbMeasurements ?? noiseRaw.rgb_measurements),
    regional: normalizeRegions(noiseRaw.regional ?? noiseRaw.regionalAnalysis ?? noiseRaw.regional_analysis ?? noiseRaw.regions),
    observations: arrayValue(noiseRaw.observations)?.filter((item): item is string => typeof item === 'string'),
  } : undefined;

  const modulesValue = arrayValue(raw.modules);
  const modules = modulesValue ? modulesValue.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').map(item => ({ name:stringValue(item.name, item.module) ?? 'Unnamed module', status:normalizeStatusValue(item.status) })) : [];

  const findingsValue = arrayValue(raw.findings);
  const findings = findingsValue ? findingsValue.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').map((item,index) => ({ id:stringValue(item.id) ?? `finding-${index+1}`, title:stringValue(item.title, item.name) ?? 'Backend finding', severity:typeof item.severity === 'string' ? item.severity as Finding['severity'] : undefined, module:stringValue(item.module, item.relatedModule) ?? 'Unknown module', observation:stringValue(item.observation, item.description) ?? 'No observation supplied.', interpretation:stringValue(item.interpretation, item.possibleInterpretation), evidenceReference:stringValue(item.evidenceReference, item.evidence_reference), limitations:stringValue(item.limitations, item.limitationsText) })) : [];

  const imageEvidence = imageRaw || ela || noise || exif ? {
    status: normalizeStatusValue(raw.analysisStatus ?? raw.status ?? imageRaw?.status),
    originalImageUrl:stringValue(raw.originalImageUrl, raw.original_image_url, raw.fileUrl, raw.file_url, imageRaw?.originalImageUrl, imageRaw?.original_image_url),
    fileFormat:stringValue(raw.fileFormat, raw.file_format, raw.format, imageRaw?.fileFormat, imageRaw?.format),
    fileSize:numberValue(raw.fileSize, raw.file_size, imageRaw?.fileSize, imageRaw?.file_size),
    width:numberValue(raw.width, raw.imageWidth, raw.image_width, imageRaw?.width, imageRaw?.imageWidth, imageRaw?.image_width),
    height:numberValue(raw.height, raw.imageHeight, raw.image_height, imageRaw?.height, imageRaw?.imageHeight, imageRaw?.image_height),
    resolution:stringValue(raw.resolution, imageRaw?.resolution),
    sha256:stringValue(raw.sha256, raw.sha_256, imageRaw?.sha256, imageRaw?.sha_256),
    exif,
    ela,
    noise,
    frequencyStatus:'unavailable' as AnalysisStatus,
    regionalStatus:'unavailable' as AnalysisStatus,
    evidenceStatus:(evidenceRaw?'completed':'unavailable') as AnalysisStatus,
    evidence:evidenceRaw ? {
      observedIndicators:arrayValue(evidenceRaw.observedIndicators, evidenceRaw.indicators)?.filter((item):item is string=>typeof item==='string'),
      supportingEvidence:arrayValue(evidenceRaw.supportingEvidence, evidenceRaw.supporting_evidence)?.filter((item):item is string=>typeof item==='string'),
      potentialAnomalies:arrayValue(evidenceRaw.potentialAnomalies, evidenceRaw.potential_anomalies)?.filter((item):item is string=>typeof item==='string'),
      limitations:arrayValue(evidenceRaw.limitations)?.filter((item):item is string=>typeof item==='string'),
      interpretationNotes:arrayValue(evidenceRaw.interpretationNotes, evidenceRaw.notes)?.filter((item):item is string=>typeof item==='string'),
    } : undefined,
  } : undefined;

  return {
    id:stringValue(raw.id,raw.investigationId,raw.investigation_id),
    filenames:asArray(raw.filenames).length ? asArray(raw.filenames) : typeof raw.filename==='string' ? [raw.filename] : typeof raw.originalFilename==='string' ? [raw.originalFilename] : [],
    mediaTypes:Array.isArray(raw.mediaTypes)?raw.mediaTypes as InvestigationResult['mediaTypes']:imageRaw?['image']:[],
    timestamp:stringValue(raw.timestamp,raw.createdAt,raw.created_at,raw.analysisTimestamp,raw.analysis_timestamp),
    sha256:typeof raw.sha256==='string'?[raw.sha256]:Array.isArray(raw.sha256)?asArray(raw.sha256):typeof raw.sha_256==='string'?[raw.sha_256]:[],
    fileFormat:stringValue(raw.fileFormat,raw.file_format,raw.format,imageRaw?.fileFormat,imageRaw?.format),
    fileSize:numberValue(raw.fileSize,raw.file_size,imageRaw?.fileSize,imageRaw?.file_size),
    analysisStatus:normalizeStatusValue(raw.analysisStatus ?? raw.status ?? imageRaw?.status),
    imageEvidence,
    assessment:typeof raw.assessment==='string'?raw.assessment as InvestigationResult['assessment']:undefined,
    modules,findings,
  };
}


function normalizeStatus(value: unknown): AnalysisStatus {
  if (value === 'pending' || value === 'queued' || value === 'running' || value === 'processing' || value === 'completed' || value === 'failed' || value === 'unavailable') {
    if (value === 'queued') return 'pending';
    if (value === 'processing') return 'running';
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
  if (!path) throw new AnalysisContractError('Analysis submission endpoint is not configured. Set VITE_TRUTHLENS_ANALYSIS_PATH or a media-specific analysis path.');

  const form = new FormData();
  form.append('mediaType', payload.mediaType);
  if (payload.file) form.append('media', payload.file);
  if (payload.text) form.append('text', payload.text);

  const response = await fetchWithTimeout(joinUrl(path), { method: 'POST', body: form }, options.timeoutMs ?? (Number.isFinite(configuredRequestTimeout) && configuredRequestTimeout > 0 ? configuredRequestTimeout : 30000), options.signal);
  if (!response.ok) throw new Error(`Backend request failed (${response.status})`);
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
  if (!url) throw new AnalysisContractError('Job status endpoint is not configured. Set VITE_TRUTHLENS_STATUS_PATH or return a status URL from submission.');

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
