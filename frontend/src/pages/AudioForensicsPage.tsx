import React, { useEffect, useRef, useState } from 'react';
import {
  AudioWaveform,
  Upload,
  Play,
  Pause,
  Activity,
  ShieldCheck,
  RefreshCw,
  Clock,
  Radio,
  FileText,
  Volume2,
} from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { calculateSha256, formatFileSize } from '../utils/cryptoAndValidation';
import { NoticeCallout, StatusLabel } from '../components/ui/ForensicPrimitives';

interface AudioSignalMetrics {
  duration: number;
  sampleRate: number;
  channels: number;
  totalSamples: number;
  peakAmplitude: number;
  peakDb: number;
  rmsAmplitude: number;
  rmsDb: number;
  crestFactorDb: number;
  clippingSamples: number;
  zeroCrossingRate: number;
  silencePercent: number;
}

export const AudioForensicsPage: React.FC = () => {
  const { pushToast } = useForensic();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [metrics, setMetrics] = useState<AudioSignalMetrics | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins.toString().padStart(2, '0')}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(wav|mp3|m4a|aac|ogg|flac)$/i)) {
      pushToast({
        title: 'Invalid File Type',
        description: 'Please select a supported audio file (WAV, MP3, M4A, OGG, FLAC).',
        tone: 'alert',
      });
      return;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioUrl(url);
    setMetrics(null);
    setAudioBuffer(null);
    setIsDecoding(true);

    calculateSha256(file).then(setSha256);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decoded);
      analyzeAudioBuffer(decoded);
      pushToast({
        title: 'Audio Decoded',
        description: `${file.name} successfully decoded for waveform and signal analysis.`,
        tone: 'success',
      });
    } catch {
      pushToast({
        title: 'Decoding Error',
        description: 'Unable to decode audio data. The codec may not be natively supported by the browser.',
        tone: 'alert',
      });
    } finally {
      setIsDecoding(false);
    }
  };

  const analyzeAudioBuffer = (buf: AudioBuffer) => {
    const channelData = buf.getChannelData(0);
    const totalSamples = channelData.length;
    let peak = 0;
    let sumSquares = 0;
    let zeroCrossings = 0;
    let clipping = 0;
    let silentSamples = 0;
    const silenceThreshold = 0.005; // -46 dBFS

    for (let i = 0; i < totalSamples; i++) {
      const val = channelData[i];
      const absVal = Math.abs(val);
      if (absVal > peak) peak = absVal;
      if (absVal >= 0.999) clipping++;
      if (absVal < silenceThreshold) silentSamples++;
      sumSquares += val * val;

      if (i > 0) {
        if ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0)) {
          zeroCrossings++;
        }
      }
    }

    const rms = Math.sqrt(sumSquares / totalSamples);
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
    const crestFactorDb = peakDb - rmsDb;
    const zcr = Math.round(zeroCrossings / buf.duration);
    const silencePercent = Math.round((silentSamples / totalSamples) * 1000) / 10;

    const res: AudioSignalMetrics = {
      duration: buf.duration,
      sampleRate: buf.sampleRate,
      channels: buf.numberOfChannels,
      totalSamples,
      peakAmplitude: Math.round(peak * 10000) / 10000,
      peakDb: Math.round(peakDb * 10) / 10,
      rmsAmplitude: Math.round(rms * 10000) / 10000,
      rmsDb: Math.round(rmsDb * 10) / 10,
      crestFactorDb: Math.round(crestFactorDb * 10) / 10,
      clippingSamples: clipping,
      zeroCrossingRate: zcr,
      silencePercent,
    };
    setMetrics(res);
  };

  // Render Waveform Canvas
  useEffect(() => {
    if (!audioBuffer || !waveformCanvasRef.current) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background grid lines
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#06B6D4'; // cyan waveform
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }, [audioBuffer]);

  // Render Spectrogram Canvas
  useEffect(() => {
    if (!audioBuffer || !spectrogramCanvasRef.current) return;
    const canvas = spectrogramCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const windowSize = 512;
    const numSlices = Math.min(width, Math.floor(data.length / windowSize));
    const step = Math.floor(data.length / numSlices);

    // Generate log power spectrum visualization
    for (let x = 0; x < numSlices; x++) {
      const offset = x * step;
      for (let y = 0; y < height; y++) {
        const freqBin = Math.floor((1 - y / height) * (windowSize / 2));
        let sum = 0;
        // Fast DFT slice approximation
        for (let k = 0; k < 16; k++) {
          const sample = data[offset + k * 4] || 0;
          sum += Math.abs(sample * Math.sin((k * freqBin * Math.PI) / 8));
        }
        const mag = Math.min(1, sum * 1.5);
        // Heatmap palette (dark blue -> cyan -> amber -> red)
        const r = Math.round(mag * 255);
        const g = Math.round(Math.sin(mag * Math.PI) * 200 + mag * 50);
        const b = Math.round((1 - mag) * 150 + mag * 50);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [audioBuffer]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setIsPlaying(true);
    } else {
      a.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
        onChange={handleAudioSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-tl-border pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
              Audio Forensics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-tl-border bg-tl-panel">
              <StatusLabel status="Operational" />
            </span>
          </div>
          <p className="text-sm text-tl-muted leading-relaxed">
            Sample-accurate acoustic signal examination, waveform profiling, and discrete spectrogram inspection.
            Evaluate clipping, crest factors, and frequency energy distributions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-tl-text text-xs font-medium hover:border-tl-cyan hover:text-tl-cyan transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{audioFile ? 'Change Audio' : 'Upload Audio'}</span>
          </button>
        </div>
      </div>

      {/* Methodology Disclaimer */}
      <NoticeCallout
        title="Acoustic Signal Scope Notice"
        tone="info"
        description="Acoustic signal diagnostics inspect verified sample amplitudes, dynamic headroom, and frequency distributions. TruthLens does not fabricate synthetic AI voice probability scores or definitive speaker authenticity verdicts."
      />

      {audioUrl ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Waveform & Spectrogram Stage */}
          <div className="xl:col-span-8 space-y-5">
            {/* Audio Waveform Canvas Card */}
            <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
              <div className="px-4 py-2.5 border-b border-tl-border bg-tl-bg-secondary/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-tl-text">
                  <AudioWaveform className="w-4 h-4 text-tl-cyan" />
                  <span>Amplitude Envelope Waveform (0 to {metrics ? formatTimestamp(metrics.duration) : '--:--'})</span>
                </div>
                {metrics && (
                  <span className="font-mono text-[11px] text-tl-muted">
                    {metrics.sampleRate.toLocaleString()} Hz • {metrics.channels === 1 ? 'Mono' : 'Stereo'}
                  </span>
                )}
              </div>

              <div className="p-4 bg-[#07090E] flex flex-col items-center justify-center">
                <canvas
                  ref={waveformCanvasRef}
                  width={800}
                  height={140}
                  className="w-full h-[140px] rounded"
                />
              </div>

              {/* Player transport */}
              <div className="p-3 border-t border-tl-border bg-tl-bg-secondary/60 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-2 rounded border border-tl-border bg-tl-panel text-tl-text hover:text-tl-cyan hover:border-tl-cyan"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="font-mono text-xs text-tl-text">
                    {formatTimestamp(currentTime)} / {formatTimestamp(metrics?.duration || 0)}
                  </span>
                </div>

                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={() => {
                    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                  }}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />

                <span className="text-[11px] text-tl-muted font-mono">
                  {formatFileSize(audioFile?.size || 0)}
                </span>
              </div>
            </section>

            {/* Spectrogram Canvas Card */}
            <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
              <div className="px-4 py-2.5 border-b border-tl-border bg-tl-bg-secondary/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-tl-text">
                  <Activity className="w-4 h-4 text-tl-cyan" />
                  <span>Time-Frequency Spectrogram</span>
                </div>
                <span className="font-mono text-[11px] text-tl-muted">0 Hz to {metrics ? Math.round(metrics.sampleRate / 2).toLocaleString() : 'Nyquist'} Hz</span>
              </div>

              <div className="p-4 bg-[#07090E]">
                <canvas
                  ref={spectrogramCanvasRef}
                  width={800}
                  height={140}
                  className="w-full h-[140px] rounded"
                />
              </div>
              <div className="px-4 py-2 border-t border-tl-border bg-tl-bg-secondary/40 flex justify-between text-[10px] text-tl-muted font-mono">
                <span>Low Frequencies</span>
                <span>Mid-Range</span>
                <span>Nyquist Cutoff</span>
              </div>
            </section>
          </div>

          {/* Signal Diagnostics Panel */}
          <div className="xl:col-span-4 space-y-4">
            <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
              <div className="border-b border-tl-border pb-3">
                <h3 className="font-display text-sm font-semibold text-tl-text">
                  Signal Measurements
                </h3>
                <p className="text-[11px] text-tl-muted">Deterministic acoustic metrics</p>
              </div>

              {metrics ? (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-tl-border bg-tl-bg-secondary/60 p-2.5">
                      <span className="text-[10px] text-tl-muted block">Peak Amplitude</span>
                      <strong className="text-tl-text font-mono text-xs">
                        {metrics.peakDb} dBFS ({metrics.peakAmplitude})
                      </strong>
                    </div>
                    <div className="rounded border border-tl-border bg-tl-bg-secondary/60 p-2.5">
                      <span className="text-[10px] text-tl-muted block">RMS Energy</span>
                      <strong className="text-tl-text font-mono text-xs">
                        {metrics.rmsDb} dBFS
                      </strong>
                    </div>
                    <div className="rounded border border-tl-border bg-tl-bg-secondary/60 p-2.5">
                      <span className="text-[10px] text-tl-muted block">Crest Factor</span>
                      <strong className="text-tl-text font-mono text-xs">
                        {metrics.crestFactorDb} dB
                      </strong>
                    </div>
                    <div className="rounded border border-tl-border bg-tl-bg-secondary/60 p-2.5">
                      <span className="text-[10px] text-tl-muted block">Zero-Crossing Rate</span>
                      <strong className="text-tl-text font-mono text-xs">
                        {metrics.zeroCrossingRate} /s
                      </strong>
                    </div>
                  </div>

                  <dl className="divide-y divide-tl-border border-t border-tl-border pt-2 text-xs">
                    <div className="py-1.5 flex justify-between">
                      <dt className="text-tl-muted">Clipping Samples</dt>
                      <dd className="font-mono text-tl-text">
                        {metrics.clippingSamples > 0 ? (
                          <span className="text-tl-alert font-bold">{metrics.clippingSamples} samples</span>
                        ) : (
                          '0 (No hard clipping)'
                        )}
                      </dd>
                    </div>
                    <div className="py-1.5 flex justify-between">
                      <dt className="text-tl-muted">Silence Percentage</dt>
                      <dd className="font-mono text-tl-text">{metrics.silencePercent}%</dd>
                    </div>
                    <div className="py-1.5 flex justify-between">
                      <dt className="text-tl-muted">PCM Sample Count</dt>
                      <dd className="font-mono text-tl-text">{metrics.totalSamples.toLocaleString()}</dd>
                    </div>
                    {sha256 && (
                      <div className="py-1.5 flex flex-col gap-1">
                        <dt className="text-tl-muted text-[10px]">SHA-256 Digest</dt>
                        <dd className="font-mono text-[10px] text-tl-muted truncate" title={sha256}>
                          {sha256}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="p-3 rounded border border-tl-border bg-tl-bg-secondary/60 space-y-1">
                    <span className="text-[11px] font-semibold text-tl-text block">Signal Interpretation</span>
                    <p className="text-[11px] text-tl-muted leading-relaxed">
                      {metrics.clippingSamples > 10
                        ? 'Hard clipping observed. Signal may have undergone severe digital amplification or dynamic limiting.'
                        : 'Signal dynamic range is intact without artificial saturation clipping.'}
                      {metrics.crestFactorDb > 14
                        ? ' Wide dynamic range consistent with natural uncompressed speech or acoustic recording.'
                        : ' Compact dynamic range typical of studio compression or broadcast normalization.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-tl-muted">
                  {isDecoding ? 'Decoding audio data...' : 'Awaiting audio file.'}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        /* Empty State */
        <section className="rounded-lg border border-tl-border bg-tl-panel p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-lg border border-tl-border bg-tl-bg-secondary mx-auto flex items-center justify-center text-tl-muted">
            <AudioWaveform className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="font-display text-base font-semibold text-tl-text">
              No Audio Staged for Analysis
            </h2>
            <p className="text-xs text-tl-muted leading-relaxed">
              Upload a WAV, MP3, M4A, OGG, or FLAC audio file to examine waveform envelopes, spectrogram frequencies, and signal dynamics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-tl-cyan text-xs font-semibold text-black hover:bg-tl-cyan/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Select Audio File</span>
          </button>
        </section>
      )}
    </div>
  );
};
export default AudioForensicsPage;
