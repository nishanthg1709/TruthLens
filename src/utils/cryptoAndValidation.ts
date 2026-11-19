import { BACKEND_LIMITS } from '../constants/assets';

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dimensions?: {
    width: number;
    height: number;
    megapixels: number;
  };
}

export async function calculateSha256(file: File | Blob): Promise<string | null> {
  try {
    if (!window.crypto?.subtle) return null;
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export async function calculateTextSha256(text: string): Promise<string | null> {
  try {
    if (!window.crypto?.subtle) return null;
    const encoder = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(text));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to decode image dimensions. File may be corrupted or unsupported.'));
    };
    img.src = url;
  });
}

export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const supported = BACKEND_LIMITS.SUPPORTED_IMAGE_MIME as readonly string[];
  const rawType = file.type.toLowerCase();
  const normalizedType = rawType === 'image/jpg' ? 'image/jpeg' : rawType;
  const extMatch = file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/);
  const effectiveType =
    normalizedType ||
    (extMatch
      ? extMatch[1] === 'png'
        ? 'image/png'
        : extMatch[1] === 'webp'
          ? 'image/webp'
          : 'image/jpeg'
      : '');

  if (!supported.includes(effectiveType)) {
    errors.push(
      `Unsupported image format (${file.type || 'unknown'}). Allowed formats: JPEG, PNG, WEBP.`
    );
  }

  if (file.size === 0) {
    errors.push('File appears empty (0 bytes).');
  } else if (file.size > BACKEND_LIMITS.MAX_FILE_SIZE_BYTES) {
    errors.push(
      `File exceeds maximum size limit of ${BACKEND_LIMITS.MAX_FILE_SIZE_MB} MB (received ${formatFileSize(file.size)}).`
    );
  }

  let dimensions: ImageValidationResult['dimensions'];
  if (effectiveType.startsWith('image/')) {
    try {
      const dims = await readImageDimensions(file);
      const area = dims.width * dims.height;
      const megapixels = Number((area / 1_000_000).toFixed(2));
      dimensions = { width: dims.width, height: dims.height, megapixels };

      if (
        dims.width > BACKEND_LIMITS.MAX_DIMENSION_PX ||
        dims.height > BACKEND_LIMITS.MAX_DIMENSION_PX
      ) {
        errors.push(
          `Image dimension (${dims.width} × ${dims.height} px) exceeds backend limit of ${BACKEND_LIMITS.MAX_DIMENSION_PX.toLocaleString()} px.`
        );
      }

      if (area > BACKEND_LIMITS.MAX_AREA_PX) {
        errors.push(
          `Image area (${megapixels} MP) exceeds backend maximum of ${BACKEND_LIMITS.MAX_MEGAPIXELS} megapixels.`
        );
      }

      if (dims.width < 128 || dims.height < 128) {
        warnings.push(
          'Very low resolution image (< 128 px). Regional 4×4 and frequency analysis reliability is significantly reduced.'
        );
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unable to read image dimensions.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    dimensions,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Unavailable';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || Number.isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

export function stripSensitiveMetadata(
  input: Record<string, unknown>
): { sanitized: Record<string, string | number>; gpsRemoved: boolean } {
  const sanitized: Record<string, string | number> = {};
  let gpsRemoved = false;

  const sensitivePattern = /(gps|latitude|longitude|altitude|geotag|location_coord)/i;

  const redactRecursive = (val: unknown): unknown => {
    if (Array.isArray(val)) {
      return val.map((item) => redactRecursive(item));
    }
    if (val && typeof val === 'object') {
      const cleaned: Record<string, unknown> = {};
      Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
        if (sensitivePattern.test(k)) {
          gpsRemoved = true;
          return;
        }
        cleaned[k] = redactRecursive(v);
      });
      return cleaned;
    }
    return val;
  };

  Object.entries(input).forEach(([key, value]) => {
    if (sensitivePattern.test(key)) {
      gpsRemoved = true;
      return;
    }
    if (value === null || value === undefined) return;
    if (typeof value === 'string' || typeof value === 'number') {
      sanitized[key] = value;
    } else if (typeof value === 'boolean') {
      sanitized[key] = value ? 'Yes' : 'No';
    } else {
      sanitized[key] = JSON.stringify(redactRecursive(value));
    }
  });

  return { sanitized, gpsRemoved };
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const num = String(Date.now()).slice(-4);
  return `${prefix}-${num}${rand}`;
}
