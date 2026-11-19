import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  AudioWaveform,
  FileText,
  Film,
  Image as ImageIcon,
  Lock,
  Network,
} from 'lucide-react';
import { StatusLabel } from '../components/ui/ForensicPrimitives';

const MODALITY_DEPENDENCY_MATRIX = [
  {
    modality: 'Visual Evidence (Image Forensics)',
    status: 'Operational' as const,
    role: 'EXIF provenance, Error Level Analysis, noise variance, 2D FFT, and regional metrics.',
    icon: ImageIcon,
    route: '/image-forensics',
  },
  {
    modality: 'Video Evidence (Video Forensics)',
    status: 'Under Development' as const,
    role: 'Frame-level inspection, temporal consistency, and container integrity signals.',
    icon: Film,
    route: '/video-forensics',
  },
  {
    modality: 'Audio Evidence (Audio Forensics)',
    status: 'Under Development' as const,
    role: 'Acoustic integrity, waveform continuity, and synthetic speech indicators.',
    icon: AudioWaveform,
    route: '/audio-forensics',
  },
  {
    modality: 'Contextual & Documentary Records',
    status: 'Local Tool' as const,
    role: 'Investigator-logged claims, timeline references, and statement comparison notes.',
    icon: FileText,
    route: '/text-analysis',
  },
];

export const CrossModalPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-tl-border pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
              Cross-Modal Analysis
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-tl-border bg-tl-panel">
              <StatusLabel status="Not Yet Available" />
            </span>
          </div>
          <p className="text-sm text-tl-muted leading-relaxed">
            Cross-modal verification will compare consistency between visual, audio, video, and
            contextual evidence once all underlying modality engines are operational.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Cross-modal correlation requires Video and Audio forensic engines to be operational"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-tl-muted text-xs font-medium opacity-55 cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Run Cross-Modal Correlation</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 columns: Restrained Architectural Empty State */}
        <div className="xl:col-span-7 space-y-5">
          <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
            <div className="px-4 py-2.5 border-b border-tl-border bg-tl-bg-secondary/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-tl-text">
                <Network className="w-4 h-4 text-tl-muted" />
                <span>Multimodal Consistency Engine</span>
              </div>
              <span className="font-mono text-[11px] text-tl-muted">Status: Not Yet Available</span>
            </div>

            <div className="p-8 sm:p-10 bg-[#07080A] flex flex-col items-center justify-center text-center space-y-4">
              {/* Quiet Architectural Schematic (No fabricated scores or fake findings) */}
              <svg
                viewBox="0 0 360 120"
                className="w-full max-w-sm h-28 text-tl-muted"
                aria-hidden="true"
              >
                <line x1="60" y1="30" x2="180" y2="60" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
                <line x1="300" y1="30" x2="180" y2="60" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
                <line x1="60" y1="90" x2="180" y2="60" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
                <line x1="300" y1="90" x2="180" y2="60" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />

                <rect x="132" y="44" width="96" height="32" rx="4" fill="#16181C" stroke="#282C34" strokeWidth="1" />
                <text x="180" y="64" textAnchor="middle" fill="#9BA3AF" fontSize="9.5" fontFamily="IBM Plex Mono, monospace">
                  CROSS-MODAL
                </text>

                <rect x="14" y="18" width="76" height="24" rx="4" fill="#16181C" stroke="#3FA876" strokeOpacity="0.65" strokeWidth="1" />
                <text x="52" y="33" textAnchor="middle" fill="#D5DBE5" fontSize="9" fontFamily="IBM Plex Mono, monospace">
                  VISUAL
                </text>

                <rect x="270" y="18" width="76" height="24" rx="4" fill="#16181C" stroke="#282C34" strokeWidth="1" />
                <text x="308" y="33" textAnchor="middle" fill="#8C95A6" fontSize="9" fontFamily="IBM Plex Mono, monospace">
                  VIDEO
                </text>

                <rect x="14" y="78" width="76" height="24" rx="4" fill="#16181C" stroke="#282C34" strokeWidth="1" />
                <text x="52" y="93" textAnchor="middle" fill="#8C95A6" fontSize="9" fontFamily="IBM Plex Mono, monospace">
                  AUDIO
                </text>

                <rect x="270" y="78" width="76" height="24" rx="4" fill="#16181C" stroke="#282C34" strokeWidth="1" />
                <text x="308" y="93" textAnchor="middle" fill="#8C95A6" fontSize="9" fontFamily="IBM Plex Mono, monospace">
                  CONTEXT
                </text>
              </svg>

              <div className="max-w-md space-y-2">
                <h2 className="font-display text-base font-semibold text-tl-text">
                  Cross-modal verification is not yet available
                </h2>
                <p className="text-xs text-tl-muted leading-relaxed">
                  No correlation scores, matching percentages, or confidence metrics are generated
                  while Video and Audio forensic pipelines remain under development.
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/image-forensics')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan hover:text-tl-cyan transition-colors"
                >
                  <span>Inspect Visual Evidence in Image Forensics</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* Planned Verification Scope */}
          <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-3 text-xs">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Planned Cross-Modal Verification Scope
            </h2>
            <p className="text-tl-muted leading-relaxed">
              When released, Cross-Modal Analysis will allow investigators to align independent
              forensic observations across modalities—comparing photographic metadata and visual
              observations against video timelines, audio recordings, and documentary context—to
              surface corroborating records or contradictions for human review.
            </p>
            <p className="text-tl-muted leading-relaxed">
              <strong className="text-tl-text font-medium">Signal independence safeguard:</strong>{' '}
              Multiple indicators extracted from a single file (such as compression residuals and
              noise variance from the same JPEG) will never be double-counted as independent
              cross-modal confirmation.
            </p>
          </section>
        </div>

        {/* Right 5 columns: Modality Readiness Dependencies */}
        <div className="xl:col-span-5 space-y-5">
          <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-tl-text">
                Modality Dependencies
              </h2>
              <span className="font-mono text-[11px] text-tl-muted">1 of 3 engines live</span>
            </div>

            <div className="space-y-2.5">
              {MODALITY_DEPENDENCY_MATRIX.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.modality}
                    type="button"
                    onClick={() => navigate(item.route)}
                    className="w-full text-left rounded-md border border-tl-border bg-tl-bg-secondary/60 hover:border-tl-border-strong p-3.5 transition-colors space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-tl-text">
                        <Icon className="w-3.5 h-3.5 text-tl-muted shrink-0" />
                        <span>{item.modality}</span>
                      </span>
                      <StatusLabel status={item.status} />
                    </div>
                    <p className="text-xs text-tl-muted leading-relaxed">{item.role}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
