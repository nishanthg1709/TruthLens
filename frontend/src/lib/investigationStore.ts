import type { InvestigationResult, MediaType } from '../types';

export type InvestigationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'inconclusive';

export interface StoredInvestigation {
  id: string;
  filename: string;
  mediaType: MediaType;
  submittedAt: string;
  status: InvestigationStatus;
  statusUrl?: string;
  reportUrl?: string;
  result?: InvestigationResult;
}

const STORAGE_KEY = 'truthlens-investigations';

export interface InvestigationHistoryRead {
  records: StoredInvestigation[];
  error?: string;
}

export function readInvestigationHistory(): InvestigationHistoryRead {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { records: [], error: 'Saved investigation history is not in a supported format.' };
    const validStatuses: InvestigationStatus[] = ['pending','running','completed','failed','inconclusive'];
    const records = parsed.filter((item): item is StoredInvestigation =>
      typeof item?.id === 'string' &&
      typeof item?.filename === 'string' &&
      ['image','video','audio','text'].includes(item.mediaType) &&
      typeof item?.submittedAt === 'string' &&
      validStatuses.includes(item.status) &&
      (item.statusUrl === undefined || typeof item.statusUrl === 'string') &&
      (item.reportUrl === undefined || typeof item.reportUrl === 'string')
    );
    return { records };
  } catch {
    return { records: [], error: 'Unable to read locally saved investigation history.' };
  }
}

export function readInvestigations(): StoredInvestigation[] {
  return readInvestigationHistory().records;
}

function sanitizeResultForStorage(result?: InvestigationResult): InvestigationResult | undefined {
  if (!result) return undefined;
  try {
    const clone = JSON.parse(JSON.stringify(result)) as InvestigationResult;
    if (clone.imageEvidence) {
      if (clone.imageEvidence.ela) delete clone.imageEvidence.ela.visualizationUrl;
      if (clone.imageEvidence.noise) delete clone.imageEvidence.noise.visualizationUrl;
      if (clone.imageEvidence.frequency) delete clone.imageEvidence.frequency.visualizationUrl;
      if (clone.imageEvidence.regionalAnomaly) delete clone.imageEvidence.regionalAnomaly.visualizationUrl;
      if (clone.imageEvidence.originalImageUrl?.startsWith('blob:')) delete clone.imageEvidence.originalImageUrl;
    }
    delete clone.rawResponse;
    return clone;
  } catch {
    return undefined;
  }
}

export function saveInvestigation(record: StoredInvestigation): void {
  const { records } = readInvestigationHistory();
  const safeRecord: StoredInvestigation = {
    ...record,
    result: sanitizeResultForStorage(record.result),
  };
  const next = [safeRecord, ...records.filter((item) => item.id !== record.id)].slice(0, 50);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    try {
      const minimal = next.map(r => ({ ...r, result: undefined }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    } catch {
      // Ignored if local storage disabled
    }
  }
}

export function updateInvestigationStatus(id: string, status: InvestigationStatus): void {
  const { records } = readInvestigationHistory();
  const next = records.map((record) => record.id === id ? { ...record, status } : record);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

export function deleteInvestigation(id: string): void {
  const { records } = readInvestigationHistory();
  const next = records.filter((record) => record.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

export function clearInvestigationHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
