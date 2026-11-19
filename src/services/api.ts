export function getDefaultApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (envUrl && envUrl.trim().replace(/\/+$/, '')) || 'http://localhost:8000';
}

export class ForensicApiError extends Error {
  public readonly statusCode: number | null;
  public readonly code: 'NETWORK_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'SERVER_ERROR' | 'INVALID_RESPONSE';

  constructor(
    message: string,
    code: ForensicApiError['code'],
    statusCode: number | null = null
  ) {
    super(message);
    this.name = 'ForensicApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ForensicApiError(
        `Forensic engine request timed out after ${Math.round(timeoutMs / 1000)}s.`,
        'TIMEOUT'
      );
    }
    throw new ForensicApiError(
      'Unable to connect to the TruthLens forensic backend. Verify the FastAPI service is running and CORS is enabled.',
      'NETWORK_ERROR'
    );
  } finally {
    window.clearTimeout(timer);
  }
}
