import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  AudioWaveform,
  Lock,
  MicOff,
  Scissors,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { VISUAL_ASSETS } from '../constants/assets';
import { SafeMediaImage, StatusLabel } from '../components/ui/ForensicPrimitives';

const PLANNED_AUDIO_CAPABILITIES = [
  {
    title: 'Audio Integrity Analysis',
    description:
      'Container header verification, codec metadata inspection, re-encoding history, and SHA-256 evidence digesting.',
    icon: ShieldCheck,
  },
  {
    title: 'Synthetic Speech Indicators',
    description:
      'Validated acoustic diagnostics for vocoder regularity, phase coherence anomalies, and speech synthesis artifacts.',
    icon: MicOff,
  },
  {
    title: 'Waveform Examination',
    description:
      'Sample-accurate amplitude envelope inspection, clipping detection, and ambient room-tone continuity profiling.',
    icon: Activity,
  },
  {
    title: 'Audio Manipulation Analysis',
    description:
      'Splice boundary detection, background noise-floor transitions, and high-frequency spectral cutoff examination.',
    icon: Scissors,
  },
];

export const AudioForensicsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-tl-border pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
              Audio Forensics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-tl-border bg-tl-panel">
              <StatusLabel status="Under Development" />
            </span>
          </div>
          <p className="text-sm text-tl-muted leading-relaxed">
            Dedicated acoustic examination workspace planned for audio integrity analysis, synthetic
            speech indicators, waveform examination, and audio manipulation analysis.
          </p>
        </div>

        {/* Disabled nonfunctional upload & analysis actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Audio uploads are disabled while the Audio Forensics engine is under development"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-tl-muted text-xs font-medium opacity-55 cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Audio</span>
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Automated audio analysis is not yet available"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-bg-secondary text-tl-muted text-xs font-medium opacity-55 cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Run Audio Analysis</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 columns: Restrained Empty Acoustic Stage */}
        <div className="xl:col-span-7 space-y-5">
          <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
            <div className="px-4 py-2.5 border-b border-tl-border bg-tl-bg-secondary/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium text-tl-text">
                <AudioWaveform className="w-4 h-4 text-tl-muted" />
                <span>Waveform &amp; Spectral Examination Stage</span>
              </div>
              <span className="font-mono text-[11px] text-tl-muted">Engine: Under Development</span>
            </div>

            <div className="relative min-h-[290px] bg-[#07080A] flex items-center justify-center overflow-hidden">
              <SafeMediaImage
                src={VISUAL_ASSETS.audioForensics}
                alt="Acoustic waveform and spectrogram workspace preview"
                className="absolute inset-0 w-full h-full object-cover opacity-18 grayscale"
              />
              <div className="relative z-10 max-w-md mx-auto px-6 py-10 text-center space-y-3">
                <div className="w-10 h-10 rounded-md border border-tl-border bg-tl-panel/90 mx-auto flex items-center justify-center text-tl-muted">
                  <AudioWaveform className="w-4 h-4" />
                </div>
                <h2 className="font-display text-base font-semibold text-tl-text">
                  Audio analysis engine is under development
                </h2>
                <p className="text-xs text-tl-muted leading-relaxed">
                  TruthLens does not generate simulated voice-cloning detections, synthetic
                  transcripts, or placeholder spectral scores. Audio uploads and diagnostic modules
                  will activate once the validated acoustic backend is integrated.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/image-forensics')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan hover:text-tl-cyan transition-colors"
                  >
                    <span>Open Operational Image Forensics</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-tl-border bg-tl-bg-secondary/50 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-tl-muted">
              <span>Supported target formats: WAV · MP3 · M4A · FLAC</span>
              <span>Acoustic pipeline pending</span>
            </div>
          </section>

          {/* Planned Capabilities */}
          <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-tl-text">
                Intended Capabilities
              </h2>
              <span className="font-mono text-[11px] text-tl-muted">4 diagnostic modules</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANNED_AUDIO_CAPABILITIES.map((cap) => {
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

        {/* Right 5 columns: Readiness & Methodology Safeguard */}
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
                <dt className="text-tl-muted">Acoustic Backend</dt>
                <dd className="font-mono text-tl-muted">Not connected</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-tl-muted">Synthetic Speech Detection</dt>
                <dd className="font-mono text-tl-muted">Unavailable</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <dt className="text-tl-muted">Simulated Detections</dt>
                <dd className="font-mono text-tl-text">Disabled by policy</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-3 text-xs">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Scientific Reliability Standard
            </h2>
            <p className="text-tl-muted leading-relaxed">
              Voice cloning and splice detection require calibrated acoustic models evaluated
              against telephony compression, microphone noise gates, and room acoustics. TruthLens
              withholds audio analysis outputs until the underlying backend meets documented
              methodology standards.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate('/methodology')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-tl-cyan hover:underline underline-offset-4"
              >
                <span>Review Methodology &amp; Limitations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
