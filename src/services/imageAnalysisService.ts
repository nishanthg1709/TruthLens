import { REGION_IDS } from '../constants/assets';
import {
  DomainObservationBlock,
  FrequencySpectrumPoint,
  ImageForensicResult,
  RegionObservation,
} from '../types/forensics';
import { generateId, stripSensitiveMetadata } from '../utils/cryptoAndValidation';
import { fetchWithTimeout, ForensicApiError } from './api';

/**
 * Submits an image file to the FastAPI backend at POST /api/v1/analyze.
 * Uses multipart FormData without setting manual Content-Type headers so the browser
 * supplies the correct multipart boundary.
 * Never fabricates results on failure.
 */
export async function submitImageForForensicAnalysis(
  file: File,
  apiBaseUrl: string
): Promise<ImageForensicResult> {
  const normalizedBase = apiBaseUrl.trim().replace(/\/+$/, '');
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetchWithTimeout(
    `${normalizedBase}/api/v1/analyze`,
    {
      method: 'POST',
      body: formData,
    },
    60000
  );

  if (!response.ok) {
    let detail = `Forensic engine returned HTTP ${response.status}.`;
    try {
      const errorJson = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
      if (typeof errorJson.detail === 'string') {
        detail = errorJson.detail;
      } else if (Array.isArray(errorJson.detail) && errorJson.detail[0]?.msg) {
        detail = errorJson.detail[0].msg;
      }
    } catch {
      // Keep default status detail
    }

    throw new ForensicApiError(
      detail,
      response.status >= 400 && response.status < 500 ? 'VALIDATION_ERROR' : 'SERVER_ERROR',
      response.status
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new ForensicApiError(
      'Forensic engine returned a non-JSON payload that could not be parsed.',
      'INVALID_RESPONSE',
      response.status
    );
  }

  return normalizeBackendAnalysisResponse(raw);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'description' in item) {
        return String((item as Record<string, unknown>).description);
      }
      if (item && typeof item === 'object' && 'message' in item) {
        return String((item as Record<string, unknown>).message);
      }
      return '';
    })
    .filter(Boolean);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeBackendAnalysisResponse(
  raw: Record<string, unknown>
): ImageForensicResult {
  const analyses = Array.isArray(raw.analyses) ? raw.analyses : [];

  const modules = new Map<string, Record<string, unknown>>();
  analyses.forEach((item) => {
    const obj = toRecord(item);
    if (typeof obj.name === 'string') {
      modules.set(obj.name, obj);
    }
  });

  const getModule = (name: string) => modules.get(name) ?? {};
  const getDetails = (name: string) => toRecord(getModule(name).details);
  const getModuleMetrics = (name: string) => toRecord(getModule(name).metrics);
  const getModuleObservations = (name: string) => asStringArray(getModule(name).observations);
  const getModuleLimitations = (name: string) => asStringArray(getModule(name).limitations);

  const properties = toRecord(raw.image_properties);
  const assessment = toRecord(raw.assessment);
  const synthesis = getDetails('synthesis');
  const evidenceSummary = toRecord(synthesis.evidence_summary);
  const regionalDetails = getDetails('regional');
  const regionalSynthesis = toRecord(synthesis.regional_synthesis);

  const metadataDetails = getDetails('metadata');
  const { sanitized: sanitizedMetadata, gpsRemoved } = stripSensitiveMetadata(metadataDetails);

  const moduleStatus = (name: string): DomainObservationBlock['status'] => {
    const status = String(getModule(name).status ?? '').toLowerCase();
    if (['ok', 'completed'].includes(status)) return 'Available';
    if (['failed', 'unavailable', 'not_implemented'].includes(status)) return 'Not Available';
    if (status === 'skipped') return 'Limited';
    return Object.keys(getDetails(name)).length > 0 ? 'Available' : 'Not Available';
  };

  const scalarMetrics = (
    ...sources: Record<string, unknown>[]
  ): Record<string, string | number | boolean | null> => {
    const result: Record<string, string | number | boolean | null> = {};
    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        if (
          (typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value === null) &&
          !['visualization_data_url', 'difference_image_data_url'].includes(key)
        ) {
          result[key] = value;
        }
      }
    }
    return result;
  };

  const buildDomain = (
    domainKey: DomainObservationBlock['domainKey'],
    title: string,
    isIndependentDomain: boolean,
    moduleName: string,
    defaultLimitations: string[]
  ): DomainObservationBlock => {
    const module = getModule(moduleName);
    const details = getDetails(moduleName);
    const observations = [
      ...getModuleObservations(moduleName),
      ...asStringArray(details.observations),
    ];
    const status = moduleStatus(moduleName);
    const limitations = [
      ...getModuleLimitations(moduleName),
      ...asStringArray(details.limitations),
    ];

    return {
      domainKey,
      title,
      isIndependentDomain,
      status,
      indicatorCount: observations.length,
      summary:
        typeof details.summary === 'string'
          ? details.summary
          : typeof module.summary === 'string'
            ? module.summary
            : observations.length
              ? `${observations.length} observation(s) returned by the backend for ${title}.`
              : status === 'Available'
                ? `${title} analysis completed. Review the reported metrics.`
                : `${title} analysis was not available.`,
      observations,
      technicalValues: scalarMetrics(getModuleMetrics(moduleName), details),
      limitations: limitations.length ? limitations : defaultLimitations,
    };
  };

  const domains: DomainObservationBlock[] = [
    buildDomain('metadata', 'Metadata & Provenance', true, 'metadata', [
      'EXIF metadata may be removed by social platforms or messaging apps.',
      'Absence of metadata does not prove manipulation.',
    ]),
    buildDomain('compression', 'Compression & Recompression', true, 'ela', [
      'ELA patterns depend on image format, compression history, and prior saves.',
      'Residual differences are not proof of editing.',
    ]),
    buildDomain('noise', 'Noise & Texture', true, 'noise', [
      'Camera settings, denoising, and scene texture affect noise patterns.',
    ]),
    buildDomain('frequency', 'Frequency Spectrum', true, 'frequency', [
      'Resizing, sharpening, and image processing can affect frequency patterns.',
    ]),
    buildDomain('spatial', 'Spatial Consistency (Supporting Observation)', false, 'regional', [
      'Regional anomaly analysis is supporting evidence and is not an independent evidence domain.',
    ]),
  ];

  const independentDomainsAvailable = domains.filter(
    (domain) => domain.isIndependentDomain && domain.status === 'Available'
  ).length;

  const anomalyItems = Array.isArray(regionalDetails.regional_anomalies)
    ? regionalDetails.regional_anomalies
    : [];
  const tileItems = Array.isArray(regionalSynthesis.tiles)
    ? regionalSynthesis.tiles
    : [];

  const regionMap = new Map<string, Record<string, unknown>>();

  const normalizeRegionId = (item: Record<string, unknown>, index: number): string => {
    const row = Number(item.row);
    const col = Number(item.col);
    if (Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 4 && col >= 0 && col < 4) {
      return `r${row}_c${col}`;
    }

    const rawId = String(item.region_id ?? item.regionId ?? item.id ?? '');
    const match = rawId.match(/r(\d+)_c(\d+)/i);
    if (match) return `r${match[1]}_c${match[2]}`;

    const numericMatch = rawId.match(/(\d+)[^\d]+(\d+)/);
    if (numericMatch) {
      const r = Number(numericMatch[1]);
      const c = Number(numericMatch[2]);
      if (r >= 0 && r < 4 && c >= 0 && c < 4) return `r${r}_c${c}`;
    }

    return REGION_IDS[index] ?? '';
  };

  anomalyItems.forEach((item, index) => {
    const obj = toRecord(item);
    const id = normalizeRegionId(obj, index);
    if (id) regionMap.set(id, { ...obj, _kind: 'anomaly' });
  });

  tileItems.forEach((item, index) => {
    const obj = toRecord(item);
    const id = normalizeRegionId(obj, index);
    if (id) {
      const existing = regionMap.get(id) ?? {};
      regionMap.set(id, { ...existing, ...obj, _kind: 'tile' });
    }
  });

  const regions: RegionObservation[] = REGION_IDS.map((regionId, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const found = regionMap.get(regionId) ?? {};
    const deviationScore = Number(found.deviation_score);
    const neighborDeviation = Number(found.neighbor_deviation);
    const variation = String(found.variation_level ?? '').toLowerCase();
    const flagged =
      variation === 'divergent' ||
      found.is_multi_domain_variation === true;

    const zScores = toRecord(found.z_scores);
    const numericZScores = Object.values(zScores).filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value)
    );
    const zScore = numericZScores.length
      ? Math.max(...numericZScores.map((value) => Math.abs(value)))
      : undefined;

    const deviation =
      Number.isFinite(deviationScore)
        ? deviationScore
        : zScore;

    const neighborContrast =
      Number.isFinite(neighborDeviation)
        ? neighborDeviation
        : undefined;

    const observation =
      typeof found.observation === 'string'
        ? found.observation
        : typeof found.summary === 'string'
          ? found.summary
          : typeof found.description === 'string'
            ? found.description
            : '';

    const tileSummary = typeof found.summary === 'string' ? found.summary : '';

    return {
      regionId,
      row,
      col,
      flagged,
      reviewLevel: flagged
        ? 'Requires Review'
        : variation === 'elevated'
          ? 'Elevated'
          : deviation !== undefined && Math.abs(deviation) >= 2
            ? 'Elevated'
            : 'Nominal',
      deviationIndex: deviation,
      neighborContrast,
      signals: [
        ...asStringArray(found.contributing_domains),
        ...asStringArray(found.active_modules_used),
      ],
      observations: [observation, tileSummary].filter(Boolean),
      limitations: [
        'Regional deviations can arise naturally from lighting, texture, edges, or scene composition.',
      ],
    };
  });

  const regionsRequiringReview = regions.filter((region) => region.flagged).length;

  const metadataValues: Record<string, string | number> = {};
  Object.entries(scalarMetrics(metadataDetails)).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      metadataValues[key] = value;
    }
  });
  const frequencyDetails = getDetails('frequency');
  const frequencyProfile: FrequencySpectrumPoint[] = [
    { band: 'Low Frequency', magnitude: Number(frequencyDetails.low_frequency_power ?? frequencyDetails.low_frequency_energy_percent ?? 0) },
    { band: 'Mid Frequency', magnitude: Number(frequencyDetails.mid_frequency_power ?? frequencyDetails.mid_frequency_energy_percent ?? 0) },
    { band: 'High Frequency', magnitude: Number(frequencyDetails.high_frequency_power ?? frequencyDetails.high_frequency_energy_percent ?? 0) },
  ].filter((point) => Number.isFinite(point.magnitude));

  const extractImg = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return `data:image/png;base64,${value}`;
  };

  const elaDetails = getDetails('ela');
  const noiseDetails = getDetails('noise');
  const visualizations = {
    elaDataUrl: extractImg(elaDetails.difference_image_data_url ?? elaDetails.visualization_data_url),
    noiseDataUrl: extractImg(noiseDetails.visualization_data_url),
    frequencyDataUrl: extractImg(frequencyDetails.visualization_data_url),
    regionalHeatmapDataUrl: extractImg(regionalDetails.visualization_data_url),
  };

  const keyObservations = Array.isArray(synthesis.key_observations)
    ? synthesis.key_observations.map((item) => {
        const obj = toRecord(item);
        const title = typeof obj.title === 'string' ? obj.title : '';
        const description = typeof obj.description === 'string' ? obj.description : '';
        return [title, description].filter(Boolean).join(': ');
      }).filter(Boolean)
    : [];

  const assessmentSummary =
    typeof assessment.summary === 'string'
      ? assessment.summary
      : typeof evidenceSummary.synthesis_statement === 'string'
        ? evidenceSummary.synthesis_statement
        : '';

  const limitations = [
    ...asStringArray(assessment.limitations),
    ...asStringArray(synthesis.limitations),
  ];

  const summaryObservations = [
    assessmentSummary,
    ...asStringArray(evidenceSummary.synthesis_statement),
    ...keyObservations,
    ...domains.flatMap((domain) => domain.observations),
  ].filter(Boolean);

  const recommendedManualChecks = [
    'Verify the image against its original source or camera RAW file if available.',
    'Inspect regions marked for review at high magnification.',
    'Corroborate forensic observations with provenance and independent evidence.',
  ];

  const imagePropertiesSummary = [
    properties.filename,
    properties.format,
    properties.width && properties.height
      ? `${properties.width} × ${properties.height} pixels`
      : '',
    properties.size_readable,
  ].filter((value) => typeof value === 'string' && value.length > 0).join(' | ');

  const sha256 = typeof raw.sha256 === 'string' ? raw.sha256 : '';

  return {
    analysisId: generateId('ANL'),
    analyzedAt: new Date().toISOString(),
    isDemoData: false,
    engineVersion: 'TruthLens FastAPI Backend',
    source: 'backend_api',
    completionStatus: independentDomainsAvailable > 0 ? 'Completed' : 'Partial',
    independentDomainsAvailable,
    regionsRequiringReview,
    evidenceStrengthDescriptor:
      typeof evidenceSummary.relationship === 'string'
        ? evidenceSummary.relationship.replace(/_/g, ' ')
        : 'Heuristic forensic indicators available — human review required',
    summaryObservations: summaryObservations.length
      ? [
          ...(imagePropertiesSummary ? [`Image: ${imagePropertiesSummary}`] : []),
          ...(sha256 ? [`SHA-256: ${sha256}`] : []),
          ...summaryObservations,
        ]
      : ['Backend returned forensic results. Review each domain and its limitations.'],
    limitations: limitations.length
      ? limitations
      : [
          'Heuristic forensic analysis cannot independently establish authenticity or manipulation.',
          'Spatial consistency is a supporting observation, not an independent evidence domain.',
        ],
    recommendedManualChecks,
    alternativeExplanations: [
      'Routine platform recompression or image resizing.',
      'Camera HDR, computational photography, sharpening, or denoising.',
      'Natural scene lighting, edges, or texture differences.',
    ],
    sanitizedMetadata: metadataValues,
    gpsStrippedNotice: gpsRemoved,
    domains,
    regions,
    frequencyProfile,
    visualizations,
    rawResponse: raw,
  };
}
