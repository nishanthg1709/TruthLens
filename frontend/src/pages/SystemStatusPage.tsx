import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Activity, RefreshCw, Server, Settings } from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { formatTimestamp } from '../utils/cryptoAndValidation';
import { NoticeCallout, StatusLabel } from '../components/ui/ForensicPrimitives';
import {
  FORENSIC_EASE,
  ForensicCard,
  StaggerContainer,
  StaggerItem,
} from '../components/ui/MotionPrimitives';

export const SystemStatusPage: React.FC = () => {
  const { backendHealth, refreshBackendHealth } = useForensic();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    await refreshBackendHealth();
    setChecking(false);
  };

  const backendConnected = backendHealth.status === 'connected';
  const backendStatusText =
    backendHealth.status === 'connected'
      ? 'Connected'
      : backendHealth.status === 'checking'
        ? 'Checking'
        : 'Disconnected';

  const engines = [
    {
      name: 'Image Forensics Engine',
      endpoint: 'POST /api/v1/analyze',
      status: backendConnected ? ('Connected' as const) : ('Disconnected' as const),
      note: backendConnected
        ? 'FastAPI /health confirmed. EXIF, ELA, Noise Residual, FFT, and 4×4 Regional modules ready.'
        : 'Unavailable until FastAPI backend connection is confirmed.',
    },
    {
      name: 'Video Forensics Engine',
      endpoint: 'Keyframe Extraction & Still-Frame Analysis',
      status: backendConnected ? ('Operational' as const) : ('Local Tool' as const),
      note: 'Keyframe extraction and still-frame forensic analysis via FastAPI backend. Displays timestamps, ELA, noise, and frequency characteristics.',
    },
    {
      name: 'Audio Forensics Engine',
      endpoint: 'Web Audio API Acoustic Signal Engine',
      status: 'Operational' as const,
      note: 'Sample-accurate acoustic metrics (peak, RMS, crest factor, ZCR, clipping) with real-time waveform and spectrogram visualization.',
    },
    {
      name: 'Text & Context Analysis',
      endpoint: 'Client-side contextual diff',
      status: 'Local Tool' as const,
      note: 'Local Text A vs Text B comparison and claim categorization utility available; external fact-checking engine is not implemented.',
    },
    {
      name: 'Cross-Modal Analysis Engine',
      endpoint: 'Not Yet Available',
      status: 'Not Yet Available' as const,
      note: 'Cross-modal verification comparing consistency across visual, audio, video, and contextual evidence is not yet available.',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
            System Status
          </h1>
          <p className="text-sm text-tl-muted mt-1">
            Live FastAPI backend connectivity, honest engine availability, and enforced image upload limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tl-border bg-tl-panel text-xs font-medium text-tl-text hover:border-tl-cyan"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure API URL</span>
          </button>
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking /health...' : 'Test Connection'}</span>
          </button>
        </div>
      </div>

      {!backendConnected && backendHealth.status !== 'checking' && (
        <NoticeCallout tone="alert" title="Forensic Backend Disconnected">
          {backendHealth.errorMessage ||
            `Could not reach ${backendHealth.apiBaseUrl}/health. TruthLens will not simulate analysis results while the backend is unreachable.`}
        </NoticeCallout>
      )}

      {/* Core Health Summary Cards */}
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StaggerItem>
          <ForensicCard className="h-full rounded-lg border border-tl-border bg-tl-panel p-4 space-y-2 hover:border-tl-cyan/45 transition-colors">
            <div className="flex items-center justify-between text-xs text-tl-muted">
              <span>Frontend Application</span>
              <Activity className="w-4 h-4 text-tl-cyan" />
            </div>
            <div className="pt-1">
              <StatusLabel status="Connected" />
            </div>
            <div className="font-mono text-[11px] text-tl-muted">
              TruthLens Web Workstation (React + Vite)
            </div>
          </ForensicCard>
        </StaggerItem>

        <StaggerItem>
          <ForensicCard className="h-full rounded-lg border border-tl-border bg-tl-panel p-4 space-y-2 hover:border-tl-cyan/45 transition-colors">
            <div className="flex items-center justify-between text-xs text-tl-muted">
              <span>FastAPI Forensic Backend</span>
              <span className="relative inline-flex items-center justify-center w-5 h-5">
                {(checking || backendHealth.status === 'checking') && (
                  <span
                    aria-hidden="true"
                    className="animate-radar-sweep absolute inset-0 rounded-full border border-transparent border-t-tl-cyan"
                  />
                )}
                <Server className="w-4 h-4 text-tl-cyan" />
              </span>
            </div>
            <div className="pt-1">
              <StatusLabel status={backendStatusText} />
            </div>
            <div className="font-mono text-[11px] text-tl-muted truncate" title={backendHealth.apiBaseUrl}>
              {backendHealth.apiBaseUrl}
            </div>
          </ForensicCard>
        </StaggerItem>

        <StaggerItem>
          <ForensicCard className="h-full rounded-lg border border-tl-border bg-tl-panel p-4 space-y-2 hover:border-tl-cyan/45 transition-colors">
            <div className="text-xs text-tl-muted">Health Probe Telemetry</div>
            <div className="font-mono text-sm font-semibold text-tl-text tabular-nums">
              {backendConnected && backendHealth.responseTimeMs !== null
                ? `${backendHealth.responseTimeMs} ms (GET /health)`
                : 'No response'}
            </div>
            <div className="font-mono text-[11px] text-tl-muted">
              Last checked: {formatTimestamp(backendHealth.lastCheckedAt)}
            </div>
          </ForensicCard>
        </StaggerItem>
      </StaggerContainer>

      {/* Engine Availability Table */}
      <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-tl-border flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-tl-text">
            Analysis Engine Availability
          </h2>
          <span className="font-mono text-[11px] text-tl-muted">
            Last successful probe: {formatTimestamp(backendHealth.lastSuccessAt)}
          </span>
        </div>
        <div className="divide-y divide-tl-border/70">
          {engines.map((eng, idx) => (
            <motion.div
              key={eng.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04, ease: FORENSIC_EASE }}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-tl-elevated/35 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-tl-text">{eng.name}</span>
                  <span className="text-tl-muted">·</span>
                  <span className="font-mono text-[11px] text-tl-ice">{eng.endpoint}</span>
                </div>
                <p className="text-tl-muted leading-relaxed">{eng.note}</p>
              </div>
              <div className="shrink-0">
                <StatusLabel status={eng.status} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contract & Limits */}
      <section className="rounded-lg border border-tl-border bg-tl-panel p-5">
        <h2 className="font-display text-sm font-semibold text-tl-text mb-3">
          Active Image Analysis Contract &amp; Limits
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="rounded border border-tl-border bg-tl-bg-secondary p-3">
            <dt className="text-tl-muted">API Base URL</dt>
            <dd className="font-mono text-tl-text mt-1 break-all">{backendHealth.apiBaseUrl}</dd>
          </div>
          <div className="rounded border border-tl-border bg-tl-bg-secondary p-3">
            <dt className="text-tl-muted">Supported Image Formats</dt>
            <dd className="font-mono text-tl-cyan mt-1">
              {backendHealth.supportedFormats.join(' · ')}
            </dd>
          </div>
          <div className="rounded border border-tl-border bg-tl-bg-secondary p-3">
            <dt className="text-tl-muted">Reported Backend Version</dt>
            <dd className="font-mono text-tl-text mt-1">
              {backendHealth.version || 'Unavailable (Backend offline)'}
            </dd>
          </div>
          <div className="rounded border border-tl-border bg-tl-bg-secondary p-3">
            <dt className="text-tl-muted">Maximum File Size</dt>
            <dd className="font-mono text-tl-text tabular-nums mt-1">
              {backendHealth.limits.maxFileSizeMb} MB
            </dd>
          </div>
          <div className="rounded border border-tl-border bg-tl-bg-secondary p-3">
            <dt className="text-tl-muted">Maximum Single Dimension</dt>
            <dd className="font-mono text-tl-text tabular-nums mt-1">
              {backendHealth.limits.maxDimensionPx.toLocaleString()} px
            </dd>
          </div>
          <div className="rounded border border-tl-border bg-tl-bg-secondary p-3">
            <dt className="text-tl-muted">Maximum Image Area</dt>
            <dd className="font-mono text-tl-text tabular-nums mt-1">
              {backendHealth.limits.maxMegapixels} Megapixels
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
};
