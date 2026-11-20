import React, { useRef, useState } from 'react';
import {
  Film,
  Upload,
  Play,
  Pause,
  Layers,
  Clock,
  ScanSearch,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { submitImageForForensicAnalysis } from '../services/imageAnalysisService';
import { ImageForensicResult } from '../types/forensics';
import { calculateSha256, formatFileSize } from '../utils/cryptoAndValidation';
import { NoticeCallout, StatusLabel } from '../components/ui/ForensicPrimitives';

interface ExtractedFrame {
  id: string;
  timestamp: number;
  timestampFormatted: string;
  thumbnailUrl: string;
  blob: Blob;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  result?: ImageForensicResult;
  error?: string;
}

export const VideoForensicsPage: React.FC = () => {
  const { settings, pushToast } = useForensic();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{
    duration: number;
    width: number;
    height: number;
    fileSize: number;
    sha256?: string;
  } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins.toString().padStart(2, '0')}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      pushToast({
        title: 'Invalid File Type',
        description: 'Please select a supported video container (MP4, WebM, MOV).',
        tone: 'alert',
      });
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    extractedFrames.forEach((f) => URL.revokeObjectURL(f.thumbnailUrl));
    setExtractedFrames([]);
    setSelectedFrameId(null);

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);

    // Compute SHA-256
    calculateSha256(file).then((sha256) => {
      setVideoMeta((prev) => (prev ? { ...prev, sha256 } : null));
    });

    pushToast({
      title: 'Video Loaded',
      description: `${file.name} (${formatFileSize(file.size)}) staged for frame analysis.`,
      tone: 'info',
    });
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !videoFile) return;
    setVideoMeta({
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
      fileSize: videoFile.size,
    });
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const extractSingleFrameAtTime = (targetTime: number): Promise<ExtractedFrame | null> => {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.src = videoUrl || '';
      v.crossOrigin = 'anonymous';
      v.currentTime = targetTime;

      v.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth || 640;
        canvas.height = v.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const frameId = `frame_${Date.now()}_${Math.round(targetTime * 100)}`;
            const frameUrl = URL.createObjectURL(blob);
            resolve({
              id: frameId,
              timestamp: targetTime,
              timestampFormatted: formatTimestamp(targetTime),
              thumbnailUrl: frameUrl,
              blob,
              status: 'pending',
            });
          },
          'image/jpeg',
          0.92
        );
      };

      v.onerror = () => resolve(null);
    });
  };

  const handleCaptureCurrentFrame = async () => {
    if (!videoRef.current || !videoUrl) return;
    const time = videoRef.current.currentTime;
    setIsExtracting(true);
    try {
      const frame = await extractSingleFrameAtTime(time);
      if (frame) {
        setExtractedFrames((prev) => [frame, ...prev]);
        setSelectedFrameId(frame.id);
        pushToast({
          title: 'Frame Captured',
          description: `Extracted still frame at ${frame.timestampFormatted}.`,
          tone: 'success',
        });
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAutoSampleFrames = async (count = 5) => {
    if (!videoMeta || !videoUrl) return;
    setIsExtracting(true);
    const duration = videoMeta.duration;
    const interval = duration / (count + 1);
    const sampleTimes: number[] = [];
    for (let i = 1; i <= count; i++) {
      sampleTimes.push(Math.round(interval * i * 100) / 100);
    }

    try {
      const newFrames: ExtractedFrame[] = [];
      for (const time of sampleTimes) {
        const frame = await extractSingleFrameAtTime(time);
        if (frame) newFrames.push(frame);
      }
      setExtractedFrames((prev) => [...newFrames, ...prev]);
      if (newFrames[0]) setSelectedFrameId(newFrames[0].id);
      pushToast({
        title: 'Frame Sampling Complete',
        description: `Extracted ${newFrames.length} distributed frames across ${formatTimestamp(duration)}.`,
        tone: 'success',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyzeFrame = async (frame: ExtractedFrame) => {
    setExtractedFrames((prev) =>
      prev.map((f) => (f.id === frame.id ? { ...f, status: 'analyzing', error: undefined } : f))
    );

    const frameFile = new File([frame.blob], `frame_${frame.timestampFormatted.replace(':', '_')}.jpg`, {
      type: 'image/jpeg',
    });

    try {
      const result = await submitImageForForensicAnalysis(frameFile, settings.apiBaseUrl);
      setExtractedFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, status: 'completed', result } : f))
      );
      pushToast({
        title: 'Frame Analysis Complete',
        description: `Forensic analysis complete for frame at ${frame.timestampFormatted}.`,
        tone: 'success',
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
      setExtractedFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, status: 'error', error: errorMsg } : f))
      );
      pushToast({
        title: 'Frame Analysis Failed',
        description: errorMsg,
        tone: 'alert',
      });
    }
  };

  const selectedFrame = extractedFrames.find((f) => f.id === selectedFrameId) || null;

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleVideoSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-tl-border pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
              Video Forensics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-tl-border bg-tl-panel">
              <StatusLabel status="Operational" />
            </span>
          </div>
          <p className="text-sm text-tl-muted leading-relaxed">
            Deterministic video frame extraction and still-frame forensic examination. Extract keyframes
            and audit spatial compression, sensor noise, and frequency distributions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-tl-text text-xs font-medium hover:border-tl-cyan hover:text-tl-cyan transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{videoFile ? 'Change Video' : 'Upload Video'}</span>
          </button>
          {videoFile && (
            <button
              type="button"
              disabled={isExtracting}
              onClick={() => handleAutoSampleFrames(5)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan hover:text-tl-cyan transition-colors disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5 text-tl-cyan" />
              <span>Sample 5 Frames</span>
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer Callout */}
      <NoticeCallout
        title="Forensic Scope & Methodology Notice"
        tone="info"
        description="Frame-level forensic examination evaluates still-frame compression (ELA), sensor noise residuals, and 2D spatial frequencies. It provides localized spatial evidence and does NOT constitute full video deepfake detection or temporal manipulation classification."
      />

      {/* Video Preview & Controls */}
      {videoUrl ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Video Player */}
          <div className="xl:col-span-7 space-y-4">
            <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
              <div className="px-4 py-2.5 border-b border-tl-border bg-tl-bg-secondary/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-tl-text">
                  <Film className="w-4 h-4 text-tl-muted" />
                  <span>{videoFile?.name}</span>
                </div>
                {videoMeta && (
                  <span className="font-mono text-[11px] text-tl-muted">
                    {videoMeta.width}×{videoMeta.height} px • {formatFileSize(videoMeta.fileSize)}
                  </span>
                )}
              </div>

              <div className="relative bg-black flex items-center justify-center max-h-[460px]">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls={false}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  className="w-full h-auto max-h-[460px] object-contain"
                />
              </div>

              {/* Transport Controls */}
              <div className="p-3 border-t border-tl-border bg-tl-bg-secondary/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-1.5 rounded border border-tl-border bg-tl-panel text-tl-text hover:text-tl-cyan"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="font-mono text-xs text-tl-text">
                    {formatTimestamp(currentTime)} / {formatTimestamp(videoMeta?.duration || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isExtracting}
                    onClick={handleCaptureCurrentFrame}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-tl-border bg-tl-panel text-xs text-tl-text hover:border-tl-cyan hover:text-tl-cyan"
                  >
                    <Clock className="w-3.5 h-3.5 text-tl-cyan" />
                    <span>Capture This Frame</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Extracted Frames Gallery */}
            <section className="rounded-lg border border-tl-border bg-tl-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-tl-text uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-tl-muted" />
                  <span>Extracted Frames ({extractedFrames.length})</span>
                </h3>
              </div>

              {extractedFrames.length === 0 ? (
                <div className="py-8 text-center text-xs text-tl-muted border border-dashed border-tl-border rounded">
                  No frames captured yet. Use &ldquo;Sample 5 Frames&rdquo; or scrub and click &ldquo;Capture This Frame&rdquo;.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {extractedFrames.map((frame) => {
                    const isSelected = frame.id === selectedFrameId;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => setSelectedFrameId(frame.id)}
                        className={`cursor-pointer rounded border p-2 space-y-1.5 transition-all ${
                          isSelected
                            ? 'border-tl-cyan bg-tl-cyan/10 ring-1 ring-tl-cyan'
                            : 'border-tl-border bg-tl-bg-secondary/40 hover:border-tl-border-hover'
                        }`}
                      >
                        <div className="aspect-video relative rounded overflow-hidden bg-black">
                          <img
                            src={frame.thumbnailUrl}
                            alt={`Frame at ${frame.timestampFormatted}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 font-mono text-[9px] text-white">
                            {frame.timestampFormatted}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono text-tl-muted">{frame.status}</span>
                          {frame.status === 'completed' && (
                            <CheckCircle2 className="w-3 h-3 text-tl-success" />
                          )}
                          {frame.status === 'analyzing' && (
                            <RefreshCw className="w-3 h-3 text-tl-cyan animate-spin" />
                          )}
                          {frame.status === 'error' && (
                            <AlertTriangle className="w-3 h-3 text-tl-alert" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Frame Analysis Results Panel */}
          <div className="xl:col-span-5 space-y-4">
            {selectedFrame ? (
              <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-tl-border pb-3">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-tl-text">
                      Frame Inspection at {selectedFrame.timestampFormatted}
                    </h3>
                    <p className="text-[11px] text-tl-muted">Sampled still frame</p>
                  </div>

                  {selectedFrame.status !== 'analyzing' && (
                    <button
                      type="button"
                      onClick={() => handleAnalyzeFrame(selectedFrame)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-tl-cyan bg-tl-cyan/15 text-xs font-medium text-tl-cyan hover:bg-tl-cyan/25"
                    >
                      <ScanSearch className="w-3.5 h-3.5" />
                      <span>{selectedFrame.result ? 'Re-analyze Frame' : 'Analyze Frame'}</span>
                    </button>
                  )}
                </div>

                <div className="rounded border border-tl-border overflow-hidden bg-black max-h-[220px] flex items-center justify-center">
                  <img
                    src={selectedFrame.thumbnailUrl}
                    alt={`Frame at ${selectedFrame.timestampFormatted}`}
                    className="w-full h-auto max-h-[220px] object-contain"
                  />
                </div>

                {selectedFrame.status === 'analyzing' && (
                  <div className="py-8 text-center text-xs text-tl-cyan flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Executing Error Level, Noise, and Frequency analysis on backend...</span>
                  </div>
                )}

                {selectedFrame.error && (
                  <div className="p-3 rounded border border-tl-alert/40 bg-tl-alert/10 text-xs text-tl-alert">
                    Analysis Error: {selectedFrame.error}
                  </div>
                )}

                {selectedFrame.result && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border border-tl-border bg-tl-bg-secondary/60 p-2.5">
                        <span className="text-[10px] text-tl-muted block">ELA Difference</span>
                        <strong className="text-tl-text font-mono text-xs">
                          {String(selectedFrame.result.domains.find(d => d.domainKey === 'compression')?.technicalValues['mean_difference'] ?? 'Analyzed')}
                        </strong>
                      </div>
                      <div className="rounded border border-tl-border bg-tl-bg-secondary/60 p-2.5">
                        <span className="text-[10px] text-tl-muted block">Noise Residual Std</span>
                        <strong className="text-tl-text font-mono text-xs">
                          {String(selectedFrame.result.domains.find(d => d.domainKey === 'noise')?.technicalValues['residual_std'] ?? 'Analyzed')}
                        </strong>
                      </div>
                    </div>

                    {selectedFrame.result.visualizations.elaDataUrl && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-tl-muted">ELA Difference Map</span>
                        <div className="rounded border border-tl-border overflow-hidden bg-black max-h-[160px] flex items-center justify-center">
                          <img
                            src={selectedFrame.result.visualizations.elaDataUrl}
                            alt="ELA visualization"
                            className="w-full h-auto max-h-[160px] object-contain"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-tl-muted">Findings & Observations</span>
                      <ul className="space-y-1 text-tl-text/90 pl-3 list-disc">
                        {selectedFrame.result.summaryObservations.slice(0, 4).map((obs, i) => (
                          <li key={i}>{obs}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 border-t border-tl-border text-[11px] text-tl-muted">
                      <em>Limitations:</em> Still-frame artifacts can originate from lossy video codec GOP compression (I/B/P-frames), bit-rate spikes, or motion blur.
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <div className="rounded-lg border border-tl-border bg-tl-panel p-8 text-center text-xs text-tl-muted">
                Select an extracted frame to view details and execute forensic analysis.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <section className="rounded-lg border border-tl-border bg-tl-panel p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-lg border border-tl-border bg-tl-bg-secondary mx-auto flex items-center justify-center text-tl-muted">
            <Film className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="font-display text-base font-semibold text-tl-text">
              No Video Staged for Analysis
            </h2>
            <p className="text-xs text-tl-muted leading-relaxed">
              Upload an MP4, WebM, or MOV video file to begin keyframe extraction and forensic still-frame analysis.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-tl-cyan text-xs font-semibold text-black hover:bg-tl-cyan/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Select Video File</span>
          </button>
        </section>
      )}
    </div>
  );
};
export default VideoForensicsPage;
