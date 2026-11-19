import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ShieldAlert } from 'lucide-react';
import { TRUTHLENS_DISCLAIMER } from '../constants/assets';
import { StatusLabel } from '../components/ui/ForensicPrimitives';
import { FORENSIC_EASE } from '../components/ui/MotionPrimitives';

interface MethodSection {
  id: string;
  title: string;
  domainType: 'Independent Domain' | 'Supporting Observation' | 'Planned Module';
  availability: 'Operational' | 'Under Development' | 'Not Yet Available';
  examines: string[];
  explanation: string;
  limitations: string[];
}

const METHODS: MethodSection[] = [
  {
    id: 'metadata',
    title: '01. Metadata & Provenance Analysis',
    domainType: 'Independent Domain',
    availability: 'Operational',
    explanation:
      'Inspects embedded container headers, EXIF structures, software tags, color profiles, and declared image dimensions to identify capture context and export history. Sensitive GPS coordinates are withheld in the UI.',
    examines: [
      'EXIF camera make, model, capture parameters, and timestamp fields (when present)',
      'Software and encoding pipeline tags (e.g., export libraries or desktop editors)',
      'Image dimensions, aspect ratio, color space, and chroma subsampling',
      'Available structural provenance indicators',
    ],
    limitations: [
      'Metadata is routinely stripped automatically by messaging apps, social networks, and web CMS pipelines.',
      'Metadata fields can be deliberately modified or forged using standard tools.',
      'Missing or altered metadata does not prove pixel-level manipulation.',
    ],
  },
  {
    id: 'ela',
    title: '02. Error Level Analysis (Compression & Recompression)',
    domainType: 'Independent Domain',
    availability: 'Operational',
    explanation:
      'Re-saves JPEG imagery at a controlled reference quality and computes pixel-wise absolute compression error residuals. Regions with differing prior compression histories may exhibit distinct error levels.',
    examines: [
      'JPEG recompression error distribution across image blocks',
      'Local error-level patterns relative to global image baseline',
      'Regional variance along object boundaries and inserted graphics',
    ],
    limitations: [
      'ELA is NOT a definitive manipulation detector and performs unreliably on PNG/lossless or heavily recompressed files.',
      'Prior save history, quality factors, and double-compression strongly influence residual magnitude.',
      'High-contrast edges, glowing signage, and fine textures naturally show elevated residuals.',
    ],
  },
  {
    id: 'noise',
    title: '03. Noise & Texture Residual Analysis',
    domainType: 'Independent Domain',
    availability: 'Operational',
    explanation:
      'Isolates high-frequency spatial residuals from underlying scene content to examine camera sensor noise consistency and localized micro-texture transitions.',
    examines: [
      'High-pass image noise residuals',
      'Local surface texture statistics across shadowed and lit regions',
      'Regional standard-deviation shifts between neighboring areas',
    ],
    limitations: [
      'Different camera sensors, ISO levels, and computational photography pipelines generate distinct noise profiles.',
      'In-camera denoising, optical bokeh/depth-of-field, and social compression alter noise naturally.',
      'Regional noise variation can be completely authentic in mixed-lighting scenes.',
    ],
  },
  {
    id: 'frequency',
    title: '04. Frequency Spectrum Analysis (2D FFT)',
    domainType: 'Independent Domain',
    availability: 'Operational',
    explanation:
      'Transforms spatial pixel intensities into the frequency domain via 2D Fast Fourier Transform (FFT) to inspect spectral roll-off, periodic grid artifacts, and high-frequency attenuation.',
    examines: [
      '2D frequency-domain magnitude spectrum',
      'Periodic harmonic peaks potentially linked to resampling or generative upsampling',
      'High-frequency roll-off relative to Nyquist limits',
    ],
    limitations: [
      'Routine resizing, sharpening filters, and JPEG compression introduce strong spectral signatures.',
      'Camera demosaicing and repeating architectural patterns (bricks, blinds, grids) create legitimate periodic peaks.',
    ],
  },
  {
    id: 'regional',
    title: '05. Regional Analysis (4×4 Spatial Consistency)',
    domainType: 'Supporting Observation',
    availability: 'Operational',
    explanation:
      'Partitions the image into a standardized 4×4 grid (r0_c0 through r3_c3) to localize statistical deviations and neighbor-to-neighbor contrast across underlying signal metrics.',
    examines: [
      'Tile-level feature deviation relative to global image statistics',
      'Contrast between each cell and its immediate horizontal/vertical neighbors',
      'Localization of areas warranting zoomed human visual inspection',
    ],
    limitations: [
      'Spatial Consistency is a supporting localization view and is NOT an independent evidence domain.',
      'Statistical deviation in a tile does not imply manipulation; sky, foliage, signage, and shadows naturally differ.',
    ],
  },
  {
    id: 'video',
    title: '06. Video Analysis (Under Development)',
    domainType: 'Planned Module',
    availability: 'Under Development',
    explanation:
      'Planned module to extend frame-level image forensics across temporal sequences, combining video frame analysis, temporal consistency checks, frame-level manipulation indicators, and video integrity examination.',
    examines: [
      'Video frame analysis and automated keyframe extraction',
      'Temporal consistency across consecutive frames',
      'Frame-level manipulation indicators and video integrity examination',
    ],
    limitations: [
      'Video Forensics is currently under development; video upload and analysis actions are disabled until the backend engine is implemented.',
      'Re-encoding, variable frame rates, motion blur, and compression artifacts will require careful human interpretation once deployed.',
    ],
  },
  {
    id: 'audio',
    title: '07. Audio Analysis (Under Development)',
    domainType: 'Planned Module',
    availability: 'Under Development',
    explanation:
      'Planned acoustic forensics workflow for audio integrity analysis, synthetic speech indicators, waveform examination, and audio manipulation analysis.',
    examines: [
      'Audio integrity analysis and container metadata verification',
      'Waveform examination and time-frequency continuity checks',
      'Synthetic speech indicators and audio manipulation analysis',
    ],
    limitations: [
      'Audio Forensics is currently under development; audio uploads and automated analysis are disabled until the acoustic backend is implemented.',
      'VoIP codecs, mobile noise gates, and microphone clipping create benign spectral discontinuities.',
    ],
  },
  {
    id: 'crossmodal',
    title: '08. Cross-Modal Analysis (Not Yet Available)',
    domainType: 'Planned Module',
    availability: 'Not Yet Available',
    explanation:
      'Planned cross-modal verification engine designed to compare consistency across visual, audio, video, and contextual evidence without conflating single-file signals.',
    examines: [
      'Shared timeline anchors and contextual consistency across visual, audio, video, and text records',
      'Contextual contradictions between visual evidence and accompanying text claims',
      'Strict separation between independent corroborating signals and correlated single-file features',
    ],
    limitations: [
      'Cross-Modal Analysis is not yet available; automated correlation scoring and multi-modality verification are disabled until supporting engines are implemented.',
      'Correlated indicators derived from the same underlying media signal must never be treated as independent confirmation.',
    ],
  },
];

export const MethodologyPage: React.FC = () => {
  const [openIds, setOpenIds] = useState<string[]>(['metadata', 'ela', 'regional']);

  const toggle = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
          Methodology &amp; Limitations
        </h1>
        <p className="text-sm text-tl-muted mt-1">
          Transparent scientific documentation of how TruthLens extracts forensic indicators, separates independent evidence domains, and avoids false certainty.
        </p>
      </div>

      {/* Scientific Architecture Diagram */}
      <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-tl-text">
            Evidence Synthesis Architecture — Independent Signals vs. Supporting Spatial Views
          </h2>
          <span className="font-mono text-[11px] text-tl-cyan">
            No Automated Authenticity Verdicts
          </span>
        </div>

        <div className="bg-[#0B0C0E] rounded-md border border-tl-border p-4 overflow-x-auto">
          <svg viewBox="0 0 820 190" className="w-full min-w-[640px] h-44" role="img" aria-label="TruthLens evidence synthesis diagram">
            {/* Independent Domains Column */}
            {[
              { y: 12, label: 'Metadata & Provenance', sub: 'Independent Domain 1' },
              { y: 56, label: 'Compression / ELA', sub: 'Independent Domain 2' },
              { y: 100, label: 'Noise & Texture', sub: 'Independent Domain 3' },
              { y: 144, label: 'Frequency / 2D FFT', sub: 'Independent Domain 4' },
            ].map((d) => (
              <g key={d.label}>
                <rect x="14" y={d.y} width="205" height="34" rx="4" fill="#16181C" stroke="#54BDC9" strokeWidth="1" />
                <text x="26" y={d.y + 15} fill="#F1F2F4" fontSize="10.5" fontWeight="600">{d.label}</text>
                <text x="26" y={d.y + 27} fill="#8BB4D9" fontSize="8.5" fontFamily="IBM Plex Mono, monospace">{d.sub}</text>
                <line x1="219" y1={d.y + 17} x2="296" y2="95" stroke="#54BDC9" strokeOpacity="0.6" strokeWidth="1.25" className="animate-svg-flow" />
              </g>
            ))}

            {/* Supporting Spatial Consistency Box */}
            <rect x="296" y="42" width="210" height="106" rx="5" fill="#1E2127" stroke="#E5AA46" strokeDasharray="4 3" strokeWidth="1.2" />
            <text x="401" y="68" textAnchor="middle" fill="#E5AA46" fontSize="9.5" fontFamily="IBM Plex Mono, monospace">
              SUPPORTING OBSERVATION
            </text>
            <text x="401" y="88" textAnchor="middle" fill="#F1F2F4" fontSize="11.5" fontWeight="600">
              4×4 Spatial Consistency
            </text>
            <text x="401" y="106" textAnchor="middle" fill="#8E94A0" fontSize="9.5">
              r0_c0 .. r3_c3 neighbor contrast
            </text>
            <text x="401" y="126" textAnchor="middle" fill="#E5AA46" fontSize="9">
              (Not an independent domain)
            </text>

            <line x1="506" y1="95" x2="574" y2="95" stroke="#6BC99A" strokeWidth="1.5" className="animate-svg-flow" />

            {/* Human Review & Report */}
            <rect x="574" y="48" width="230" height="94" rx="5" fill="#16181C" stroke="#6BC99A" strokeWidth="1.2" />
            <text x="689" y="74" textAnchor="middle" fill="#6BC99A" fontSize="9.5" fontFamily="IBM Plex Mono, monospace">
              INVESTIGATOR WORKFLOW
            </text>
            <text x="689" y="94" textAnchor="middle" fill="#F1F2F4" fontSize="11.5" fontWeight="600">
              Human Review &amp; Report
            </text>
            <text x="689" y="114" textAnchor="middle" fill="#8E94A0" fontSize="9.5">
              Observations + Limitations + Context
            </text>
          </svg>
        </div>

        <div className="rounded border border-tl-caution/40 bg-tl-caution/10 p-3.5 flex items-start gap-2.5 text-xs">
          <ShieldAlert className="w-4 h-4 text-tl-caution shrink-0 mt-0.5" />
          <p className="text-tl-text leading-relaxed">{TRUTHLENS_DISCLAIMER}</p>
        </div>
      </section>

      {/* Collapsible Forensic Modules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-tl-text">
            Forensic Modules &amp; Known Failure Modes
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setOpenIds(METHODS.map((m) => m.id))}
              className="text-tl-cyan hover:underline"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => setOpenIds([])}
              className="text-tl-muted hover:text-tl-text"
            >
              Collapse All
            </button>
          </div>
        </div>

        {METHODS.map((m) => {
          const isOpen = openIds.includes(m.id);
          return (
            <section
              key={m.id}
              className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-expanded={isOpen}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-tl-elevated/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="font-display text-sm font-semibold text-tl-text">
                    {m.title}
                  </span>
                  <span className="text-xs text-tl-muted">·</span>
                  <span className="font-mono text-[11px] text-tl-ice">{m.domainType}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusLabel status={m.availability} />
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: FORENSIC_EASE }}
                    className="inline-flex text-tl-muted"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: FORENSIC_EASE }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-2 border-t border-tl-border/70 space-y-4 text-xs">
                      <p className="text-tl-text leading-relaxed">{m.explanation}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded border border-tl-border bg-tl-bg-secondary p-3.5 space-y-1.5">
                          <h3 className="font-semibold text-tl-cyan">What It Examines</h3>
                          <ul className="list-disc pl-4 space-y-1 text-tl-text/90 leading-relaxed">
                            {m.examines.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded border border-tl-border bg-tl-bg-secondary p-3.5 space-y-1.5">
                          <h3 className="font-semibold text-tl-caution">Limitations &amp; Caveats</h3>
                          <ul className="list-disc pl-4 space-y-1 text-tl-muted leading-relaxed">
                            {m.limitations.map((l, i) => (
                              <li key={i}>{l}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </div>
  );
};
