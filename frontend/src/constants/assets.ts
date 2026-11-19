export const VISUAL_ASSETS = {
  heroLab: '/src/assets/images/hero_forensic_lab_1795097117152.jpg',
  imageForensics: '/src/assets/images/module_image_forensics_1795097123193.jpg',
  videoForensics: '/src/assets/images/module_video_forensics_1795097228916.jpg',
  audioForensics: '/src/assets/images/module_audio_forensics_1795097147743.jpg',
  demoEvidenceScene: '/src/assets/images/demo_evidence_scene_1795097116907.jpg',
} as const;

export const BACKEND_LIMITS = {
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
  MAX_FILE_SIZE_MB: 15,
  MAX_DIMENSION_PX: 12000,
  MAX_MEGAPIXELS: 40,
  MAX_AREA_PX: 40_000_000,
  SUPPORTED_IMAGE_MIME: ['image/jpeg', 'image/png', 'image/webp'] as const,
  SUPPORTED_IMAGE_LABELS: ['JPEG', 'PNG', 'WEBP'] as const,
};

export const REGION_IDS = [
  'r0_c0', 'r0_c1', 'r0_c2', 'r0_c3',
  'r1_c0', 'r1_c1', 'r1_c2', 'r1_c3',
  'r2_c0', 'r2_c1', 'r2_c2', 'r2_c3',
  'r3_c0', 'r3_c1', 'r3_c2', 'r3_c3',
] as const;

export const TRUTHLENS_DISCLAIMER =
  'TruthLens provides forensic indicators and analytical observations, not definitive proof of authenticity or manipulation. Results must be interpreted alongside contextual evidence and reviewed by a qualified human investigator.';
