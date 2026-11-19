import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { FORENSIC_EASE, ForensicScanOverlay } from '../components/ui/MotionPrimitives';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Grid2x2,
  Maximize2,
  Minimize2,
  Move,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BACKEND_LIMITS, REGION_IDS, TRUTHLENS_DISCLAIMER } from '../constants/assets';
import { useForensic } from '../context/ForensicContext';
import { submitImageForForensicAnalysis } from '../services/imageAnalysisService';
import { ForensicApiError } from '../services/api';
import { EvidenceItem, ImageForensicResult, RegionObservation } from '../types/forensics';
import {
  calculateSha256,
  formatFileSize,
  generateId,
  ImageValidationResult,
  validateImageFile,
} from '../utils/cryptoAndValidation';
import {
  HashCopyField,
  NoticeCallout,
  SafeMediaImage,
  StatusLabel,
} from '../components/ui/ForensicPrimitives';

type AnalysisViewMode = 'original' | 'ela' | 'noise' | 'frequency' | 'regional';
type FindingsTab = 'metadata' | 'compression' | 'noise' | 'frequency' | 'spatial';

export const ImageForensicsPage: React.FC = () => {
  const {
    demoMode,
    setDemoMode,
    evidence,
    selectedEvidenceId,
    setSelectedEvidenceId,
    activeInvestigationId,
    sessionFiles,
    registerSessionFile,
    addEvidenceItem,
    removeEvidenceItem,
    attachAnalysisResult,
    updateEvidenceStatus,
    backendHealth,
    refreshBackendHealth,
    settings,
    pushToast,
  } = useForensic();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const imageEvidenceList = useMemo(
    () => evidence.filter((e) => e.mediaType === 'image'),
    [evidence]
  );

  const activeEvidence: EvidenceItem | null = useMemo(() => {
    if (selectedEvidenceId) {
      const match = imageEvidenceList.find((e) => e.id === selectedEvidenceId);
      if (match) return match;
    }
    return imageEvidenceList[0] || null;
  }, [selectedEvidenceId, imageEvidenceList]);

  const [validation, setValidation] = useState<ImageValidationResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Canvas inspection state
  const [viewMode, setViewMode] = useState<AnalysisViewMode>('original');
  const [findingsTab, setFindingsTab] = useState<FindingsTab>('metadata');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [showRegionGrid, setShowRegionGrid] = useState(settings.showGridOverlayByDefault);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('r1_c2');

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  const currentResult: ImageForensicResult | null = activeEvidence?.analysisResult || null;

  const selectedRegion: RegionObservation | null = useMemo(() => {
    if (!currentResult) return null;
    return (
      currentResult.regions.find((r) => r.regionId === selectedRegionId) ||
      currentResult.regions[0] ||
      null
    );
  }, [currentResult, selectedRegionId]);

  const currentDomainBlock = useMemo(() => {
    if (!currentResult) return null;
    return currentResult.domains.find((d) => d.domainKey === findingsTab) || null;
  }, [currentResult, findingsTab]);

  // Workflow stage indicator
  const currentStage = useMemo(() => {
    if (!activeEvidence) return 1;
    if (validation && !validation.valid) return 2;
    if (isAnalyzing) return 5;
    if (currentResult) return 7;
    return 3;
  }, [activeEvidence, validation, isAnalyzing, currentResult]);

  const handleFileIntake = async (file: File) => {
    setApiError(null);
    const val = await validateImageFile(file);
    setValidation(val);

    if (!val.valid) {
      pushToast({
        title: 'Image Validation Failed',
        description: val.errors[0],
        tone: 'alert',
      });
      return;
    }

    const sha256 = await calculateSha256(file);

    // Duplicate upload handling: reuse existing non-demo evidence record with matching SHA-256
    if (sha256 && !demoMode) {
      const existing = imageEvidenceList.find(
        (item) => !item.isDemoData && item.sha256 === sha256
      );
      if (existing) {
        registerSessionFile(existing.id, file);
        setSelectedEvidenceId(existing.id);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setViewMode('original');
        pushToast({
          title: 'Duplicate Image Detected',
          description: `Selected existing record ${existing.id} with matching SHA-256 and refreshed the session file.`,
          tone: 'info',
        });
        return;
      }
    }

    const previewUrl = URL.createObjectURL(file);
    const evId = generateId('IMG');
    const now = new Date().toISOString();

    const newItem: EvidenceItem = {
      id: evId,
      investigationId: demoMode ? null : activeInvestigationId,
      fileName: file.name,
      mediaType: 'image',
      mimeType: file.type,
      fileSizeBytes: file.size,
      uploadedAt: now,
      sha256,
      hashOrigin: sha256 ? 'local_sha256' : 'unavailable',
      dimensions: val.dimensions,
      previewUrl,
      analysisStatus: 'Unanalyzed',
      analysisResult: null,
      notes: [],
      custodyLog: [
        {
          id: generateId('COC'),
          timestamp: now,
          action: 'Image validated & staged in Image Forensics',
          actor: 'Client Validator',
          origin: 'local_client',
          details: `${val.dimensions?.width}×${val.dimensions?.height} px (${val.dimensions?.megapixels} MP), ${formatFileSize(file.size)}.`,
        },
        ...(sha256
          ? [
              {
                id: generateId('COC'),
                timestamp: now,
                action: 'Local SHA-256 integrity hash calculated',
                actor: 'Web Crypto API',
                origin: 'local_client' as const,
                details: sha256,
              },
            ]
          : []),
      ],
    };

    addEvidenceItem(newItem, file);
    setSelectedEvidenceId(evId);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setViewMode('original');
    pushToast({
      title: 'Image Ready for Analysis',
      description: `${file.name} passed client validation against FastAPI limits.`,
      tone: 'success',
    });
  };

  const handleRunAnalysis = async () => {
    if (!activeEvidence) return;
    if (activeEvidence.isDemoData) {
      pushToast({
        title: 'Viewing Demo Fixture',
        description: 'Upload a real JPEG/PNG/WEBP image to submit to the FastAPI backend.',
        tone: 'caution',
      });
      return;
    }

    const fileToSend = sessionFiles[activeEvidence.id];
    if (!fileToSend) {
      setApiError(
        'Original image binary is no longer in browser memory after page reload. Please re-select the file to submit to the forensic engine.'
      );
      return;
    }

    setApiError(null);
    setIsAnalyzing(true);
    updateEvidenceStatus(activeEvidence.id, 'Analyzing');

    try {
      const result = await submitImageForForensicAnalysis(fileToSend, settings.apiBaseUrl);
      attachAnalysisResult(activeEvidence.id, result);
      pushToast({
        title: 'Forensic Analysis Completed',
        description: `Received ${result.independentDomainsAvailable} independent domain(s) from FastAPI backend.`,
        tone: 'success',
      });
    } catch (err) {
      updateEvidenceStatus(activeEvidence.id, 'Engine Unavailable');
      const message =
        err instanceof ForensicApiError
          ? err.message
          : 'TruthLens cannot reach the forensic engine. Your evidence has not been analyzed.';
      setApiError(message);
      void refreshBackendHealth();
      pushToast({
        title: 'Forensic Analysis Not Performed',
        description: message,
        tone: 'alert',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleRemoveActiveImage = () => {
    if (!activeEvidence || activeEvidence.isDemoData) return;
    removeEvidenceItem(activeEvidence.id);
    setValidation(null);
    setApiError(null);
    setViewMode('original');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const activeVisualizationUrl = useMemo(() => {
    if (!activeEvidence) return null;
    if (viewMode === 'original' || viewMode === 'regional') {
      return activeEvidence.previewUrl || null;
    }
    if (!currentResult) return null;
    if (viewMode === 'ela') return currentResult.visualizations.elaDataUrl || null;
    if (viewMode === 'noise') return currentResult.visualizations.noiseDataUrl || null;
    if (viewMode === 'frequency') return currentResult.visualizations.frequencyDataUrl || null;
    return null;
  }, [activeEvidence, viewMode, currentResult]);

  const stages = [
    '1. Select',
    '2. Validate',
    '3. Prepare',
    '4. Submit',
    '5. Process',
    '6. Results',
    '7. Review',
    '8. Report',
  ];

  const renderCanvasContent = () => (
    <div
      className={`relative overflow-hidden bg-[#06090F] select-none flex items-center justify-center ${
        fullscreen ? 'h-[calc(100vh-110px)]' : 'h-[430px] lg:h-[500px]'
      } ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
      onMouseDown={(e) => {
        if (zoom <= 1) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }}
      onMouseMove={(e) => {
        if (!isPanning) return;
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }}
      onMouseUp={() => setIsPanning(false)}
      onMouseLeave={() => setIsPanning(false)}
    >
      {!activeEvidence ? (
        <div className="p-8 text-center max-w-md">
          <Upload className="w-8 h-8 text-tl-cyan mx-auto mb-3" />
          <h3 className="font-display text-sm font-semibold text-tl-text">
            Select or drop an image to begin inspection
          </h3>
          <p className="text-xs text-tl-muted mt-1.5 leading-relaxed">
            Supported: JPEG, PNG, WEBP · Max {BACKEND_LIMITS.MAX_FILE_SIZE_MB} MB · Max{' '}
            {BACKEND_LIMITS.MAX_DIMENSION_PX.toLocaleString()} px · Max {BACKEND_LIMITS.MAX_MEGAPIXELS} MP.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90"
          >
            Choose Image File
          </button>
        </div>
      ) : activeVisualizationUrl ? (
        <div
          className="relative inline-block transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <SafeMediaImage
            src={activeVisualizationUrl}
            alt={`${activeEvidence.fileName} (${viewMode} view)`}
            className="max-h-[420px] lg:max-h-[470px] w-auto object-contain block pointer-events-none"
          />

          {/* 4x4 Interactive Regional Overlay */}
          {(viewMode === 'regional' || showRegionGrid) && (
            <div
              className="absolute inset-0 grid grid-cols-4 grid-rows-4"
              aria-label="4 by 4 forensic region inspection grid"
            >
              {REGION_IDS.map((rid) => {
                const regionData = currentResult?.regions.find((r) => r.regionId === rid);
                const isSelected = selectedRegionId === rid;
                const isFlagged = Boolean(regionData?.flagged && settings.highlightFlaggedRegions);

                return (
                  <button
                    key={rid}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRegionId(rid);
                      setFindingsTab('spatial');
                    }}
                    className={`relative border transition-colors text-left p-1 focus:outline-none ${
                      isSelected
                        ? 'border-tl-cyan bg-tl-cyan/20 z-10'
                        : isFlagged
                          ? 'border-tl-caution/80 bg-tl-caution/15 hover:bg-tl-caution/25'
                          : 'border-white/25 hover:border-tl-cyan/70 hover:bg-tl-cyan/10'
                    }`}
                    title={`Inspect region ${rid}${isFlagged ? ' — Requires Review' : ''}`}
                  >
                    {settings.showRegionIdsOnGrid && (
                      <span
                        className={`relative z-10 font-mono text-[10px] px-1 py-0.5 rounded bg-[#090D14]/80 ${
                          isSelected
                            ? 'text-tl-cyan font-semibold'
                            : isFlagged
                              ? 'text-tl-caution font-semibold'
                              : 'text-[#E7EDF5]/80'
                        }`}
                      >
                        {rid}
                      </span>
                    )}
                    {isSelected && (
                      <motion.span
                        layoutId="active-grid-reticle"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 border-2 border-tl-cyan bg-tl-cyan/10"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scanning beam ONLY during actual active backend submission */}
          <ForensicScanOverlay active={isAnalyzing} label="ANALYZING" />
        </div>
      ) : (
        <div className="p-8 text-center max-w-md space-y-2">
          <AlertTriangle className="w-7 h-7 text-tl-caution mx-auto" />
          <h3 className="font-display text-sm font-semibold text-tl-text">
            {viewMode === 'ela'
              ? 'Error Level Analysis Map Unavailable'
              : viewMode === 'noise'
                ? 'Noise Residual Map Unavailable'
                : '2D Frequency Spectrum Map Unavailable'}
          </h3>
          <p className="text-xs text-tl-muted leading-relaxed">
            {currentResult
              ? currentResult.isDemoData
                ? 'Demo fixture provides structured numeric & regional metrics without synthetic heatmap images. Connect to the live FastAPI backend to render real server-generated maps.'
                : 'The forensic backend response did not include an image visualization raster for this view mode. Structured observations remain available in the Findings panel below.'
              : 'Submit this image to the FastAPI forensic engine to generate domain visualizations.'}
          </p>
          <button
            type="button"
            onClick={() => setViewMode('original')}
            className="mt-2 px-3 py-1.5 rounded border border-tl-border bg-tl-elevated text-xs text-tl-text hover:border-tl-cyan"
          >
            Return to Original View
          </button>
        </div>
      )}

      {/* Corner HUD */}
      {activeEvidence && (
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none text-[11px] font-mono text-[#E7EDF5]/90">
          <span className="bg-[#090D14]/85 px-2 py-0.5 rounded border border-tl-border/80">
            VIEW: {viewMode.toUpperCase()} · ZOOM {Math.round(zoom * 100)}%
          </span>
          {activeEvidence.dimensions && (
            <span className="bg-[#090D14]/85 px-2 py-0.5 rounded border border-tl-border/80 tabular-nums">
              {activeEvidence.dimensions.width} × {activeEvidence.dimensions.height} px
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
            Image Forensics
          </h1>
          <p className="text-sm text-tl-muted mt-1">
            FastAPI-integrated photographic forensics: Metadata/EXIF, Error Level Analysis, Noise Residuals, 2D FFT, and 4×4 Regional Inspection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-xs font-medium text-tl-text hover:border-tl-cyan whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-tl-cyan" />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            onClick={() => void handleRunAnalysis()}
            disabled={!activeEvidence || isAnalyzing || Boolean(activeEvidence?.isDemoData)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 disabled:opacity-45 whitespace-nowrap"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            <span>{isAnalyzing ? 'Submitting to Engine...' : 'Submit to Forensic Engine'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-tl-cyan" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* 8-Stage Workflow Stepper */}
      <div className="rounded-md border border-tl-border bg-tl-panel px-3 py-2.5 overflow-x-auto">
        <ol className="flex items-center justify-between gap-2 min-w-[640px] text-[11px] font-mono">
          {stages.map((label, idx) => {
            const stepNum = idx + 1;
            const done = stepNum < currentStage;
            const active = stepNum === currentStage;
            return (
              <li
                key={label}
                className={`relative flex items-center gap-1.5 whitespace-nowrap pb-1 transition-colors ${
                  active
                    ? 'text-tl-cyan font-semibold'
                    : done
                      ? 'text-tl-success'
                      : 'text-tl-muted'
                }`}
              >
                <span aria-hidden="true">{done ? '✓' : active ? '●' : '○'}</span>
                <span>{label}</span>
                {active && (
                  <motion.span
                    layoutId="img-workflow-stage-line"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-tl-cyan rounded-full"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Backend Offline / Error Alert */}
      {(apiError || backendHealth.status === 'disconnected') && !demoMode && (
        <NoticeCallout
          tone={apiError ? 'alert' : 'caution'}
          title={
            apiError
              ? 'Forensic Analysis Not Performed'
              : 'Forensic Engine Offline (GET /health unreachable)'
          }
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshBackendHealth()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-tl-border bg-tl-panel text-xs font-medium text-tl-text hover:border-tl-cyan"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Health Check</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoMode(true)}
                className="px-3 py-1.5 rounded border border-tl-caution/50 text-xs font-medium text-tl-caution hover:bg-tl-caution/10"
              >
                Explore Demo Fixture
              </button>
            </div>
          }
        >
          {apiError ||
            `TruthLens cannot reach the forensic engine at ${backendHealth.apiBaseUrl}. Your evidence has not been analyzed. Start the FastAPI service or update the API URL in Settings.`}
        </NoticeCallout>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileIntake(f);
          e.target.value = '';
        }}
      />

      {/* Main Split Workspace: Canvas + Intake/Region Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left/Main 8 columns: Image Canvas & View Controls */}
        <div className="xl:col-span-8 space-y-4">
          {/* Drag-drop intake bar + evidence selector */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFileIntake(f);
            }}
            className={`rounded-lg border p-3.5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              dragActive
                ? 'border-tl-cyan bg-tl-cyan/10'
                : 'border-tl-border bg-tl-panel'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              {imageEvidenceList.length > 0 ? (
                <select
                  aria-label="Select image evidence"
                  value={activeEvidence?.id || ''}
                  onChange={(e) => {
                    setSelectedEvidenceId(e.target.value);
                    setApiError(null);
                    handleResetView();
                  }}
                  className="rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-xs font-mono text-tl-text max-w-[260px] outline-none focus:border-tl-cyan"
                >
                  {imageEvidenceList.map((img) => (
                    <option key={img.id} value={img.id}>
                      {img.fileName} ({img.id})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-tl-muted">
                  Drop JPEG, PNG, or WEBP here (max 15 MB, 12,000 px, 40 MP)
                </span>
              )}
              {activeEvidence && <StatusLabel status={activeEvidence.analysisStatus} />}
            </div>

            {activeEvidence && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-tl-muted tabular-nums">
                <span>{formatFileSize(activeEvidence.fileSizeBytes)}</span>
                <span>·</span>
                <span>{activeEvidence.mimeType.replace('image/', '').toUpperCase()}</span>
                {activeEvidence.dimensions && (
                  <>
                    <span>·</span>
                    <span>{activeEvidence.dimensions.megapixels} MP</span>
                  </>
                )}
                {!activeEvidence.isDemoData && (
                  <button
                    type="button"
                    onClick={handleRemoveActiveImage}
                    aria-label={`Remove ${activeEvidence.fileName}`}
                    title="Remove image from workspace"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-tl-border bg-tl-bg-secondary font-sans text-[11px] text-tl-muted hover:text-tl-alert hover:border-tl-alert/50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {validation && !validation.valid && (
            <NoticeCallout tone="alert" title="File Rejected by Client Validation">
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </NoticeCallout>
          )}

          {validation && validation.valid && validation.warnings.length > 0 && (
            <NoticeCallout tone="caution" title="Resolution Advisory">
              {validation.warnings.join(' ')}
            </NoticeCallout>
          )}

          {/* Main Image Workspace Frame */}
          <div className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
            {/* Toolbar */}
            <div className="px-3.5 py-2.5 border-b border-tl-border flex flex-wrap items-center justify-between gap-2 bg-tl-bg-secondary/60">
              {/* View mode segmented buttons */}
              <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Image analysis view mode">
                {(
                  [
                    ['original', 'Original'],
                    ['ela', 'Error Level Analysis'],
                    ['noise', 'Noise Residual'],
                    ['frequency', 'Frequency Analysis'],
                    ['regional', 'Regional Analysis'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === key}
                    onClick={() => {
                      setViewMode(key);
                      if (key === 'regional') setShowRegionGrid(true);
                    }}
                    className={`relative px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      viewMode === key
                        ? 'text-tl-cyan'
                        : 'text-tl-muted hover:text-tl-text'
                    }`}
                  >
                    {viewMode === key && (
                      <motion.span
                        layoutId="img-view-mode-tab"
                        transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                        aria-hidden="true"
                        className="absolute inset-0 rounded bg-tl-elevated border border-tl-cyan/40"
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                ))}
              </div>

              {/* Zoom & Grid controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowRegionGrid((g) => !g)}
                  aria-label="Toggle 4×4 region grid overlay"
                  aria-pressed={showRegionGrid || viewMode === 'regional'}
                  title="Toggle 4×4 region grid overlay"
                  className={`p-1.5 rounded border text-xs transition-colors ${
                    showRegionGrid || viewMode === 'regional'
                      ? 'border-tl-cyan/50 bg-tl-cyan/10 text-tl-cyan'
                      : 'border-tl-border bg-tl-panel text-tl-muted hover:text-tl-text'
                  }`}
                >
                  <Grid2x2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  aria-label="Zoom out"
                  title="Zoom out"
                  className="p-1.5 rounded border border-tl-border bg-tl-panel text-tl-muted hover:text-tl-text"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
                  aria-label="Zoom in"
                  title="Zoom in"
                  className="p-1.5 rounded border border-tl-border bg-tl-panel text-tl-muted hover:text-tl-text"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  aria-label="Fit and reset zoom"
                  title="Fit to screen / Reset zoom"
                  className="p-1.5 rounded border border-tl-border bg-tl-panel text-tl-muted hover:text-tl-text"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  aria-label="Fullscreen inspection"
                  title="Fullscreen inspection"
                  className="p-1.5 rounded border border-tl-border bg-tl-panel text-tl-muted hover:text-tl-text"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isAnalyzing && (
              <div className="px-4 py-2 bg-tl-cyan/10 border-b border-tl-cyan/30 flex items-center justify-between text-xs">
                <span className="text-tl-cyan font-medium">
                  Transmitting image to FastAPI forensic engine (POST /api/v1/analyze)...
                </span>
                <span className="font-mono text-tl-muted">Awaiting backend response</span>
              </div>
            )}

            {renderCanvasContent()}

            {/* Integrity Bar under canvas */}
            {activeEvidence && (
              <div className="px-4 py-2.5 border-t border-tl-border bg-tl-bg-secondary/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-tl-muted shrink-0">SHA-256:</span>
                  <HashCopyField hash={activeEvidence.sha256} compact />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-tl-muted">
                  <Move className="w-3 h-3" />
                  <span>Zoom &gt;100% to drag-pan · Click any 4×4 cell to inspect region</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 4 columns: Analysis Summary & Selected 4×4 Region Inspector */}
        <div className="xl:col-span-4 space-y-4">
          {/* Summary Card */}
          <section className="rounded-lg border border-tl-border bg-tl-panel p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-tl-text">
                Analysis Summary
              </h2>
              {currentResult && (
                <span className="font-mono text-[11px] text-tl-cyan">
                  {currentResult.analysisId}
                </span>
              )}
            </div>

            {!currentResult ? (
              <div className="py-4 space-y-2 text-xs text-tl-muted">
                <p>
                  No forensic engine output attached to this image yet. Submit to the FastAPI backend to evaluate Metadata, ELA, Noise Residuals, FFT Spectrum, and 4×4 Spatial Regions.
                </p>
                <div className="pt-2 border-t border-tl-border font-mono text-[11px] space-y-1">
                  <div>Endpoint: POST /api/v1/analyze</div>
                  <div>Max Size: 15 MB · Max 12,000 px · Max 40 MP</div>
                </div>
              </div>
            ) : (
              <>
                {currentResult.isDemoData && (
                  <div className="rounded border border-tl-caution/40 bg-tl-caution/10 px-2.5 py-1.5 font-mono text-[11px] text-tl-caution">
                    DEMO DATA — NOT A REAL FORENSIC ANALYSIS
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded border border-tl-border bg-tl-bg-secondary p-2.5">
                    <div className="text-[11px] text-tl-muted">Independent Domains</div>
                    <div className="font-mono text-lg font-semibold text-tl-cyan tabular-nums mt-0.5">
                      {currentResult.independentDomainsAvailable} / 4
                    </div>
                  </div>
                  <div className="rounded border border-tl-border bg-tl-bg-secondary p-2.5">
                    <div className="text-[11px] text-tl-muted">Regions for Review</div>
                    <div
                      className={`font-mono text-lg font-semibold tabular-nums mt-0.5 ${
                        currentResult.regionsRequiringReview > 0
                          ? 'text-tl-caution'
                          : 'text-tl-success'
                      }`}
                    >
                      {currentResult.regionsRequiringReview} / 16
                    </div>
                  </div>
                </div>

                <div className="text-xs text-tl-text bg-tl-bg-secondary border border-tl-border rounded p-2.5 leading-relaxed">
                  {currentResult.evidenceStrengthDescriptor}
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold text-tl-muted uppercase tracking-wide mb-1.5">
                    Observed Indicators
                  </h3>
                  <ul className="space-y-1.5 text-xs text-tl-text list-disc pl-4">
                    {currentResult.summaryObservations.map((obs, i) => (
                      <li key={i} className="leading-relaxed">
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold text-tl-muted uppercase tracking-wide mb-1.5">
                    Recommended Manual Checks
                  </h3>
                  <ul className="space-y-1 text-xs text-tl-muted list-disc pl-4">
                    {currentResult.recommendedManualChecks.map((chk, i) => (
                      <li key={i}>{chk}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </section>

          {/* 4x4 Region Inspector */}
          <section className="rounded-lg border border-tl-border bg-tl-panel p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-tl-text">
                4×4 Regional Inspector
              </h2>
              <span className="font-mono text-xs text-tl-cyan">{selectedRegionId}</span>
            </div>

            {/* Compact interactive 4x4 matrix selector */}
            <div className="grid grid-cols-4 gap-1">
              {REGION_IDS.map((rid) => {
                const reg = currentResult?.regions.find((r) => r.regionId === rid);
                const active = selectedRegionId === rid;
                return (
                  <button
                    key={rid}
                    type="button"
                    onClick={() => {
                      setSelectedRegionId(rid);
                      setShowRegionGrid(true);
                    }}
                    className={`py-1.5 rounded font-mono text-[11px] border transition-colors ${
                      active
                        ? 'border-tl-cyan bg-tl-cyan/20 text-tl-cyan font-semibold'
                        : reg?.flagged
                          ? 'border-tl-caution/60 bg-tl-caution/10 text-tl-caution'
                          : 'border-tl-border bg-tl-bg-secondary text-tl-muted hover:text-tl-text'
                    }`}
                  >
                    {rid}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {selectedRegion ? (
                <motion.div
                  key={selectedRegion.regionId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: FORENSIC_EASE }}
                  className="space-y-2.5 pt-2 border-t border-tl-border text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-tl-muted">Review Indicator</span>
                    <span
                      className={`font-medium ${
                        selectedRegion.flagged
                          ? 'text-tl-caution'
                          : selectedRegion.reviewLevel === 'Elevated'
                            ? 'text-tl-ice'
                            : 'text-tl-success'
                      }`}
                    >
                      {selectedRegion.reviewLevel}
                    </span>
                  </div>

                  {selectedRegion.deviationIndex !== undefined && (
                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                      <div className="rounded bg-tl-bg-secondary border border-tl-border px-2.5 py-1.5">
                        <span className="text-tl-muted block text-[10px]">Deviation Index</span>
                        <span className="text-tl-text tabular-nums">
                          {selectedRegion.deviationIndex.toFixed(2)} σ
                        </span>
                      </div>
                      <div className="rounded bg-tl-bg-secondary border border-tl-border px-2.5 py-1.5">
                        <span className="text-tl-muted block text-[10px]">Neighbor Contrast</span>
                        <span className="text-tl-text tabular-nums">
                          {selectedRegion.neighborContrast?.toFixed(2) ?? '—'}×
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedRegion.signals.length > 0 && (
                    <div>
                      <div className="text-[11px] text-tl-muted mb-1">Contributing Domain Signals</div>
                      <div className="text-xs text-tl-ice">
                        {selectedRegion.signals.join(' · ')}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] text-tl-muted mb-1">Observations</div>
                    <ul className="space-y-1 text-tl-text list-disc pl-4">
                      {selectedRegion.observations.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded bg-tl-bg-secondary border border-tl-border p-2.5 text-[11px] text-tl-muted leading-relaxed">
                    <strong className="text-tl-text">Limitation:</strong>{' '}
                    {selectedRegion.limitations[0]} A flagged region is a statistical comparison and never definitive proof of manipulation.
                  </div>
                </motion.div>
              ) : (
                <p className="text-xs text-tl-muted">
                  Run analysis to inspect region-level deviation metrics for {selectedRegionId}.
                </p>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>

      {/* Grouped Forensic Findings Panel */}
      <section className="rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-tl-border bg-tl-bg-secondary/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Forensic domain findings">
            {(
              [
                ['metadata', 'Metadata & Provenance'],
                ['compression', 'Compression & Recompression'],
                ['noise', 'Noise & Texture'],
                ['frequency', 'Frequency Spectrum'],
                ['spatial', 'Spatial Consistency (Supporting)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={findingsTab === key}
                onClick={() => setFindingsTab(key)}
                className={`relative px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  findingsTab === key
                    ? 'text-tl-cyan'
                    : 'text-tl-muted hover:text-tl-text'
                }`}
              >
                {findingsTab === key && (
                  <motion.span
                    layoutId="img-findings-tab"
                    transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded bg-tl-elevated border border-tl-cyan/40"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-tl-muted">
            {findingsTab === 'spatial'
              ? 'Supporting spatial observation (not independent)'
              : 'Independent evidence domain'}
          </span>
        </div>

        <div className="p-5">
          {!currentResult || !currentDomainBlock ? (
            <div className="text-xs text-tl-muted py-4">
              Domain-level forensic findings appear here once backend analysis completes.
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={findingsTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: FORENSIC_EASE }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-tl-text">
                      {currentDomainBlock.title}
                    </h3>
                    <span className="text-xs text-tl-muted">·</span>
                    <span className="text-xs font-mono text-tl-cyan">
                      {currentDomainBlock.isIndependentDomain
                        ? 'Independent Domain'
                        : 'Supporting Observation Only'}
                    </span>
                  </div>
                  <p className="text-sm text-tl-muted mt-1 leading-relaxed">
                    {currentDomainBlock.summary}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-tl-text mb-2">
                    Observations &amp; Indicators
                  </h4>
                  {currentDomainBlock.observations.length === 0 ? (
                    <p className="text-xs text-tl-muted">
                      No domain-specific anomaly indicators reported.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-xs text-tl-text">
                      {currentDomainBlock.observations.map((obs, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 rounded border border-tl-border bg-tl-bg-secondary px-3 py-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-tl-cyan shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{obs}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Frequency Spectrum Recharts Visualization */}
                {findingsTab === 'frequency' && currentResult.frequencyProfile.length > 0 && (
                  <div className="rounded-md border border-tl-border bg-tl-bg-secondary p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-tl-text">
                        Radial 2D FFT Energy Profile {currentResult.isDemoData ? '(Demo Data)' : ''}
                      </span>
                      <span className="font-mono text-[11px] text-tl-muted">
                        Normalized Nyquist Frequency
                      </span>
                    </div>
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={currentResult.frequencyProfile}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#282C34" />
                          <XAxis dataKey="band" stroke="#8E94A0" fontSize={11} />
                          <YAxis stroke="#8E94A0" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#16181C',
                              border: '1px solid #282C34',
                              fontSize: '12px',
                              color: '#F1F2F4',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="magnitude"
                            name="Observed Energy"
                            stroke="#54BDC9"
                            fill="#54BDC9"
                            fillOpacity={0.16}
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="referenceBaseline"
                            name="Typical Natural Roll-Off"
                            stroke="#8BB4D9"
                            fill="transparent"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Sanitized Metadata Table */}
                {findingsTab === 'metadata' && (
                  <div className="space-y-2">
                    {currentResult.gpsStrippedNotice && (
                      <div className="text-xs text-tl-caution flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Sensitive GPS / geolocation coordinate tags are automatically withheld from the UI for privacy and evidence safety.
                        </span>
                      </div>
                    )}
                    <div className="border border-tl-border rounded-md overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-tl-border/70">
                          {Object.entries(currentResult.sanitizedMetadata).map(([k, v]) => (
                            <tr key={k} className="bg-tl-bg-secondary/40">
                              <td className="py-2 px-3 font-mono text-tl-muted w-44">{k}</td>
                              <td className="py-2 px-3 font-mono text-tl-text">{String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-4">
                {/* Technical Values */}
                <div className="rounded-md border border-tl-border bg-tl-bg-secondary p-4">
                  <h4 className="text-xs font-semibold text-tl-text mb-2.5">
                    Reported Technical Values
                  </h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(currentDomainBlock.technicalValues).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] text-tl-muted">{k}</dt>
                        <dd className="font-mono text-tl-text tabular-nums mt-0.5">
                          {String(v ?? 'Unavailable')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Limitations */}
                <div className="rounded-md border border-tl-border bg-tl-bg-secondary p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-tl-caution">
                    Domain Limitations
                  </h4>
                  <ul className="space-y-1.5 text-xs text-tl-muted list-disc pl-4">
                    {currentDomainBlock.limitations.map((lim, i) => (
                      <li key={i} className="leading-relaxed">
                        {lim}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* Mandatory Disclaimer Footer */}
      <div className="rounded-md border border-tl-border bg-tl-bg-secondary px-4 py-3 text-xs text-tl-muted">
        <strong className="text-tl-text">Analytical Notice:</strong> {TRUTHLENS_DISCLAIMER}
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Fullscreen image inspection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-[#05080D]/95 flex flex-col"
          >
            <div className="h-14 px-4 border-b border-tl-border flex items-center justify-between">
              <span className="font-mono text-xs text-tl-text">
                {activeEvidence?.fileName} · Fullscreen Inspection ({Math.round(zoom * 100)}%)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  aria-label="Zoom out fullscreen image"
                  title="Zoom out"
                  className="p-1.5 rounded border border-tl-border text-tl-text"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  aria-label="Zoom in fullscreen image"
                  title="Zoom in"
                  className="p-1.5 rounded border border-tl-border text-tl-text"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  aria-label="Reset fullscreen zoom and pan"
                  title="Reset view"
                  className="p-1.5 rounded border border-tl-border text-tl-text"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-tl-elevated border border-tl-border text-xs text-tl-text"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Exit Fullscreen</span>
                </button>
              </div>
            </div>
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: FORENSIC_EASE }}
              className="flex-1 p-4"
            >
              {renderCanvasContent()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
