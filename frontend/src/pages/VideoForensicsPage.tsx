import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Film,
  Layers,
  Lock,
  ScanSearch,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { VISUAL_ASSETS } from '../constants/assets';
import { SafeMediaImage, StatusLabel } from '../components/ui/ForensicPrimitives';

const PLANNED_VIDEO_CAPABILITIES = [
  {
    title: 'Video Frame Analysis',
    description:
      'Keyframe indexing, GOP structure inspection, and deterministic still-frame extraction for pixel-level examination.',
    icon: Layers,
  },
  {
    title: 'Temporal Consistency',
    description:
      'Inter-frame continuity auditing to surface abrupt cut boundaries, dropped frames, and irregular motion cadence.',
    icon: Clock,
  },
  {
    title: 'Frame-Level Manipulation Indicators',
    description:
      'Localized compression discrepancy mapping and spatial artifact screening across sequential frame windows.',
    icon: ScanSearch,
  },
  {
    title: 'Video Integrity Examination',
    description:
      'Container header verification, codec re-encoding provenance checks, and cryptographic SHA-256 stream hashing.',
    icon: ShieldCheck,
  },
];

export const VideoForensicsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-tl-border pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
              Video Forensics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-tl-border bg-tl-panel">
              <StatusLabel status="Under Development" />
            </span>
          </div>
          <p className="text-sm text-tl-muted leading-relaxed">
            Dedicated video examination workspace planned for video frame analysis, temporal
            consistency checks, frame-level manipulation indicators, and video integrity
            examination.
          </p>
        </div>

        {/* Disabled nonfunctional intake & analysis actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Video ingestion is disabled while the Video Forensics backend is under development"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-tl-muted text-xs font-medium opacity-55 cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Video</span>
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Automated video analysis is not yet available"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-bg-secondary text-tl-muted text-xs font-medium opacity-55 cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Run Video Analysis</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 columns: Restrained Empty Examination Stage */}
        <div className="xl:col-span-7 space-y-5">
          <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
            <div className="px-4 py-2.5 border-b border-tl-border bg-tl-bg-secondary/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-tl-text">
                <Film className="w-4 h-4 text-tl-muted" />
                <span>Frame &amp; Temporal Inspection Stage</span>
              </div>
              <span className="font-mono text-[11px] text-tl-muted">Engine: Under Development</span>
            </div>

            <div className="relative min-h-[290px] bg-[#07080A] flex items-center justify-center overflow-hidden">
              <SafeMediaImage
                src={VISUAL_ASSETS.videoForensics}
                alt="Video forensics timeline preview"
                className="absolute inset-0 w-full h-full object-cover opacity-18 grayscale"
              />
              <div className="relative z-10 max-w-md mx-auto px-6 py-10 text-center space-y-3">
                <div className="w-10 h-10 rounded-md border border-tl-border bg-tl-panel/90 mx-auto flex items-center justify-center text-tl-muted">
                  <Film className="w-4 h-4" />
                </div>
                <h2 className="font-display text-base font-semibold text-tl-text">
                  Video analysis engine is under development
                </h2>
                <p className="text-xs text-tl-muted leading-relaxed">
                  TruthLens does not simulate video forensics or display placeholder frame findings.
                  Video ingestion, temporal scanning, and frame integrity diagnostics will be
                  enabled once the backend pipeline is validated.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/image-forensics')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan hover:text-tl-cyan transition-colors"
                  >
                    <span>Analyze still frames in Image Forensics</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Disabled Timeline Footer */}
            <div className="px-4 py-3 border-t border-tl-border bg-tl-bg-secondary/50 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-tl-muted">
              <span>00:00.00 / --:--.--</span>
              <span>Frame stepping &amp; temporal tracks unavailable</span>
            </div>
          </section>

          {/* Planned Capabilities List */}
          <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-tl-text">
                Planned Capabilities
              </h2>
              <span className="font-mono text-[11px] text-tl-muted">4 diagnostic tracks</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANNED_VIDEO_CAPABILITIES.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="rounded-md border border-tl-border bg-tl-bg-secondary/60 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-tl-text">
                      <Icon className="w-3.5 h-3.5 text-tl-muted shrink-0" />
                      <span>{cap.title}</span>
                    </div>
                    <p className="text-xs text-tl-muted leading-relaxed">{cap.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 5 columns: Module Status & Operational Path */}
        <div className="xl:col-span-5 space-y-5">
          <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Module Implementation Status
            </h2>

            <dl className="divide-y divide-tl-border text-xs">
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-tl-muted">Module State</dt>
                <dd>
                  <StatusLabel status="Under Development" />
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-tl-muted">Backend Engine</dt>
                <dd className="font-mono text-tl-muted">Not connected</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-tl-muted">Simulated Results</dt>
                <dd className="font-mono text-tl-text">Disabled by policy</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-tl-muted">Available Today</dt>
                <dd>
                  <StatusLabel status="Operational" />
                  <span className="ml-1.5 text-tl-muted">(Image Forensics)</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-3 text-xs">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Inspecting Video Evidence Today
            </h2>
            <p className="text-tl-muted leading-relaxed">
              While the automated video pipeline is in development, investigators can export
              individual PNG or JPEG stills externally and examine them using the operational{' '}
              <strong className="text-tl-text font-medium">Image Forensics</strong> engine for EXIF
              provenance, Error Level Analysis, noise variance, and 2D FFT spectral inspection.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate('/image-forensics')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-tl-cyan hover:underline underline-offset-4"
              >
                <span>Open Image Forensics Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
