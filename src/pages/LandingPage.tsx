import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, MoveHorizontal } from 'lucide-react';
import { VISUAL_ASSETS } from '../constants/assets';
import { useAuth } from '../context/AuthContext';
import { SafeMediaImage } from '../components/ui/ForensicPrimitives';
import { FORENSIC_EASE } from '../components/ui/MotionPrimitives';

const CAPABILITIES = [
  {
    index: '01',
    title: 'Image Forensics Lab',
    description:
      'EXIF & metadata provenance inspection, Error Level Analysis, noise variance residuals, 2D FFT spectral profiles, and 4×4 regional grid deviation review.',
  },
  {
    index: '02',
    title: 'Video & Audio Workbenches',
    description:
      'Frame-by-frame video stepping with direct frame capture into Image Forensics, paired with acoustic waveform scrubbing and timestamped transcript review.',
  },
  {
    index: '03',
    title: 'Text, Cross-Modal & Comparison',
    description:
      'Token-level statement diffing, cross-modal evidence relationship graphs, and synchronized side-by-side opacity or pixel-difference inspection.',
  },
  {
    index: '04',
    title: 'Chain of Custody & PDF Dossiers',
    description:
      'Local Web Crypto SHA-256 hashing on intake, cloud-synced investigator case records, and exportable 15-section forensic examination reports.',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [splitPct, setSplitPct] = useState(52);
  const [dragging, setDragging] = useState(false);
  const [coords, setCoords] = useState({ x: 624, y: 418, cell: 'r1_c2' });

  const enterDestination = user ? '/home' : '/auth';

  const updateSplit = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.max(8, Math.min(92, pct)));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setCoords({
      x: Math.round(rx * 1200),
      y: Math.round(ry * 896),
      cell: `r${Math.min(3, Math.floor(ry * 4))}_c${Math.min(3, Math.floor(rx * 4))}`,
    });
    if (dragging) updateSplit(e.clientX);
  };

  return (
    <div className="min-h-screen flex flex-col bg-tl-bg text-tl-text">
      {/* Strict 3-Zone Landing Top Bar */}
      <header className="sticky top-0 z-30 bg-tl-bg/92 backdrop-blur-md border-b border-tl-border">
        <div className="max-w-[1440px] mx-auto h-16 px-5 lg:px-10 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 text-tl-text whitespace-nowrap shrink-0"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-tl-cyan shrink-0"
            >
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 1.5V5M12 19V22.5M1.5 12H5M19 12H22.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display text-lg font-semibold tracking-tight leading-none">
              TruthLens
            </span>
          </a>

          <nav
            aria-label="Landing navigation"
            className="hidden md:flex items-center gap-8 text-sm font-medium text-tl-muted"
          >
            <a href="#capabilities" className="hover:text-tl-text transition-colors whitespace-nowrap">
              Capabilities
            </a>
            <a href="#workflow" className="hover:text-tl-text transition-colors whitespace-nowrap">
              Workflow
            </a>
            <a href="#standards" className="hover:text-tl-text transition-colors whitespace-nowrap">
              Scientific Standards
            </a>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="hover:text-tl-text transition-colors whitespace-nowrap"
            >
              {user ? 'Switch Account' : 'Sign In'}
            </button>
          </nav>

          <div className="shrink-0">
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(enterDestination)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <span>{user ? 'Open Workspace' : 'Get Started'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Editorial Landing Flow */}
      <main id="top" className="flex-1 w-full max-w-[1440px] mx-auto px-5 lg:px-10">
        {/* HERO SECTION */}
        <section className="py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: FORENSIC_EASE }}
            className="lg:col-span-6 flex flex-col justify-between gap-10"
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-tl-muted">
                <span>Multimodal Digital Forensics</span>
                <span aria-hidden="true">·</span>
                <span>Explainable Evidence Protocol</span>
                <span aria-hidden="true">·</span>
                <span>INNOVEDGE 2026</span>
              </div>

              <h1
                className="font-display font-semibold tracking-[-0.025em] text-tl-text leading-[1.04] text-balance"
                style={{ fontSize: 'clamp(2.5rem, 4.6vw, 4.1rem)' }}
              >
                See beyond the image. Verify what is real.
              </h1>

              <p className="text-base text-tl-muted leading-relaxed max-w-xl">
                TruthLens is an optical and contextual forensic workstation for journalists,
                researchers, and digital investigators. Inspect EXIF provenance, compression
                residuals, noise variance, frequency spectra, and cross-modal evidence inside a
                single verifiable chain of custody.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(enterDestination)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-tl-text text-tl-bg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <span>{user ? 'Enter Forensic Workspace' : 'Sign In & Launch Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
                <button
                  type="button"
                  onClick={() => navigate('/auth?mode=signup')}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-md border border-tl-border text-sm font-medium text-tl-text hover:border-tl-muted transition-colors whitespace-nowrap"
                >
                  <span>Create Investigator Account</span>
                </button>
              </div>
            </div>

            <div className="border-t border-tl-border pt-6 grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="font-mono text-lg font-semibold text-tl-text tabular-nums">4 + 1</div>
                <div className="text-tl-muted mt-0.5">Independent signal domains + 4×4 spatial grid</div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-tl-text tabular-nums">SHA-256</div>
                <div className="text-tl-muted mt-0.5">Local cryptographic intake before upload</div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-tl-text tabular-nums">15-Section</div>
                <div className="text-tl-muted mt-0.5">Explainable PDF &amp; JSON forensic dossiers</div>
              </div>
            </div>
          </motion.div>

          {/* Interactive Optical Split-Curtain Stage */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: FORENSIC_EASE }}
            className="lg:col-span-6 flex flex-col justify-between gap-3"
          >
            <div
              ref={stageRef}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onPointerDown={(e) => {
                setDragging(true);
                updateSplit(e.clientX);
              }}
              onPointerMove={(e) => {
                if (dragging) updateSplit(e.clientX);
              }}
              onPointerUp={() => setDragging(false)}
              className="relative flex-1 min-h-[360px] lg:min-h-[460px] rounded-lg border border-tl-border bg-[#07080A] overflow-hidden select-none cursor-crosshair"
            >
              {/* Right Layer: Luminance Residual & 4x4 Grid */}
              <div className="absolute inset-0">
                <SafeMediaImage
                  src={VISUAL_ASSETS.demoEvidenceScene}
                  alt="High-pass optical residual inspection view"
                  className="w-full h-full object-cover grayscale contrast-[1.85] brightness-[0.72]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none"
                >
                  {Array.from({ length: 16 }).map((_, idx) => {
                    const cellId = `r${Math.floor(idx / 4)}_c${idx % 4}`;
                    const activeCell = coords.cell === cellId;
                    const sampleFlag = cellId === 'r1_c2';
                    return (
                      <div
                        key={cellId}
                        className={`border-r border-b border-white/15 relative transition-colors ${
                          sampleFlag
                            ? 'bg-[#E5AA46]/15'
                            : activeCell
                              ? 'bg-white/6'
                              : ''
                        }`}
                      >
                        <span
                          className={`absolute top-1.5 left-2 font-mono text-[10px] ${
                            sampleFlag
                              ? 'text-[#E5AA46]'
                              : activeCell
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

              {/* Left Layer: Original Capture */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
              >
                <SafeMediaImage
                  src={VISUAL_ASSETS.demoEvidenceScene}
                  alt="Original photographic capture"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

              <div className="pointer-events-none absolute top-3.5 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-white/85">
                <span>ORIGINAL CAPTURE</span>
                <span>4×4 LUMINANCE GRID</span>
              </div>

              <div
                style={{ left: `${splitPct}%` }}
                className="pointer-events-none absolute inset-y-0 -translate-x-1/2 flex items-center justify-center"
              >
                <div className="w-px h-full bg-white/80" />
                <div className="absolute w-8 h-8 rounded-full bg-[#0B0C0E]/90 border border-white/60 text-white flex items-center justify-center shadow-lg">
                  <MoveHorizontal className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-3.5 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-white/85 tabular-nums">
                <span>
                  X:{String(coords.x).padStart(4, '0')} · Y:{String(coords.y).padStart(4, '0')} ·{' '}
                  {coords.cell}
                </span>
                <span>DRAG TO INSPECT</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-tl-muted">
              <span>Interactive optical inspection preview · Sample fixture</span>
              <input
                type="range"
                min={8}
                max={92}
                value={Math.round(splitPct)}
                onChange={(e) => setSplitPct(Number(e.target.value))}
                aria-label="Move optical inspection split divider"
                className="w-28 accent-tl-cyan cursor-pointer"
              />
            </div>
          </motion.div>
        </section>

        {/* CAPABILITIES SECTION */}
        <section id="capabilities" className="border-t border-tl-border py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="text-xs text-tl-muted">Capabilities</div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-tl-text leading-tight text-balance">
                Every forensic modality in one authenticated workspace.
              </h2>
              <p className="text-sm text-tl-muted leading-relaxed">
                Sign in to unlock your personal investigator workspace with cloud-synced case
                dockets, live FastAPI image analysis integration, and full multimodal examination
                labs.
              </p>
              <div className="pt-2">
                <SafeMediaImage
                  src={VISUAL_ASSETS.heroLab}
                  alt="Digital forensic laboratory workstation"
                  className="w-full h-56 object-cover rounded-lg border border-tl-border"
                />
              </div>
            </div>

            <div className="lg:col-span-7 divide-y divide-tl-border border-t border-b border-tl-border">
              {CAPABILITIES.map((cap) => (
                <div key={cap.index} className="py-6 flex items-start gap-5">
                  <span className="font-mono text-xs text-tl-muted tabular-nums pt-1 shrink-0">
                    {cap.index}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-xl font-medium text-tl-text">{cap.title}</h3>
                    <p className="text-sm text-tl-muted leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW SECTION */}
        <section id="workflow" className="border-t border-tl-border py-16 lg:py-20 space-y-10">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs text-tl-muted">Investigation Flow</div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-tl-text text-balance">
              From landing to verified forensic dossier in three steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <div className="space-y-2.5">
              <div className="font-mono text-xs text-tl-cyan">Step 01</div>
              <h3 className="font-display text-lg font-medium text-tl-text">
                Authenticate Investigator Session
              </h3>
              <p className="text-sm text-tl-muted leading-relaxed">
                Sign in with your verified Google account to attribute case notes, custody logs,
                and exported forensic reports to your investigator identity.
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="font-mono text-xs text-tl-cyan">Step 02</div>
              <h3 className="font-display text-lg font-medium text-tl-text">
                Examine Signals &amp; Regional Grids
              </h3>
              <p className="text-sm text-tl-muted leading-relaxed">
                Drop digital evidence to compute local SHA-256 digests, inspect EXIF metadata, ELA
                residuals, 2D FFT spectra, and 4×4 spatial consistency.
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="font-mono text-xs text-tl-cyan">Step 03</div>
              <h3 className="font-display text-lg font-medium text-tl-text">
                Document Findings &amp; Export
              </h3>
              <p className="text-sm text-tl-muted leading-relaxed">
                Compile contextual notes, chain-of-custody entries, and explicit analytical
                limitations into print-ready PDF or structured JSON dossiers.
              </p>
            </div>
          </div>
        </section>

        {/* SCIENTIFIC STANDARDS & CTA BAND */}
        <section
          id="standards"
          className="border-t border-tl-border py-16 lg:py-20 flex flex-col lg:flex-row lg:items-end justify-between gap-8"
        >
          <div className="max-w-2xl space-y-3">
            <div className="text-xs text-tl-muted">Scientific Integrity</div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-tl-text text-balance">
              Built for human judgment—never black-box authenticity scores.
            </h2>
            <p className="text-sm text-tl-muted leading-relaxed">
              Every TruthLens module reports measurable signal observations alongside explicit
              recompression, resize, and screenshot limitations so investigators always know what
              the evidence can—and cannot—prove.
            </p>
          </div>

          <div className="shrink-0">
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(enterDestination)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-tl-text text-tl-bg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <span>{user ? 'Go to Workspace' : 'Continue to Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </section>
      </main>

      {/* Quiet Landing Footer */}
      <footer className="border-t border-tl-border">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-10 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-tl-muted">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-sm text-tl-text">TruthLens</span>
            <span aria-hidden="true">·</span>
            <span>See beyond the image. Verify what is real.</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="hover:text-tl-text transition-colors"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate('/auth?mode=signup')}
              className="hover:text-tl-text transition-colors"
            >
              Create Account
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
