import { REGION_IDS, VISUAL_ASSETS } from '../constants/assets';
import {
  ActivityFeedItem,
  EvidenceItem,
  ImageForensicResult,
  Investigation,
  RegionObservation,
} from '../types/forensics';

const DEMO_REGIONS: RegionObservation[] = REGION_IDS.map((regionId, idx) => {
  const row = Math.floor(idx / 4);
  const col = idx % 4;
  if (regionId === 'r1_c2') {
    return {
      regionId,
      row,
      col,
      flagged: true,
      reviewLevel: 'Requires Review',
      deviationIndex: 2.84,
      neighborContrast: 1.92,
      signals: ['Compression & Recompression', 'Noise & Texture'],
      observations: [
        'Localized compression residual exceeds adjacent tiles r1_c1 and r1_c3 along the illuminated overhead signage boundary.',
        'High-frequency sensor grain variance drops slightly relative to surrounding concrete pillars.',
      ],
      limitations: [
        'Strong LED signage luminance contrast and JPEG chroma subsampling can trigger elevated ELA residuals without image alteration.',
        'Requires zoomed visual inspection of perspective lines and ambient reflection continuity.',
      ],
    };
  }
  if (regionId === 'r2_c1') {
    return {
      regionId,
      row,
      col,
      flagged: true,
      reviewLevel: 'Requires Review',
      deviationIndex: 2.31,
      neighborContrast: 1.65,
      signals: ['Noise & Texture', 'Frequency Spectrum'],
      observations: [
        'Elevated mid-band frequency anisotropy observed near tram transit vehicle door frame.',
        'Noise residual variance deviates from wet pavement surface texture in r3_c1.',
      ],
      limitations: [
        'Motion blur on moving transit subjects and reflective glass panes naturally alter local spectral profiles.',
      ],
    };
  }
  if (regionId === 'r2_c2') {
    return {
      regionId,
      row,
      col,
      flagged: false,
      reviewLevel: 'Elevated',
      deviationIndex: 1.62,
      neighborContrast: 1.18,
      signals: ['Compression & Recompression'],
      observations: [
        'Moderate edge residual around high-contrast pedestrian silhouettes and station stanchion.',
      ],
      limitations: [
        'Within normal variance for compressed documentary street photography.',
      ],
    };
  }
  return {
    regionId,
    row,
    col,
    flagged: false,
    reviewLevel: 'Nominal',
    deviationIndex: Number((0.25 + ((idx * 17) % 10) * 0.09).toFixed(2)),
    neighborContrast: Number((0.18 + ((idx * 13) % 8) * 0.08).toFixed(2)),
    signals: [],
    observations: ['No notable statistical deviation relative to neighboring image regions.'],
    limitations: ['Nominal regional metrics do not rule out global re-encoding or unflagged edits.'],
  };
});

export const DEMO_IMAGE_ANALYSIS_RESULT: ImageForensicResult = {
  analysisId: 'DEMO-ANL-2026-041',
  analyzedAt: '2026-11-18T14:22:10.000Z',
  isDemoData: true,
  engineVersion: 'Demo Fixture (Sample Schema Preview)',
  source: 'demo_fixture',
  completionStatus: 'Completed',
  independentDomainsAvailable: 4,
  regionsRequiringReview: 2,
  evidenceStrengthDescriptor:
    'Sample Demo Fixture — Multiple localized indicators require human review (not a real backend analysis)',
  summaryObservations: [
    'EXIF software field indicates secondary export via desktop editing suite; original camera make/model tags are absent.',
    'Two 4×4 spatial regions (r1_c2, r2_c1) exhibit elevated compression and noise contrast relative to immediate neighbors.',
    'Mid-frequency FFT radial energy shows mild periodic attenuation consistent with bicubic resampling or platform recompression.',
  ],
  limitations: [
    'DEMO DATA — This sample output is provided solely to demonstrate TruthLens inspection workflows while disconnected from the backend.',
    'Heuristic forensic indicators are not calibrated probabilities and cannot establish authenticity or manipulation alone.',
    'Spatial Consistency aggregates contrast across other domains and is NOT counted as an independent evidence domain.',
  ],
  recommendedManualChecks: [
    'Inspect region r1_c2 (overhead transit display) at 200% zoom for typographic alignment, halation, and ambient color spill.',
    'Verify tram route signage and evening timestamp against independent municipal transit logs.',
    'Request original uncropped camera file (RAW/DNG or original JPEG) from the submitting source.',
  ],
  alternativeExplanations: [
    'Image may have been color-graded, cropped, and re-exported by a photojournalist prior to publication.',
    'High-contrast LED boards and wet pavement reflections naturally create localized noise and compression discontinuities.',
  ],
  sanitizedMetadata: {
    Format: 'JPEG (JFIF 1.01)',
    Dimensions: '1200 × 896 px (1.08 MP)',
    ColorSpace: 'sRGB IEC61966-2.1',
    ChromaSubsampling: '4:2:0',
    SoftwareTag: 'Image Export Pipeline (Stripped EXIF Camera Model)',
    ICCProfile: 'Present (Standard sRGB)',
    GPSMetadata: 'Redacted / Not Displayed',
  },
  gpsStrippedNotice: true,
  domains: [
    {
      domainKey: 'metadata',
      title: 'Metadata & Provenance',
      isIndependentDomain: true,
      status: 'Available',
      indicatorCount: 2,
      summary:
        'Camera capture EXIF fields are missing while generic export software markers remain present.',
      observations: [
        'Primary camera Make, Model, ExposureTime, and DateTimeOriginal tags are absent.',
        'File contains standard sRGB ICC profile and 4:2:0 chroma subsampling typical of web export.',
      ],
      technicalValues: {
        Format: 'JPEG',
        ChromaSubsampling: '4:2:0',
        ExifCameraTags: 'Absent',
        QuantizationTables: '2 tables (Est. Q ~86)',
      },
      limitations: [
        'Messaging apps, CMS platforms, and routine privacy scrubbing remove camera EXIF tags automatically.',
      ],
    },
    {
      domainKey: 'compression',
      title: 'Compression & Recompression',
      isIndependentDomain: true,
      status: 'Available',
      indicatorCount: 2,
      summary:
        'Non-uniform error level residuals observed in region r1_c2 compared to adjacent concrete canopy surfaces.',
      observations: [
        'Mean luminance ELA residual elevated by 1.92× in r1_c2 relative to neighboring structural tiles.',
        'Estimated JPEG quantization signature suggests at least one recompression cycle.',
      ],
      technicalValues: {
        GlobalElaMean: 6.42,
        MaxRegionalEla: 14.85,
        PeakRegion: 'r1_c2',
        EstimatedQuality: 'Q84–Q88',
      },
      limitations: [
        'ELA cannot distinguish between intentional splicing and localized contrast adjustments or glowing signage.',
      ],
    },
    {
      domainKey: 'noise',
      title: 'Noise & Texture',
      isIndependentDomain: true,
      status: 'Available',
      indicatorCount: 2,
      summary:
        'Subtle sensor-noise variance drop detected across signage overlay zone relative to low-light shadows.',
      observations: [
        'High-pass noise residual standard deviation in r1_c2 is 22% lower than shadow regions with comparable luminance.',
        'Anisotropic micro-texture shift observed in r2_c1 near moving transit carriage.',
      ],
      technicalValues: {
        GlobalNoiseStd: 3.18,
        MinRegionStd: 2.14,
        MaxRegionStd: 4.41,
        VarianceSpread: 'Moderate',
      },
      limitations: [
        'In-camera noise reduction and optical depth-of-field blur naturally vary noise density across focal planes.',
      ],
    },
    {
      domainKey: 'frequency',
      title: 'Frequency Spectrum',
      isIndependentDomain: true,
      status: 'Available',
      indicatorCount: 1,
      summary:
        'High-frequency roll-off consistent with downscaling; mild periodic harmonic peak in mid-band spectrum.',
      observations: [
        'Radial 2D FFT energy attenuates sharply above 0.72 Nyquist frequency, consistent with resizing.',
        'Mild directional energy concentration in r2_c1 aligns with horizontal architectural glazing.',
      ],
      technicalValues: {
        HighFreqRatio: 0.148,
        NyquistRollOff: '0.72 cycles/px',
        PeriodicPeaks: 'Mild (2 bands)',
      },
      limitations: [
        'Architectural grids, brick/pavement geometry, and standard image resizing create strong periodic FFT components.',
      ],
    },
    {
      domainKey: 'spatial',
      title: 'Spatial Consistency (Supporting Observation)',
      isIndependentDomain: false,
      status: 'Available',
      indicatorCount: 2,
      summary:
        '2 of 16 regions (r1_c2, r2_c1) exceed neighbor-contrast review thresholds across overlapping signals.',
      observations: [
        'Region r1_c2 exhibits concurrent compression and noise deviation against neighboring tiles.',
        'Region r2_c1 shows elevated texture/frequency contrast requiring manual contextual verification.',
      ],
      technicalValues: {
        GridGeometry: '4 × 4 (16 regions)',
        FlaggedRegions: 'r1_c2, r2_c1',
        IndependentDomain: false,
      },
      limitations: [
        'Spatial Consistency is a supporting regional localization view derived from the same image signals; it does NOT count as independent corroboration.',
      ],
    },
  ],
  regions: DEMO_REGIONS,
  frequencyProfile: [
    { band: '0.10', magnitude: 88, referenceBaseline: 85 },
    { band: '0.20', magnitude: 74, referenceBaseline: 72 },
    { band: '0.30', magnitude: 61, referenceBaseline: 60 },
    { band: '0.40', magnitude: 53, referenceBaseline: 49 },
    { band: '0.50', magnitude: 48, referenceBaseline: 39 },
    { band: '0.60', magnitude: 36, referenceBaseline: 31 },
    { band: '0.70', magnitude: 24, referenceBaseline: 24 },
    { band: '0.80', magnitude: 13, referenceBaseline: 19 },
    { band: '0.90', magnitude: 8, referenceBaseline: 15 },
    { band: '1.00', magnitude: 5, referenceBaseline: 12 },
  ],
  modelStatus: {
    available: false,
    status: 'unavailable',
    message: 'AI detection model unavailable — traditional forensic analysis is still active.',
  },
  visualizations: {
    elaDataUrl: null,
    noiseDataUrl: null,
    frequencyDataUrl: null,
    regionalHeatmapDataUrl: null,
  },
};

export const DEMO_INVESTIGATIONS: Investigation[] = [
  {
    id: 'DEMO-INV-2026-01',
    caseReference: 'CASE-DEMO-2026-014',
    title: 'Central Transit Plaza Evening Press Photograph Review',
    description:
      'Sample demonstration case illustrating multimodal forensic intake: verifying a circulated evening transit plaza photograph alongside accompanying social caption claims and witness audio statement.',
    category: 'Media Verification',
    investigator: 'Demo Analyst Workspace',
    status: 'In Review',
    selectedModules: ['Image Forensics', 'Text & Context', 'Cross-Modal Analysis'],
    contextualNotes:
      'Circulated online claiming disruption at Platform 7 at 17:48 local time. Original source file not yet obtained.',
    createdAt: '2026-11-18T11:05:00.000Z',
    updatedAt: '2026-11-18T14:30:00.000Z',
    evidenceIds: ['DEMO-EV-001', 'DEMO-EV-002', 'DEMO-EV-003'],
    reportGeneratedAt: '2026-11-18T14:35:00.000Z',
    isDemoData: true,
  },
  {
    id: 'DEMO-INV-2026-02',
    caseReference: 'CASE-DEMO-2026-019',
    title: 'Municipal Press Briefing Clip — Subtitle & OCR Consistency Check',
    description:
      'Sample case demonstrating planned video frame inspection, OCR text timeline comparison, and contextual statement review.',
    category: 'Disinformation Review',
    investigator: 'Demo Verification Team',
    status: 'Active',
    selectedModules: ['Video Forensics', 'Audio Forensics', 'Text & Context'],
    contextualNotes:
      'Comparing two re-uploaded clips where lower-third chyrons differ in reported dates.',
    createdAt: '2026-11-17T09:15:00.000Z',
    updatedAt: '2026-11-18T10:12:00.000Z',
    evidenceIds: ['DEMO-EV-004'],
    reportGeneratedAt: null,
    isDemoData: true,
  },
];

export const DEMO_EVIDENCE: EvidenceItem[] = [
  {
    id: 'DEMO-EV-001',
    investigationId: 'DEMO-INV-2026-01',
    fileName: 'transit_plaza_dusk_press_copy.jpg',
    mediaType: 'image',
    mimeType: 'image/jpeg',
    fileSizeBytes: 1_482_910,
    uploadedAt: '2026-11-18T11:10:00.000Z',
    sha256: '4f8d2c9a71b30e5d9a1c4b22e8071f6a3c9e54b1d2089a7f3e6c1d4b8a2f9e01',
    hashOrigin: 'local_sha256',
    dimensions: { width: 1200, height: 896, megapixels: 1.08 },
    previewUrl: VISUAL_ASSETS.demoEvidenceScene,
    analysisStatus: 'Requires Review',
    analysisResult: DEMO_IMAGE_ANALYSIS_RESULT,
    sourceContext: 'Downloaded from public social media repost (secondary copy).',
    isDemoData: true,
    notes: [
      {
        id: 'DEMO-NOTE-1',
        author: 'Demo Analyst',
        createdAt: '2026-11-18T14:28:00.000Z',
        category: 'Manual Check',
        content:
          'Region r1_c2 coincides with high-luminance LED departure board. Need to compare against unedited station photograph to assess whether ELA contrast is purely lighting-driven.',
      },
    ],
    custodyLog: [
      {
        id: 'DEMO-COC-1',
        timestamp: '2026-11-18T11:10:00.000Z',
        action: 'Evidence registered in demo session',
        actor: 'Demo Analyst',
        origin: 'demo_fixture',
        details: 'Sample fixture loaded for workflow demonstration. Original file unaltered.',
      },
      {
        id: 'DEMO-COC-2',
        timestamp: '2026-11-18T11:10:01.000Z',
        action: 'SHA-256 digest recorded (demo fixture)',
        actor: 'Client Integrity Utility',
        origin: 'demo_fixture',
        details: '4f8d2c9a71b30e5d...a2f9e01',
      },
      {
        id: 'DEMO-COC-3',
        timestamp: '2026-11-18T14:22:10.000Z',
        action: 'Sample image analysis fixture attached',
        actor: 'Demo Mode',
        origin: 'demo_fixture',
        details: '4 independent domains + 16-region spatial grid populated from demo fixture.',
      },
    ],
  },
  {
    id: 'DEMO-EV-002',
    investigationId: 'DEMO-INV-2026-01',
    fileName: 'social_post_caption_and_transcript.txt',
    mediaType: 'text',
    mimeType: 'text/plain',
    fileSizeBytes: 2_140,
    uploadedAt: '2026-11-18T11:24:00.000Z',
    sha256: '9c11a84e7d2b60f19a3e5c78b4d021f6e3a90c18d7b54e2a1f8c30b9d6e4a120',
    hashOrigin: 'local_sha256',
    textContent:
      'Post A (18:05 UTC): "Service on Tram Line 7 halted indefinitely at North Transit Plaza at 17:48 due to structural power outage. Platform completely evacuated."\n\nOfficial Transit Log B (18:12 UTC): "Tram Line 7 experienced a 9-minute signal delay at Central Transit Plaza between 17:46 and 17:55. Normal boarding continued throughout; no evacuation occurred."',
    analysisStatus: 'Requires Review',
    sourceContext: 'Archived text comparison between viral post and municipal service bulletin.',
    isDemoData: true,
    notes: [
      {
        id: 'DEMO-NOTE-2',
        author: 'Demo Analyst',
        createdAt: '2026-11-18T12:00:00.000Z',
        category: 'Context',
        content:
          'Notable discrepancy in station name ("North Transit Plaza" vs "Central Transit Plaza") and claim of evacuation vs visible pedestrians in DEMO-EV-001.',
      },
    ],
    custodyLog: [
      {
        id: 'DEMO-COC-4',
        timestamp: '2026-11-18T11:24:00.000Z',
        action: 'Text evidence added (demo fixture)',
        actor: 'Demo Analyst',
        origin: 'demo_fixture',
        details: 'Captured text excerpts for contextual comparison.',
      },
    ],
  },
  {
    id: 'DEMO-EV-003',
    investigationId: 'DEMO-INV-2026-01',
    fileName: 'witness_voicenote_excerpt.wav',
    mediaType: 'audio',
    mimeType: 'audio/wav',
    fileSizeBytes: 3_840_000,
    uploadedAt: '2026-11-18T11:45:00.000Z',
    sha256: '7a2f19e8c3d4b5018e9f6a2c4b7d10e3f5a8c2d9b6e14f7a3c0d8b5e2a9f4c11',
    hashOrigin: 'local_sha256',
    durationSeconds: 38.4,
    sampleRate: 44100,
    channels: 1,
    analysisStatus: 'Engine Unavailable',
    sourceContext: 'DEMO catalog record — Audio Forensics module is currently under development.',
    isDemoData: true,
    notes: [],
    custodyLog: [
      {
        id: 'DEMO-COC-5',
        timestamp: '2026-11-18T11:45:00.000Z',
        action: 'Audio record catalogued (demo fixture)',
        actor: 'Demo Analyst',
        origin: 'demo_fixture',
        details: 'Awaiting future audio forensic engine integration.',
      },
    ],
  },
  {
    id: 'DEMO-EV-004',
    investigationId: 'DEMO-INV-2026-02',
    fileName: 'briefing_reupload_clip_720p.mp4',
    mediaType: 'video',
    mimeType: 'video/mp4',
    fileSizeBytes: 12_450_000,
    uploadedAt: '2026-11-17T09:30:00.000Z',
    sha256: '1e8b4d7c2a9f03e56d1c8b4a7f2e90d3c5b1a8e4f7d20c9a6b3e1f8d4c2a7e55',
    hashOrigin: 'local_sha256',
    durationSeconds: 42.0,
    dimensions: { width: 1280, height: 720, megapixels: 0.92 },
    analysisStatus: 'Engine Unavailable',
    sourceContext: 'DEMO catalog record — Video Forensics module is currently under development.',
    isDemoData: true,
    notes: [],
    custodyLog: [
      {
        id: 'DEMO-COC-6',
        timestamp: '2026-11-17T09:30:00.000Z',
        action: 'Video file registered (demo fixture)',
        actor: 'Demo Verification Team',
        origin: 'demo_fixture',
        details: 'Prepared for manual frame stepping and future backend OCR pipeline.',
      },
    ],
  },
];

export const DEMO_ACTIVITY_FEED: ActivityFeedItem[] = [
  {
    id: 'DEMO-ACT-1',
    timestamp: '2026-11-18T14:35:00.000Z',
    type: 'report_generated',
    title: 'Forensic report draft prepared',
    detail: 'Central Transit Plaza Evening Press Photograph Review (Demo Fixture)',
    investigationId: 'DEMO-INV-2026-01',
    isDemoData: true,
  },
  {
    id: 'DEMO-ACT-2',
    timestamp: '2026-11-18T14:28:00.000Z',
    type: 'human_review_added',
    title: 'Investigator review note logged',
    detail: 'Region r1_c2 flagged for manual inspection of LED signage contrast.',
    investigationId: 'DEMO-INV-2026-01',
    evidenceId: 'DEMO-EV-001',
    isDemoData: true,
  },
  {
    id: 'DEMO-ACT-3',
    timestamp: '2026-11-18T14:22:10.000Z',
    type: 'analysis_completed',
    title: 'Image analysis fixture loaded',
    detail: 'transit_plaza_dusk_press_copy.jpg — 4 independent domains, 2 regions for review.',
    investigationId: 'DEMO-INV-2026-01',
    evidenceId: 'DEMO-EV-001',
    isDemoData: true,
  },
  {
    id: 'DEMO-ACT-4',
    timestamp: '2026-11-18T11:10:00.000Z',
    type: 'evidence_uploaded',
    title: 'Evidence item registered',
    detail: 'transit_plaza_dusk_press_copy.jpg (1.41 MB, SHA-256 recorded)',
    investigationId: 'DEMO-INV-2026-01',
    evidenceId: 'DEMO-EV-001',
    isDemoData: true,
  },
];
