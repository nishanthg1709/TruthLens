import { BACKEND_LIMITS } from '../constants/assets';
import { BackendHealthState } from '../types/forensics';
import { fetchWithTimeout, ForensicApiError } from './api';

export async function checkBackendHealth(
  apiBaseUrl: string,
  previousSuccessAt: string | null = null
): Promise<BackendHealthState> {
  const normalizedBase = apiBaseUrl.trim().replace(/\/+$/, '');
  const nowIso = new Date().toISOString();
  const start = performance.now();

  try {
    const res = await fetchWithTimeout(`${normalizedBase}/health`, { method: 'GET' }, 5000);
    const elapsedMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        status: 'disconnected',
        apiBaseUrl: normalizedBase,
        lastCheckedAt: nowIso,
        lastSuccessAt: previousSuccessAt,
        responseTimeMs: elapsedMs,
        version: null,
        supportedFormats: [...BACKEND_LIMITS.SUPPORTED_IMAGE_LABELS],
        limits: {
          maxFileSizeMb: BACKEND_LIMITS.MAX_FILE_SIZE_MB,
          maxDimensionPx: BACKEND_LIMITS.MAX_DIMENSION_PX,
          maxMegapixels: BACKEND_LIMITS.MAX_MEGAPIXELS,
        },
        errorMessage: `Backend responded with HTTP ${res.status} (${res.statusText || 'Error'}) on GET /health.`,
        endpointsConfirmed: {
          health: false,
          analyze: false,
        },
      };
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await res.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const version =
      typeof payload.version === 'string'
        ? payload.version
        : typeof payload.api_version === 'string'
          ? payload.api_version
          : 'FastAPI (reported healthy)';

    return {
      status: 'connected',
      apiBaseUrl: normalizedBase,
      lastCheckedAt: nowIso,
      lastSuccessAt: nowIso,
      responseTimeMs: elapsedMs,
      version,
      supportedFormats: [...BACKEND_LIMITS.SUPPORTED_IMAGE_LABELS],
      limits: {
        maxFileSizeMb: BACKEND_LIMITS.MAX_FILE_SIZE_MB,
        maxDimensionPx: BACKEND_LIMITS.MAX_DIMENSION_PX,
        maxMegapixels: BACKEND_LIMITS.MAX_MEGAPIXELS,
      },
      errorMessage: null,
      endpointsConfirmed: {
        health: true,
        analyze: true,
      },
    };
  } catch (err) {
    const message =
      err instanceof ForensicApiError
        ? err.message
        : 'Unable to reach forensic backend at /health.';

    return {
      status: 'disconnected',
      apiBaseUrl: normalizedBase,
      lastCheckedAt: nowIso,
      lastSuccessAt: previousSuccessAt,
      responseTimeMs: null,
      version: null,
      supportedFormats: [...BACKEND_LIMITS.SUPPORTED_IMAGE_LABELS],
      limits: {
        maxFileSizeMb: BACKEND_LIMITS.MAX_FILE_SIZE_MB,
        maxDimensionPx: BACKEND_LIMITS.MAX_DIMENSION_PX,
        maxMegapixels: BACKEND_LIMITS.MAX_MEGAPIXELS,
      },
      errorMessage: message,
      endpointsConfirmed: {
        health: false,
        analyze: false,
      },
    };
  }
}
