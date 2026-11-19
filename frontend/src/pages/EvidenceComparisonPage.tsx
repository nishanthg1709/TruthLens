import React, { useEffect, useRef, useState } from 'react';
import {
  AudioWaveform,
  Columns2,
  Film,
  Image as ImageIcon,
  Pause,
  Play,
  RotateCcw,
  Type,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { VISUAL_ASSETS } from '../constants/assets';
import { useForensic } from '../context/ForensicContext';
import {
  calculateSha256,
  formatFileSize,
  readImageDimensions,
} from '../utils/cryptoAndValidation';
import { AnimatePresence, motion } from 'motion/react';
import { NoticeCallout, SafeMediaImage, StatusLabel } from '../components/ui/ForensicPrimitives';
import { FORENSIC_EASE } from '../components/ui/MotionPrimitives';

interface LocalCompareImage {
  name: string;
  url: string;
  size: number;
  mime: string;
  width: number;
  height: number;
  sha256: string | null;
}

export const EvidenceComparisonPage: React.FC = () => {
  const { demoMode } = useForensic();
  const [mode, setMode] = useState<'image' | 'text' | 'video' | 'audio'>('image');

  // Image comparison state
  const [imageMode, setImageMode] = useState<'side-by-side' | 'overlay' | 'difference'>(
    'side-by-side'
  );
  const [syncZoom, setSyncZoom] = useState(1);
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  const DEMO_IMG_A: LocalCompareImage = {
    name: 'transit_plaza_dusk_press_copy.jpg (DEMO A)',
    url: VISUAL_ASSETS.demoEvidenceScene,
    size: 1_482_910,
    mime: 'image/jpeg',
    width: 1200,
    height: 896,
    sha256: '4f8d2c9a71b30e5d9a1c4b22e8071f6a3c9e54b1d2089a7f3e6c1d4b8a2f9e01',
  };
  const DEMO_IMG_B: LocalCompareImage = {
    name: 'transit_plaza_recompressed_variant.jpg (DEMO B)',
    url: VISUAL_ASSETS.demoEvidenceScene,
    size: 842_310,
    mime: 'image/jpeg',
    width: 1200,
    height: 896,
    sha256: '7c2e9b4a10f58d31e6a2c4b8f9031d5e7a1c8b4d2e9f6a3c0b5d1e8f4a2c7b19',
  };

  const [imgA, setImgA] = useState<LocalCompareImage | null>(demoMode ? DEMO_IMG_A : null);
  const [imgB, setImgB] = useState<LocalCompareImage | null>(demoMode ? DEMO_IMG_B : null);

  const inputARef = useRef<HTMLInputElement | null>(null);
  const inputBRef = useRef<HTMLInputElement | null>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Text comparison state
  const [compareTextA, setCompareTextA] = useState(
    demoMode
      ? 'Platform 7 evacuated at 17:48 following total power failure at North Transit Plaza.'
      : ''
  );
  const [compareTextB, setCompareTextB] = useState(
    demoMode
      ? 'Platform 7 experienced a 9-minute signal delay at 17:46 at Central Transit Plaza with normal boarding.'
      : ''
  );

  // Video comparison state
  const [vidAUrl, setVidAUrl] = useState<string | null>(null);
  const [vidBUrl, setVidBUrl] = useState<string | null>(null);
  const vidARef = useRef<HTMLVideoElement | null>(null);
  const vidBRef = useRef<HTMLVideoElement | null>(null);
  const [vidPlaying, setVidPlaying] = useState(false);

  const trackBlobUrl = (url: string) => {
    blobUrlsRef.current.add(url);
    return url;
  };

  const revokeIfBlob = (url: string | null | undefined) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    }
  };

  useEffect(() => {
    if (demoMode) {
      setImgA((prev) => {
        revokeIfBlob(prev?.url);
        return DEMO_IMG_A;
      });
      setImgB((prev) => {
        revokeIfBlob(prev?.url);
        return DEMO_IMG_B;
      });
      setCompareTextA(
        'Platform 7 evacuated at 17:48 following total power failure at North Transit Plaza.'
      );
      setCompareTextB(
        'Platform 7 experienced a 9-minute signal delay at 17:46 at Central Transit Plaza with normal boarding.'
      );
    } else {
      setImgA((prev) => (prev?.name.includes('(DEMO A)') ? null : prev));
      setImgB((prev) => (prev?.name.includes('(DEMO B)') ? null : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  useEffect(() => {
    const tracked = blobUrlsRef.current;
    return () => {
      tracked.forEach((u) => URL.revokeObjectURL(u));
      tracked.clear();
    };
  }, []);

  const handleLoadCompareImage = async (slot: 'A' | 'B', file: File) => {
    const url = trackBlobUrl(URL.createObjectURL(file));
    const sha256 = await calculateSha256(file);
    let dims = { width: 0, height: 0 };
    try {
      dims = await readImageDimensions(file);
    } catch {
      // Ignore
    }
    const obj: LocalCompareImage = {
      name: file.name,
      url,
      size: file.size,
      mime: file.type || 'image/unknown',
      width: dims.width,
      height: dims.height,
      sha256,
    };
    if (slot === 'A') {
      setImgA((prev) => {
        revokeIfBlob(prev?.url);
        return obj;
      });
    } else {
      setImgB((prev) => {
        revokeIfBlob(prev?.url);
        return obj;
      });
    }
  };

  const handleClearImages = () => {
    setImgA((prev) => {
      revokeIfBlob(prev?.url);
      return null;
    });
    setImgB((prev) => {
      revokeIfBlob(prev?.url);
      return null;
    });
    setSyncZoom(1);
  };

  const toggleSyncVideos = () => {
    const a = vidARef.current;
    const b = vidBRef.current;
    if (!a || !b) return;
    if (vidPlaying) {
      a.pause();
      b.pause();
      setVidPlaying(false);
    } else {
      b.currentTime = a.currentTime;
      void a.play();
      void b.play();
      setVidPlaying(true);
    }
  };

  const hashMatch =
    imgA?.sha256 && imgB?.sha256 ? imgA.sha256 === imgB.sha256 : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
            Evidence Comparison Lab
          </h1>
          <p className="text-sm text-tl-muted mt-1">
            Compare two evidence files side-by-side using synchronized zoom, opacity overlay, pixel difference inspection, and hash verification.
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-md border border-tl-border bg-tl-panel">
          {(
            [
              ['image', 'Image', ImageIcon],
              ['text', 'Text', Type],
              ['video', 'Video', Film],
              ['audio', 'Audio', AudioWaveform],
            ] as const
          ).map(([key, label, Icon]) => {
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  active ? 'text-tl-cyan' : 'text-tl-muted hover:text-tl-text'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="comparison-mode-tab"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="absolute inset-0 rounded bg-tl-elevated border border-tl-cyan/40"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
      {/* IMAGE COMPARISON */}
      {mode === 'image' && (
        <motion.div
          key="compare-image"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: FORENSIC_EASE }}
          className="space-y-4"
        >
          <div className="rounded-lg border border-tl-border bg-tl-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputARef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLoadCompareImage('A', f);
                  e.target.value = '';
                }}
              />
              <input
                ref={inputBRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLoadCompareImage('B', f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => inputARef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan"
              >
                <Upload className="w-3.5 h-3.5 text-tl-cyan" />
                <span>Load Image A</span>
              </button>
              <button
                type="button"
                onClick={() => inputBRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-ice"
              >
                <Upload className="w-3.5 h-3.5 text-tl-ice" />
                <span>Load Image B</span>
              </button>
              {(imgA || imgB) && (
                <button
                  type="button"
                  onClick={handleClearImages}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-tl-border bg-tl-bg-secondary text-xs text-tl-muted hover:text-tl-text"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['side-by-side', 'Side-by-Side'],
                  ['overlay', 'Opacity Overlay'],
                  ['difference', 'Difference View'],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setImageMode(k)}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
                    imageMode === k
                      ? 'border-tl-cyan bg-tl-cyan/15 text-tl-cyan'
                      : 'border-tl-border bg-tl-bg-secondary text-tl-muted hover:text-tl-text'
                  }`}
                >
                  {lbl}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  onClick={() => setSyncZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                  aria-label="Zoom out synchronized view"
                  className="p-1.5 rounded border border-tl-border bg-tl-bg-secondary text-tl-muted hover:text-tl-text"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs text-tl-text w-12 text-center tabular-nums">
                  {Math.round(syncZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setSyncZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  aria-label="Zoom in synchronized view"
                  className="p-1.5 rounded border border-tl-border bg-tl-bg-secondary text-tl-muted hover:text-tl-text"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {!imgA || !imgB ? (
            <div className="rounded-lg border border-tl-border bg-tl-panel p-10 text-center text-xs text-tl-muted">
              <Columns2 className="w-7 h-7 text-tl-cyan mx-auto mb-2.5" />
              Load both Image A and Image B to perform side-by-side, opacity overlay, difference, and SHA-256 hash comparison.
            </div>
          ) : (
            <>
              {imageMode === 'side-by-side' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Image A', data: imgA, accent: 'text-tl-cyan' },
                    { label: 'Image B', data: imgB, accent: 'text-tl-ice' },
                  ].map((panel) => (
                    <div
                      key={panel.label}
                      className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden"
                    >
                      <div className="px-3.5 py-2 border-b border-tl-border flex items-center justify-between text-xs bg-tl-bg-secondary/60">
                        <span className={`font-semibold ${panel.accent}`}>{panel.label}</span>
                        <span className="font-mono text-[11px] text-tl-muted truncate max-w-[240px]">
                          {panel.data.name}
                        </span>
                      </div>
                      <div className="h-[340px] bg-[#06090F] overflow-hidden flex items-center justify-center">
                        <div style={{ transform: `scale(${syncZoom})` }} className="transition-transform">
                          <SafeMediaImage
                            src={panel.data.url}
                            alt={panel.data.name}
                            className="max-h-[320px] w-auto object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(imageMode === 'overlay' || imageMode === 'difference') && (
                <div className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-tl-border bg-tl-bg-secondary/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-tl-text">
                      {imageMode === 'overlay'
                        ? `Opacity Overlay (Image B opacity: ${overlayOpacity}%)`
                        : 'Visual Difference Blend (Dark = Identical Pixels, Bright = Delta)'}
                    </span>
                    {imageMode === 'overlay' && (
                      <div className="flex items-center gap-2">
                        <span className="text-tl-muted">A</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={overlayOpacity}
                          onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                          className="w-40 accent-[#37C8F5]"
                        />
                        <span className="text-tl-ice">B</span>
                      </div>
                    )}
                  </div>
                  <div className="h-[420px] bg-[#06090F] overflow-hidden flex items-center justify-center relative">
                    <div
                      className="relative inline-block transition-transform"
                      style={{ transform: `scale(${syncZoom})` }}
                    >
                      <SafeMediaImage
                        src={imgA.url}
                        alt={imgA.name}
                        className="max-h-[390px] w-auto object-contain block"
                      />
                      <img
                        src={imgB.url}
                        alt={imgB.name}
                        referrerPolicy="no-referrer"
                        style={{
                          opacity: imageMode === 'overlay' ? overlayOpacity / 100 : 1,
                          mixBlendMode: imageMode === 'difference' ? 'difference' : 'normal',
                        }}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata, Dimensions & Hash Comparison Table */}
              <div className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
                <div className="px-4 py-3 border-b border-tl-border flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-tl-text">
                    Metadata, Dimensions &amp; Integrity Comparison
                  </h2>
                  {hashMatch !== null && (
                    <span
                      className={`font-mono text-xs font-semibold ${
                        hashMatch ? 'text-tl-success' : 'text-tl-caution'
                      }`}
                    >
                      {hashMatch
                        ? '● Identical SHA-256 Digest (Bit-for-Bit Match)'
                        : '▲ Different SHA-256 Digests'}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-tl-border bg-tl-bg-secondary/60 text-tl-muted">
                        <th className="py-2.5 px-4">Attribute</th>
                        <th className="py-2.5 px-4 text-tl-cyan">Image A</th>
                        <th className="py-2.5 px-4 text-tl-ice">Image B</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tl-border/70 font-mono">
                      <tr>
                        <td className="py-2.5 px-4 text-tl-muted font-sans">Filename</td>
                        <td className="py-2.5 px-4 text-tl-text">{imgA.name}</td>
                        <td className="py-2.5 px-4 text-tl-text">{imgB.name}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 text-tl-muted font-sans">Dimensions</td>
                        <td className="py-2.5 px-4 text-tl-text tabular-nums">
                          {imgA.width} × {imgA.height} px
                        </td>
                        <td className="py-2.5 px-4 text-tl-text tabular-nums">
                          {imgB.width} × {imgB.height} px
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 text-tl-muted font-sans">File Size &amp; MIME</td>
                        <td className="py-2.5 px-4 text-tl-text tabular-nums">
                          {formatFileSize(imgA.size)} · {imgA.mime}
                        </td>
                        <td className="py-2.5 px-4 text-tl-text tabular-nums">
                          {formatFileSize(imgB.size)} · {imgB.mime}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 text-tl-muted font-sans">SHA-256</td>
                        <td className="py-2.5 px-4 text-tl-text break-all">
                          {imgA.sha256 || 'Unavailable'}
                        </td>
                        <td className="py-2.5 px-4 text-tl-text break-all">
                          {imgB.sha256 || 'Unavailable'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* TEXT COMPARISON */}
      {mode === 'text' && (
        <motion.div
          key="compare-text"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: FORENSIC_EASE }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="rounded-lg border border-tl-border bg-tl-panel p-4 space-y-2">
            <label className="text-xs font-semibold text-tl-cyan">Text Evidence A</label>
            <textarea
              rows={8}
              value={compareTextA}
              onChange={(e) => setCompareTextA(e.target.value)}
              placeholder="Paste first text evidence..."
              className="w-full rounded border border-tl-border bg-tl-bg-secondary p-3 text-xs text-tl-text outline-none focus:border-tl-cyan"
            />
          </div>
          <div className="rounded-lg border border-tl-border bg-tl-panel p-4 space-y-2">
            <label className="text-xs font-semibold text-tl-ice">Text Evidence B</label>
            <textarea
              rows={8}
              value={compareTextB}
              onChange={(e) => setCompareTextB(e.target.value)}
              placeholder="Paste second text evidence..."
              className="w-full rounded border border-tl-border bg-tl-bg-secondary p-3 text-xs text-tl-text outline-none focus:border-tl-cyan"
            />
          </div>
          <div className="md:col-span-2 rounded-lg border border-tl-border bg-tl-panel p-4 text-xs space-y-2">
            <div className="font-semibold text-tl-text">Token Difference Summary</div>
            <div className="font-mono text-tl-muted">
              Word count A: {compareTextA.trim() ? compareTextA.trim().split(/\s+/).length : 0} · Word count B:{' '}
              {compareTextB.trim() ? compareTextB.trim().split(/\s+/).length : 0} · Exact Match:{' '}
              {compareTextA.trim() === compareTextB.trim() ? 'Yes' : 'No'}
            </div>
          </div>
        </motion.div>
      )}

      {/* VIDEO COMPARISON */}
      {mode === 'video' && (
        <motion.div
          key="compare-video"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: FORENSIC_EASE }}
          className="space-y-4"
        >
          <NoticeCallout tone="info" title="Client-Side Synchronized Playback Only">
            This view aligns local HTML5 video playback in your browser for manual visual review. Automated video forensic analysis is currently under development.
          </NoticeCallout>
          <div className="rounded-lg border border-tl-border bg-tl-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-tl-border bg-tl-elevated hover:border-tl-cyan">
                <Upload className="w-3.5 h-3.5 text-tl-cyan" />
                <span>Load Video A</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const nextUrl = trackBlobUrl(URL.createObjectURL(f));
                      setVidAUrl((prev) => {
                        revokeIfBlob(prev);
                        return nextUrl;
                      });
                      setVidPlaying(false);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-tl-border bg-tl-elevated hover:border-tl-ice">
                <Upload className="w-3.5 h-3.5 text-tl-ice" />
                <span>Load Video B</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const nextUrl = trackBlobUrl(URL.createObjectURL(f));
                      setVidBUrl((prev) => {
                        revokeIfBlob(prev);
                        return nextUrl;
                      });
                      setVidPlaying(false);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              {(vidAUrl || vidBUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setVidAUrl((prev) => {
                      revokeIfBlob(prev);
                      return null;
                    });
                    setVidBUrl((prev) => {
                      revokeIfBlob(prev);
                      return null;
                    });
                    setVidPlaying(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-tl-border bg-tl-bg-secondary text-xs text-tl-muted hover:text-tl-text"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={!vidAUrl || !vidBUrl}
              onClick={toggleSyncVideos}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-tl-text text-tl-bg text-xs font-semibold disabled:opacity-40"
            >
              {vidPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{vidPlaying ? 'Pause Synchronized' : 'Play Synchronized'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-tl-border bg-tl-panel p-3">
              <div className="text-xs font-semibold text-tl-cyan mb-2">Video Panel A</div>
              {vidAUrl ? (
                <video
                  ref={vidARef}
                  src={vidAUrl}
                  controls
                  onEnded={() => setVidPlaying(false)}
                  onPause={() => setVidPlaying(false)}
                  className="w-full rounded bg-black max-h-72"
                />
              ) : (
                <div className="h-52 rounded border border-tl-border bg-tl-bg-secondary flex items-center justify-center text-xs text-tl-muted">
                  Load Video A to align playback
                </div>
              )}
            </div>
            <div className="rounded-lg border border-tl-border bg-tl-panel p-3">
              <div className="text-xs font-semibold text-tl-ice mb-2">Video Panel B</div>
              {vidBUrl ? (
                <video
                  ref={vidBRef}
                  src={vidBUrl}
                  controls
                  onEnded={() => setVidPlaying(false)}
                  onPause={() => setVidPlaying(false)}
                  className="w-full rounded bg-black max-h-72"
                />
              ) : (
                <div className="h-52 rounded border border-tl-border bg-tl-bg-secondary flex items-center justify-center text-xs text-tl-muted">
                  Load Video B to align playback
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* AUDIO COMPARISON (Honest Under Development Status) */}
      {mode === 'audio' && (
        <motion.div
          key="compare-audio"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: FORENSIC_EASE }}
          className="space-y-4"
        >
          <NoticeCallout tone="caution" title="Synchronized Audio Comparison — Under Development">
            Dual-channel acoustic waveform alignment and differential STFT spectrogram comparison depend on the upcoming Audio Forensics backend, which is not yet implemented.
          </NoticeCallout>
          <div className="rounded-lg border border-tl-border bg-tl-panel p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-tl-text">
                Audio Differential Comparison Engine
              </div>
              <p className="text-xs text-tl-muted mt-1">
                Planned capabilities: cross-correlated waveform alignment, duration delta, and differential frequency-band overlay.
              </p>
            </div>
            <StatusLabel status="Under Development" />
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};
