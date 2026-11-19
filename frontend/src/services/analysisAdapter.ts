import type { InvestigationResult, MediaType } from '../types';

export class AnalysisConnectionError extends Error {
  constructor(message = 'Forensic engine not connected') { super(message); this.name = 'AnalysisConnectionError' }
}

const backendUrl = (import.meta.env.VITE_TRUTHLENS_API_URL as string | undefined)?.replace(/\/$/, '');
const submitPath = (import.meta.env.VITE_TRUTHLENS_ANALYSIS_PATH as string | undefined) || '/api/analyze';

export function isBackendConfigured(): boolean { return Boolean(backendUrl) }

export async function submitInvestigation(payload: { mediaType: MediaType; file?: File; text?: string }, signal?: AbortSignal): Promise<InvestigationResult> {
  if (!backendUrl) throw new AnalysisConnectionError();
  const form = new FormData();
  form.append('mediaType', payload.mediaType);
  if (payload.file) form.append('media', payload.file);
  if (payload.text) form.append('text', payload.text);
  const response = await fetch(`${backendUrl}${submitPath}`, { method: 'POST', body: form, signal });
  if (!response.ok) throw new Error(`Backend request failed (${response.status})`);
  const raw = await response.json();
  return normalizeInvestigation(raw);
}

export function normalizeInvestigation(raw: Record<string, unknown>): InvestigationResult {
  const asArray = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    filenames: asArray(raw.filenames), mediaTypes: Array.isArray(raw.mediaTypes) ? raw.mediaTypes as InvestigationResult['mediaTypes'] : [],
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
    sha256: Array.isArray(raw.sha256) ? asArray(raw.sha256) : undefined,
    assessment: typeof raw.assessment === 'string' ? raw.assessment as InvestigationResult['assessment'] : undefined,
    modules: Array.isArray(raw.modules) ? raw.modules as InvestigationResult['modules'] : [], findings: Array.isArray(raw.findings) ? raw.findings as InvestigationResult['findings'] : [],
  };
}
