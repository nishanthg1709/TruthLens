import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  FilePlus2,
  MoveHorizontal,
  Upload,
} from 'lucide-react';
import { VISUAL_ASSETS } from '../constants/assets';
import { useForensic } from '../context/ForensicContext';
import { EvidenceItem } from '../types/forensics';
import {
  calculateSha256,
  formatFileSize,
  formatShortDate,
  generateId,
  validateImageFile,
} from '../utils/cryptoAndValidation';
import { SafeMediaImage, StatusLabel } from '../components/ui/ForensicPrimitives';
import { FORENSIC_EASE } from '../components/ui/MotionPrimitives';

interface LabDirectoryEntry {
  index: string;
  id: string;
  title: string;
  to: string;
  summary: string;
  detail: string;
  status: 'Operational' | 'Engine Unavailable' | 'Under Development' | 'Not Yet Available' | 'Local Tool';
  operational: boolean;
  previewKind: 'image' | 'video' | 'audio' | 'text' | 'graph' | 'compare';
  imageSrc?: string;
}

export const DashboardPage: React.FC = () => {
  const {
    investigations,
    evidence,
    demoMode,
    setDemoMode,
    backendHealth,
    addEvidenceItem,
    setActiveInvestigationId,
    setSelectedEvidenceId,
    pushToast,
  } = useForensic();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Interactive Optical Split-Curtain state
  const [splitPct, setSplitPct] = useState(54);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number; cell: string }>({
    x: 648,
    y: 412,
    cell: 'r1_c2',
  });

  // Drop-to-Inspect hero intake state
  const [dropActive, setDropActive] = useState(false);
  const [intaking, setIntaking] = useState(false);

  // Interactive Lab Directory hover preview state
  const [hoveredLabId, setHoveredLabId] = useState<string>('image');

  const labs: LabDirectoryEntry[] = useMemo(
    () => [
      {
        index: '01',
        id: 'image',
        title: 'Image Forensics',
        to: '/image-forensics',
        summary: 'Operational FastAPI engine for EXIF provenance, Error Level Analysis, noise variance, 2D FFT, and 4×4 regional inspection.',
        detail:
          'Currently the sole operational forensic engine—connected directly to the FastAPI backend (POST /api/v1/analyze) with local Web Crypto SHA-256 hashing.',
        status: backendHealth.status === 'connected' ? 'Operational' : 'Engine Unavailable',
        operational: true,
        previewKind: 'image',
        imageSrc: VISUAL_ASSETS.imageForensics,
      },
      {
        index: '02',
        id: 'video',
        title: 'Video Forensics',
        to: '/video-forensics',
        summary: 'Planned module for video frame analysis, temporal consistency, frame-level manipulation indicators, and video integrity examination.',
        detail:
          'Under development. Automated video frame and temporal pipelines are not yet active; view the module overview for planned capabilities.',
        status: 'Under Development',
        operational: false,
        previewKind: 'video',
        imageSrc: VISUAL_ASSETS.videoForensics,
      },
      {
        index: '03',
        id: 'audio',
        title: 'Audio Forensics',
        to: '/audio-forensics',
        summary: 'Planned module for audio integrity analysis, synthetic speech indicators, waveform examination, and manipulation analysis.',
        detail:
          'Under development. Audio ingestion and synthetic speech diagnostics are disabled until the acoustic backend is validated.',
        status: 'Under Development',
        operational: false,
        previewKind: 'audio',
        imageSrc: VISUAL_ASSETS.audioForensics,
      },
      {
        index: '04',
        id: 'cross-modal',
        title: 'Cross-Modal Analysis',
        to: '/cross-modal',
        summary: 'Future verification layer comparing consistency across visual, audio, video, and contextual evidence.',
        detail:
          'Not yet available. Requires Video and Audio forensic pipelines to be operational before cross-modal consistency comparison is enabled.',
        status: 'Not Yet Available',
        operational: false,
        previewKind: 'graph',
      },
      {
        index: '05',
        id: 'text',
        title: 'Text & Context Notes',
        to: '/text-analysis',
        summary: 'Client-side statement diffing and manual claim logging to document contextual notes alongside image cases.',
        detail:
          'Local investigator workspace utility for side-by-side text comparison and case documentation—no automated verification claims.',
        status: 'Local Tool',
        operational: false,
        previewKind: 'text',
      },
      {
        index: '06',
        id: 'comparison',
        title: 'Evidence Comparison',
        to: '/comparison',
        summary: 'Client-side side-by-side image overlay, opacity blend, and local SHA-256 digest comparison.',
        detail:
          'Local visual comparator for aligning two image files and checking bit-for-bit SHA-256 differences in the browser.',
        status: 'Local Tool',
        operational: false,
        previewKind: 'compare',
      },
    ],
    [backendHealth.status]
  );

  const activeLab = useMemo(
    () => labs.find((l) => l.id === hoveredLabId) ?? labs[0],
    [labs, hoveredLabId]
  );

  const handleDirectImageDrop = async (file: File) => {
    setIntaking(true);
    try {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        pushToast({
          title: 'Image validation failed',
          description: validation.errors[0],
          tone: 'alert',
        });
        return;
      }

      const evId = generateId('EV');
      const sha256 = await calculateSha256(file);
      const previewUrl = URL.createObjectURL(file);
      const now = new Date().toISOString();

      const item: EvidenceItem = {
        id: evId,
        investigationId: demoMode ? null : investigations[0]?.id || null,
        fileName: file.name,
        mediaType: 'image',
        mimeType: file.type || 'image/jpeg',
        fileSizeBytes: file.size,
        uploadedAt: now,
        sha256,
        hashOrigin: sha256 ? 'local_sha256' : 'unavailable',
        dimensions: validation.dimensions,
        previewUrl,
        analysisStatus: 'Unanalyzed',
        notes: [],
        custodyLog: [
          {
            id: generateId('COC'),
            timestamp: now,
            action: 'Quick Intake from TruthLens Home',
            actor: 'Investigator Session',
            origin: 'local_client',
            details: `${formatFileSize(file.size)}, ${validation.dimensions?.width ?? '?'}×${validation.dimensions?.height ?? '?'}px. Local SHA-256 calculated.`,
          },
        ],
      };

      addEvidenceItem(item, file);
      setSelectedEvidenceId(evId);
      navigate('/image-forensics');
    } finally {
      setIntaking(false);
    }
  };

  const handleOpenDemoSample = () => {
    setDemoMode(true);
    navigate('/image-forensics');
  };

  const updateSplitFromPointer = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.max(8, Math.min(92, pct)));
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const col = Math.min(3, Math.floor(relX * 4));
    const row = Math.min(3, Math.floor(relY * 4));
    setCursorCoords({
      x: Math.round(relX * 1200),
      y: Math.round(relY * 896),
      cell: `r${row}_c${col}`,
    });
    if (draggingSplit) {
      updateSplitFromPointer(e.clientX);
    }
  };

  const analyzedCount = useMemo(
    () =>
      evidence.filter(
        (e) => e.analysisStatus === 'Analyzed' || e.analysisStatus === 'Requires Review'
      ).length,
    [evidence]
  );

  const reviewCount = useMemo(
    () => evidence.filter((e) => e.analysisStatus === 'Requires Review').length,
    [evidence]
  );

  return (
    <div className="space-y-20 lg:space-y-24 pb-8">
      {/* ACT 1: Editorial Hero & Interactive Optical Curtain Workbench */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
        {/* Left Column: Editorial Statement + Direct Drop-to-Inspect */}
        <div className="lg:col-span-6 flex flex-col justify-between gap-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-tl-muted">
              <span>Digital Forensic Workbench</span>
              <span aria-hidden="true">·</span>
              <span>Open Evidence Protocol</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">SHA-256 Local Custody</span>
            </div>

            <h1
              className="font-display font-semibold tracking-[-0.025em] text-tl-text leading-[1.06] text-balance max-w-xl"
              style={{ fontSize: 'clamp(2.4rem, 4.2vw, 3.75rem)' }}
            >
              See beyond the image. Verify what is real.
            </h1>

            <p className="text-[15px] sm:text-base text-tl-muted leading-relaxed max-w-xl">
              An explainable digital forensics workstation with an operational{' '}
              <span className="text-tl-text font-medium">Image Forensics</span> engine for EXIF
              provenance, compression residuals, noise variance, and 2D FFT—with Video, Audio, and
              Cross-Modal modules in active development.
            </p>
          </div>

          {/* Direct Interactive Evidence Dropzone (Real Utility on Screen 1) */}
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleDirectImageDrop(f);
                e.target.value = '';
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDropActive(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleDirectImageDrop(f);
              }}
              className={`group cursor-pointer rounded-lg border border-dashed p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                dropActive
                  ? 'border-tl-cyan bg-tl-cyan/8'
                  : 'border-tl-border bg-tl-panel/70 hover:border-tl-muted'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-md border border-tl-border bg-tl-bg-secondary flex items-center justify-center shrink-0 text-tl-cyan group-hover:border-tl-cyan/60 transition-colors">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-tl-text">
                    {intaking
                      ? 'Computing SHA-256 digest & opening Image Lab...'
                      : 'Drop an image to inspect immediately'}
                  </div>
                  <div className="text-xs text-tl-muted mt-0.5">
                    JPEG, PNG, or WEBP up to 15 MB · Hashed locally before upload
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-center">
                <span>Select File</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs pt-1">
              <button
                type="button"
                onClick={handleOpenDemoSample}
                className="inline-flex items-center gap-1.5 font-medium text-tl-text hover:text-tl-cyan transition-colors"
              >
                <span>Inspect sample case (Demo)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/new-investigation')}
                className="inline-flex items-center gap-1.5 text-tl-muted hover:text-tl-text transition-colors"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>Open formal investigation</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/methodology')}
                className="text-tl-muted hover:text-tl-text transition-colors"
              >
                Read methodology
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Optical Split-Curtain Comparator */}
        <div className="lg:col-span-6 flex flex-col justify-between gap-3">
          <div
            ref={stageRef}
            onMouseMove={handleStageMouseMove}
            onMouseUp={() => setDraggingSplit(false)}
            onMouseLeave={() => setDraggingSplit(false)}
            onPointerDown={(e) => {
              setDraggingSplit(true);
              updateSplitFromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (draggingSplit) updateSplitFromPointer(e.clientX);
            }}
            onPointerUp={() => setDraggingSplit(false)}
            className="relative flex-1 min-h-[340px] lg:min-h-[430px] rounded-lg border border-tl-border bg-[#07080A] overflow-hidden select-none cursor-crosshair"
          >
            {/* Base Layer (Right Side Revealed): High-Pass Luminance / Residual Inspection View */}
            <div className="absolute inset-0">
              <SafeMediaImage
                src={VISUAL_ASSETS.demoEvidenceScene}
                alt="High-pass luminance residual inspection preview of transit plaza scene"
                className="w-full h-full object-cover grayscale contrast-[1.85] brightness-[0.72]"
                fallbackLabel="Optical Residual Stage"
              />
              {/* Calibrated 4x4 Forensic Grid */}
              <div
                aria-hidden="true"
                className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none"
              >
                {Array.from({ length: 16 }).map((_, idx) => {
                  const r = Math.floor(idx / 4);
                  const c = idx % 4;
                  const cellId = `r${r}_c${c}`;
                  const isHighlighted = cursorCoords.cell === cellId;
                  const isFlaggedSample = cellId === 'r1_c2';
                  return (
                    <div
                      key={cellId}
                      className={`border-r border-b border-white/15 relative transition-colors duration-150 ${
                        isFlaggedSample
                          ? 'bg-[#E5AA46]/14'
                          : isHighlighted
                            ? 'bg-white/6'
                            : ''
                      }`}
                    >
                      <span
                        className={`absolute top-1.5 left-2 font-mono text-[10px] ${
                          isFlaggedSample
                            ? 'text-[#E5AA46]'
                            : isHighlighted
                              ? 'text-white/90'
                              : 'text-white/35'
                        }`}
                      >
                        {cellId}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clipped Layer (Left Side): Original Optical Capture */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
            >
              <SafeMediaImage
                src={VISUAL_ASSETS.demoEvidenceScene}
                alt="Original photographic capture of dusk transit plaza"
                className="w-full h-full object-cover"
                fallbackLabel="Original Capture"
              />
            </div>

            {/* Subtle top/bottom contrast scrims */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

            {/* Top corner view labels */}
            <div className="pointer-events-none absolute top-3 left-3.5 right-3.5 flex items-center justify-between text-[11px] font-mono text-white/85">
              <span>ORIGINAL CAPTURE</span>
              <span>4×4 LUMINANCE GRID</span>
            </div>

            {/* Precision Vertical Split Hairline & Drag Handle */}
            <div
              style={{ left: `${splitPct}%` }}
              className="pointer-events-none absolute inset-y-0 -translate-x-1/2 flex items-center justify-center"
            >
              <div className="w-px h-full bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
              <div className="absolute w-8 h-8 rounded-full bg-[#0B0C0E]/90 border border-white/60 text-white flex items-center justify-center shadow-lg">
                <MoveHorizontal className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Bottom Live Optical Coordinate HUD */}
            <div className="pointer-events-none absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between gap-2 text-[11px] font-mono text-white/85 tabular-nums">
              <span>
                X:{String(cursorCoords.x).padStart(4, '0')} · Y:
                {String(cursorCoords.y).padStart(4, '0')} · {cursorCoords.cell}
              </span>
              <span className="hidden sm:inline text-white/65">
                SPLIT {Math.round(splitPct)}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tl-muted">
            <span>DEMO preview fixture · Drag divider to inspect optical overlay</span>
            <input
              type="range"
              min={8}
              max={92}
              value={Math.round(splitPct)}
              onChange={(e) => setSplitPct(Number(e.target.value))}
              aria-label="Adjust optical inspection split divider"
              className="w-28 accent-tl-cyan cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* ACT 2: Asymmetric Six-Lab Examination Directory (Zero Card Clones) */}
      <section className="border-t border-tl-border pt-14 lg:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Sticky Context & Live Preview Frame */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="space-y-3">
              <div className="text-xs text-tl-muted">Forensic Engine Readiness</div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-tl-text leading-tight text-balance">
                Image Forensics operational. Multimodal roadmap in progress.
              </h2>
              <p className="text-sm text-tl-muted leading-relaxed">
                Image Forensics is connected to the FastAPI analysis backend today. Video Forensics,
                Audio Forensics, and Cross-Modal Analysis are visibly staged below with transparent
                development status—no simulated results.
              </p>

              {/* Restrained Forensic Engine Readiness Strip */}
              <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-tl-border bg-tl-panel/70 px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-tl-text font-medium">Image</span>
                  <StatusLabel
                    status={backendHealth.status === 'connected' ? 'Operational' : 'Engine Unavailable'}
                  />
                </div>
                <div className="rounded-md border border-tl-border bg-tl-bg-secondary/60 px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-tl-muted">Video</span>
                  <StatusLabel status="Under Development" />
                </div>
                <div className="rounded-md border border-tl-border bg-tl-bg-secondary/60 px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-tl-muted">Audio</span>
                  <StatusLabel status="Under Development" />
                </div>
                <div className="rounded-md border border-tl-border bg-tl-bg-secondary/60 px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-tl-muted">Cross-Modal</span>
                  <StatusLabel status="Not Yet Available" />
                </div>
              </div>
            </div>

            {/* Synchronized Lab Preview Stage */}
            <div className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeLab.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: FORENSIC_EASE }}
                >
                  <div className="h-52 relative bg-tl-bg-secondary border-b border-tl-border overflow-hidden">
                    {activeLab.imageSrc ? (
                      <>
                        <SafeMediaImage
                          src={activeLab.imageSrc}
                          alt={activeLab.title}
                          className={`w-full h-full object-cover ${
                            activeLab.operational ? '' : 'grayscale opacity-45'
                          }`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                      </>
                    ) : activeLab.previewKind === 'text' ? (
                      <div className="w-full h-full p-6 flex flex-col justify-between bg-tl-bg-secondary font-mono text-xs">
                        <div className="space-y-2.5 text-tl-muted">
                          <div className="text-tl-text">Local Statement Comparison Workspace</div>
                          <div>Compare pasted excerpts side-by-side and record manual context notes.</div>
                        </div>
                        <div className="text-[11px] text-tl-muted">
                          Client-side utility · No automated verification
                        </div>
                      </div>
                    ) : activeLab.previewKind === 'graph' ? (
                      <div className="w-full h-full bg-tl-bg-secondary flex items-center justify-center p-4">
                        <svg viewBox="0 0 320 150" className="w-full h-full text-tl-muted" aria-hidden="true">
                          <line x1="65" y1="45" x2="160" y2="75" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
                          <line x1="255" y1="40" x2="160" y2="75" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
                          <line x1="80" y1="115" x2="160" y2="75" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
                          <line x1="245" y1="112" x2="160" y2="75" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
                          <circle cx="160" cy="75" r="14" className="fill-tl-panel stroke-tl-border" strokeWidth="1.5" />
                          <circle cx="65" cy="45" r="8" className="fill-tl-panel stroke-tl-success" strokeWidth="1.2" />
                          <circle cx="255" cy="40" r="8" className="fill-tl-panel stroke-tl-border" strokeWidth="1.2" />
                          <circle cx="80" cy="115" r="8" className="fill-tl-panel stroke-tl-border" strokeWidth="1.2" />
                          <circle cx="245" cy="112" r="8" className="fill-tl-panel stroke-tl-border" strokeWidth="1.2" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-full h-full grid grid-cols-2 bg-tl-bg-secondary">
                        <div className="border-r border-tl-border p-5 flex flex-col justify-between">
                          <span className="font-mono text-[10px] text-tl-cyan">FILE A</span>
                          <div className="space-y-1 font-mono text-[11px] text-tl-muted">
                            <div>Local SHA-256</div>
                            <div>Side-by-side overlay</div>
                          </div>
                        </div>
                        <div className="p-5 flex flex-col justify-between">
                          <span className="font-mono text-[10px] text-tl-ice">FILE B</span>
                          <div className="space-y-1 font-mono text-[11px] text-tl-muted">
                            <div>Bit-level hash diff</div>
                            <div>Opacity &amp; difference blend</div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-white/90">
                        {activeLab.index}. {activeLab.title}
                      </span>
                      <StatusLabel status={activeLab.status} />
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <p className="text-xs text-tl-muted leading-relaxed">{activeLab.detail}</p>
                    <button
                      type="button"
                      onClick={() => navigate(activeLab.to)}
                      className="px-3 py-1.5 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan hover:text-tl-cyan transition-colors whitespace-nowrap shrink-0"
                    >
                      {activeLab.operational
                        ? 'Open Lab'
                        : activeLab.status === 'Local Tool'
                          ? 'Open Tool'
                          : 'View Status'}
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right Editorial Numbered Directory List (Hairline-Separated, Zero Card Borders) */}
          <div className="lg:col-span-7 divide-y divide-tl-border border-t border-b border-tl-border">
            {labs.map((lab) => {
              const isSelected = activeLab.id === lab.id;
              return (
                <button
                  key={lab.id}
                  type="button"
                  onMouseEnter={() => setHoveredLabId(lab.id)}
                  onFocus={() => setHoveredLabId(lab.id)}
                  onClick={() => navigate(lab.to)}
                  className={`group w-full text-left py-5 px-2 sm:px-3 transition-colors flex items-start justify-between gap-4 ${
                    isSelected ? 'bg-tl-panel/50' : 'hover:bg-tl-panel/30'
                  }`}
                >
                  <div className="flex items-start gap-4 sm:gap-6 min-w-0">
                    <span className="font-mono text-xs text-tl-muted tabular-nums pt-1 shrink-0">
                      {lab.index}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-display text-lg font-medium text-tl-text group-hover:text-tl-cyan transition-colors">
                          {lab.title}
                        </span>
                        <StatusLabel status={lab.status} />
                      </div>
                      <p className="text-xs sm:text-sm text-tl-muted leading-relaxed max-w-xl">
                        {lab.summary}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-tl-muted group-hover:text-tl-cyan group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-1.5" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ACT 3: Workspace Docket (Clean Case Ledger — Zero Empty KPI Cards) */}
      <section className="border-t border-tl-border pt-14 lg:pt-16 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs text-tl-muted">Case Records</div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-tl-text">
              Workspace Docket
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-tl-muted tabular-nums pt-0.5">
              <span>{investigations.length} case(s)</span>
              <span aria-hidden="true">·</span>
              <span>{evidence.length} evidence item(s)</span>
              <span aria-hidden="true">·</span>
              <span>{analyzedCount} analyzed</span>
              {reviewCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-tl-caution">{reviewCount} flagged for review</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => navigate('/system-status')}
                className="hover:text-tl-text transition-colors"
              >
                Engine:{' '}
                <span
                  className={
                    backendHealth.status === 'connected' ? 'text-tl-success' : 'text-tl-muted'
                  }
                >
                  {backendHealth.status === 'connected' ? 'Connected' : 'Standby'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Clean Interactive Live / Demo Workspace Switcher */}
            <div
              role="group"
              aria-label="Workspace data mode"
              className="inline-flex items-center p-0.5 rounded-md border border-tl-border bg-tl-bg-secondary text-xs"
            >
              <button
                type="button"
                onClick={() => setDemoMode(false)}
                className={`px-3 py-1.5 rounded font-medium transition-colors whitespace-nowrap ${
                  !demoMode
                    ? 'bg-tl-panel text-tl-text shadow-xs'
                    : 'text-tl-muted hover:text-tl-text'
                }`}
              >
                Live Local
              </button>
              <button
                type="button"
                onClick={() => setDemoMode(true)}
                className={`px-3 py-1.5 rounded font-medium transition-colors whitespace-nowrap ${
                  demoMode
                    ? 'bg-tl-panel text-tl-caution shadow-xs'
                    : 'text-tl-muted hover:text-tl-text'
                }`}
              >
                Demo Fixtures
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/vault')}
              className="px-3 py-1.5 rounded-md border border-tl-border text-xs font-medium text-tl-text hover:border-tl-muted transition-colors whitespace-nowrap"
            >
              Evidence Vault
            </button>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="px-3 py-1.5 rounded-md border border-tl-border text-xs font-medium text-tl-text hover:border-tl-muted transition-colors whitespace-nowrap"
            >
              Report Studio
            </button>
          </div>
        </div>

        {investigations.length === 0 ? (
          <div className="border-t border-b border-tl-border py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-sm font-medium text-tl-text">
                No live cases stored in this browser yet.
              </div>
              <p className="text-xs text-tl-muted leading-relaxed">
                Drop an image in the hero above for immediate analysis, open a structured case
                record, or toggle Demo Fixtures to explore a complete sample investigation.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/new-investigation')}
                className="px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Create Case Record
              </button>
              <button
                type="button"
                onClick={() => setDemoMode(true)}
                className="px-3.5 py-2 rounded-md border border-tl-border text-xs font-medium text-tl-text hover:border-tl-caution hover:text-tl-caution transition-colors whitespace-nowrap"
              >
                Load Sample Case
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-b border-tl-border divide-y divide-tl-border">
            {investigations.slice(0, 5).map((inv) => (
              <div
                key={inv.id}
                onClick={() => {
                  setActiveInvestigationId(inv.id);
                  navigate(`/workspace/${inv.id}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveInvestigationId(inv.id);
                    navigate(`/workspace/${inv.id}`);
                  }
                }}
                className="group py-4 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-tl-panel/45 transition-colors cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-5 min-w-0">
                  <span className="font-mono text-xs text-tl-muted tabular-nums shrink-0 w-24">
                    {inv.caseReference}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-tl-text group-hover:text-tl-cyan transition-colors truncate">
                      {inv.title}
                    </div>
                    <div className="text-xs text-tl-muted mt-0.5 flex flex-wrap items-center gap-2">
                      <span>{inv.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {inv.evidenceIds.length} evidence item(s)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Opened {formatShortDate(inv.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <StatusLabel status={inv.status} />
                  <span className="text-xs font-medium text-tl-muted group-hover:text-tl-text inline-flex items-center gap-1">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ACT 4: Scientific Principles (Unboxed 3-Column Editorial Band) */}
      <section className="border-t border-tl-border pt-14 lg:pt-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          <div className="space-y-2">
            <div className="font-mono text-xs text-tl-muted">01</div>
            <h3 className="font-display text-lg font-medium text-tl-text">
              Indicators, never verdicts
            </h3>
            <p className="text-sm text-tl-muted leading-relaxed">
              TruthLens surfaces independent signal observations—compression variance, noise
              residuals, and spectral profiles—without fabricating authenticity percentages.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs text-tl-muted">02</div>
            <h3 className="font-display text-lg font-medium text-tl-text">
              Local SHA-256 chain of custody
            </h3>
            <p className="text-sm text-tl-muted leading-relaxed">
              Every uploaded artifact is cryptographically hashed in your browser via Web Crypto
              before submission, logging an immutable session custody trail.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs text-tl-muted">03</div>
            <h3 className="font-display text-lg font-medium text-tl-text">
              Transparent failure modes
            </h3>
            <p className="text-sm text-tl-muted leading-relaxed">
              Social-media recompression, resizing, and screenshots degrade forensic signals.
              TruthLens documents those limitations directly inside every exported report.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
