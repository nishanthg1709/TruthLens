import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  MessageSquarePlus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useForensic } from '../context/ForensicContext';
import { FORENSIC_EASE } from '../components/ui/MotionPrimitives';
import { EvidenceItem, EvidenceMediaType, InvestigatorNote } from '../types/forensics';
import {
  calculateSha256,
  formatFileSize,
  formatTimestamp,
  generateId,
  readImageDimensions,
  validateImageFile,
} from '../utils/cryptoAndValidation';
import {
  ConfirmModal,
  EmptyStatePanel,
  HashCopyField,
  SafeMediaImage,
  StatusLabel,
} from '../components/ui/ForensicPrimitives';
import { CustodyTimeline } from '../components/evidence/CustodyTimeline';

export const InvestigationWorkspacePage: React.FC = () => {
  const { id: routeInvId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    investigations,
    evidence,
    demoMode,
    activeInvestigationId,
    setActiveInvestigationId,
    selectedEvidenceId,
    setSelectedEvidenceId,
    addEvidenceItem,
    addEvidenceNote,
    removeEvidenceItem,
    updateInvestigationStatus,
    pushToast,
  } = useForensic();

  const [typeFilter, setTypeFilter] = useState<'all' | EvidenceMediaType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [centerTab, setCenterTab] = useState<'preview' | 'custody'>('preview');
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState<InvestigatorNote['category']>('Observation');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const currentInvestigation = useMemo(() => {
    const targetId = routeInvId || activeInvestigationId;
    if (targetId) {
      const match = investigations.find((i) => i.id === targetId);
      if (match) return match;
    }
    return investigations[0] || null;
  }, [routeInvId, activeInvestigationId, investigations]);

  const caseEvidence = useMemo(() => {
    if (!currentInvestigation) return evidence;
    return evidence.filter((e) => e.investigationId === currentInvestigation.id);
  }, [currentInvestigation, evidence]);

  const filteredEvidence = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return caseEvidence.filter((item) => {
      if (typeFilter !== 'all' && item.mediaType !== typeFilter) return false;
      if (!q) return true;
      return (
        item.fileName.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.sha256 || '').toLowerCase().includes(q)
      );
    });
  }, [caseEvidence, typeFilter, searchQuery]);

  const selectedEvidence: EvidenceItem | null = useMemo(() => {
    if (selectedEvidenceId) {
      const found = caseEvidence.find((e) => e.id === selectedEvidenceId);
      if (found) return found;
    }
    return filteredEvidence[0] || caseEvidence[0] || null;
  }, [selectedEvidenceId, caseEvidence, filteredEvidence]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (demoMode) {
      pushToast({
        title: 'Switched to Live Workspace',
        description: 'Uploading real evidence exits Demo Mode to keep demo and real records strictly separated.',
        tone: 'info',
      });
    }

    for (const file of Array.from(files)) {
      const mediaType: EvidenceMediaType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'text';
      const evId = generateId('EV');
      const sha256 = await calculateSha256(file);
      const now = new Date().toISOString();
      let dimensions: EvidenceItem['dimensions'];
      let previewUrl: string | undefined;
      let textContent: string | undefined;

      if (mediaType === 'image') {
        const validation = await validateImageFile(file);
        if (!validation.valid) {
          pushToast({
            title: 'Image Validation Failed',
            description: `${file.name}: ${validation.errors[0]}`,
            tone: 'alert',
          });
          continue;
        }
        previewUrl = URL.createObjectURL(file);
        dimensions = validation.dimensions;
        if (!dimensions) {
          try {
            const d = await readImageDimensions(file);
            dimensions = {
              width: d.width,
              height: d.height,
              megapixels: Number(((d.width * d.height) / 1_000_000).toFixed(2)),
            };
          } catch {
            // Ignore
          }
        }
      } else if (mediaType === 'video' || mediaType === 'audio') {
        previewUrl = URL.createObjectURL(file);
      } else if (file.size < 250_000) {
        textContent = await file.text().catch(() => undefined);
      }

      const newEv: EvidenceItem = {
        id: evId,
        investigationId: demoMode ? null : currentInvestigation?.id || null,
        fileName: file.name,
        mediaType,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
        uploadedAt: now,
        sha256,
        hashOrigin: sha256 ? 'local_sha256' : 'unavailable',
        dimensions,
        previewUrl,
        textContent,
        analysisStatus: mediaType === 'image' ? 'Unanalyzed' : 'Engine Unavailable',
        notes: [],
        custodyLog: [
          {
            id: generateId('COC'),
            timestamp: now,
            action: 'Uploaded to Evidence Workspace',
            actor: 'Investigator Session',
            origin: 'local_client',
            details: `File size ${formatFileSize(file.size)}. Original file preserved unaltered.`,
          },
        ],
      };

      addEvidenceItem(newEv, file);
      setSelectedEvidenceId(evId);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidence || !noteText.trim()) return;
    if (selectedEvidence.isDemoData) {
      pushToast({
        title: 'Demo Fixture Read-Only',
        description: 'Disable Demo Mode and create a live investigation to record persistent investigator notes.',
        tone: 'caution',
      });
      return;
    }
    addEvidenceNote(selectedEvidence.id, {
      author: currentInvestigation?.investigator || 'Investigator',
      category: noteCategory,
      content: noteText.trim(),
    });
    setNoteText('');
  };

  const openSpecializedModule = (item: EvidenceItem) => {
    setSelectedEvidenceId(item.id);
    if (item.mediaType === 'image') navigate('/image-forensics');
    else if (item.mediaType === 'video') navigate('/video-forensics');
    else if (item.mediaType === 'audio') navigate('/audio-forensics');
    else navigate('/text-analysis');
  };

  const renderMediaIcon = (t: EvidenceMediaType) => {
    if (t === 'image') return <FileImage className="w-4 h-4 text-tl-cyan shrink-0" />;
    if (t === 'video') return <FileVideo className="w-4 h-4 text-tl-ice shrink-0" />;
    if (t === 'audio') return <FileAudio className="w-4 h-4 text-tl-caution shrink-0" />;
    return <FileText className="w-4 h-4 text-tl-muted shrink-0" />;
  };

  if (investigations.length === 0 && evidence.length === 0) {
    return (
      <EmptyStatePanel
        title="Your investigation workspace is ready."
        description="Create an investigation case or upload digital evidence to inspect metadata, SHA-256 digests, and forensic observations."
        icon={<FolderOpen className="w-5 h-5" />}
        primaryAction={{
          label: 'New Investigation',
          onClick: () => navigate('/new-investigation'),
        }}
        secondaryAction={{
          label: 'Open Image Forensics',
          onClick: () => navigate('/image-forensics'),
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Investigation Context Header Bar */}
      <div className="rounded-lg border border-tl-border bg-tl-panel p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Select active investigation"
              value={currentInvestigation?.id || ''}
              onChange={(e) => {
                setActiveInvestigationId(e.target.value);
                navigate(`/workspace/${e.target.value}`);
              }}
              className="rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1 font-mono text-xs text-tl-cyan focus:border-tl-cyan outline-none"
            >
              {investigations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.caseReference} — {inv.title}
                </option>
              ))}
            </select>
            {currentInvestigation && <StatusLabel status={currentInvestigation.status} />}
          </div>
          {currentInvestigation && (
            <div className="text-xs text-tl-muted flex flex-wrap items-center gap-2">
              <span>{currentInvestigation.category}</span>
              <span aria-hidden="true">·</span>
              <span>Investigator: {currentInvestigation.investigator}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Updated {formatTimestamp(currentInvestigation.updatedAt)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {currentInvestigation && !currentInvestigation.isDemoData && (
            <select
              aria-label="Update investigation status"
              value={currentInvestigation.status}
              onChange={(e) =>
                updateInvestigationStatus(
                  currentInvestigation.id,
                  e.target.value as typeof currentInvestigation.status
                )
              }
              className="rounded-md border border-tl-border bg-tl-elevated px-2.5 py-1.5 text-xs text-tl-text outline-none"
            >
              <option value="Active">Active</option>
              <option value="In Review">In Review</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleUploadFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Evidence</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-tl-cyan" />
            <span>Build Report</span>
          </button>
        </div>
      </div>

      {/* 3-Panel Evidence Investigation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT PANEL: Evidence List & Filters */}
        <section className="lg:col-span-3 rounded-lg border border-tl-border bg-tl-panel overflow-hidden flex flex-col">
          <div className="p-3 border-b border-tl-border space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xs font-semibold text-tl-text">
                Evidence Items ({filteredEvidence.length})
              </h2>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-tl-muted absolute left-2.5 top-2.5" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter filename or ID..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded border border-tl-border bg-tl-bg-secondary text-xs text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {(['all', 'image', 'video', 'audio', 'text'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-tl-elevated text-tl-cyan border border-tl-cyan/40'
                      : 'text-tl-muted hover:text-tl-text border border-transparent'
                  }`}
                >
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-tl-border/70 max-h-[540px] overflow-y-auto">
            {filteredEvidence.length === 0 ? (
              <div className="p-5 text-center text-xs text-tl-muted">
                No matching evidence items in this case.
              </div>
            ) : (
              filteredEvidence.map((item) => {
                const active = selectedEvidence?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedEvidenceId(item.id)}
                    className={`relative w-full text-left p-3 transition-colors ${
                      active ? 'bg-tl-elevated' : 'hover:bg-tl-elevated/40'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="workspace-evidence-indicator"
                        transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                        className="absolute inset-y-0 left-0 w-0.5 bg-tl-cyan"
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex items-start gap-2.5">
                      {renderMediaIcon(item.mediaType)}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-tl-text truncate">
                          {item.fileName}
                        </div>
                        <div className="font-mono text-[10px] text-tl-muted mt-0.5 tabular-nums">
                          {item.id} · {formatFileSize(item.fileSizeBytes)}
                        </div>
                        <div className="mt-1.5">
                          <StatusLabel status={item.analysisStatus} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* CENTER PANEL: Preview & Custody Workspace */}
        <section className="lg:col-span-5 rounded-lg border border-tl-border bg-tl-panel overflow-hidden">
          {!selectedEvidence ? (
            <div className="p-6">
              <EmptyStatePanel
                title="Add digital evidence to begin forensic examination."
                description="Upload an image, video, audio clip, or text document to inspect it inside this investigation."
                primaryAction={{
                  label: 'Upload Evidence',
                  onClick: () => fileInputRef.current?.click(),
                }}
              />
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-tl-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-tl-bg-secondary p-1 rounded-md border border-tl-border">
                  {(
                    [
                      ['preview', 'Evidence Inspection', false],
                      ['custody', 'Integrity & Custody', true],
                    ] as const
                  ).map(([key, label, hasIcon]) => {
                    const active = centerTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCenterTab(key)}
                        className={`relative px-3 py-1 rounded text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                          active ? 'text-tl-cyan' : 'text-tl-muted hover:text-tl-text'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="workspace-center-tab"
                            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                            className="absolute inset-0 rounded bg-tl-elevated border border-tl-cyan/30"
                            aria-hidden="true"
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center gap-1.5">
                          {hasIcon && <ShieldCheck className="w-3.5 h-3.5" />}
                          <span>{label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => openSpecializedModule(selectedEvidence)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tl-elevated border border-tl-cyan/40 text-xs font-medium text-tl-cyan hover:bg-tl-cyan/10 transition-colors whitespace-nowrap"
                >
                  <span>
                    {selectedEvidence.mediaType === 'image'
                      ? 'Open in Image Forensics'
                      : selectedEvidence.mediaType === 'text'
                        ? 'Open in Text Analysis'
                        : `View ${selectedEvidence.mediaType.charAt(0).toUpperCase() + selectedEvidence.mediaType.slice(1)} Module Status`}
                  </span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="p-4">
                <AnimatePresence mode="wait">
                  {centerTab === 'preview' ? (
                    <motion.div
                      key={`preview-${selectedEvidence.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: FORENSIC_EASE }}
                      className="space-y-4"
                    >
                      <div className="rounded-md border border-tl-border bg-[#070A10] overflow-hidden min-h-[280px] flex items-center justify-center">
                        {selectedEvidence.mediaType === 'image' ? (
                          <SafeMediaImage
                            src={selectedEvidence.previewUrl}
                            alt={selectedEvidence.fileName}
                            className="max-h-[400px] w-auto object-contain"
                            fallbackLabel={selectedEvidence.fileName}
                          />
                        ) : selectedEvidence.mediaType === 'video' ? (
                          selectedEvidence.previewUrl ? (
                            <video
                              src={selectedEvidence.previewUrl}
                              controls
                              className="w-full max-h-[380px]"
                            />
                          ) : (
                            <div className="p-8 text-center text-xs text-tl-muted">
                              Video binary not loaded in this session. Note: Video Forensics analysis is currently under development.
                            </div>
                          )
                        ) : selectedEvidence.mediaType === 'audio' ? (
                          <div className="p-6 w-full text-center space-y-3">
                            {selectedEvidence.previewUrl ? (
                              <audio src={selectedEvidence.previewUrl} controls className="w-full" />
                            ) : (
                              <p className="text-xs text-tl-muted">
                                Audio binary not loaded in this session. Note: Audio Forensics analysis is currently under development.
                              </p>
                            )}
                            <div className="font-mono text-[11px] text-tl-muted">
                              Duration: {selectedEvidence.durationSeconds ? `${selectedEvidence.durationSeconds}s` : 'Unknown'} · Sample Rate: {selectedEvidence.sampleRate ? `${selectedEvidence.sampleRate} Hz` : 'Unknown'}
                            </div>
                          </div>
                        ) : (
                          <pre className="p-4 w-full text-xs font-mono text-tl-text whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                            {selectedEvidence.textContent || 'No text content stored for this evidence file.'}
                          </pre>
                        )}
                      </div>

                      {selectedEvidence.analysisResult && (
                        <div className="rounded-md border border-tl-border bg-tl-bg-secondary p-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-tl-text">
                              Attached Analysis Summary
                            </span>
                            <span className="font-mono text-[11px] text-tl-cyan">
                              {selectedEvidence.analysisResult.analysisId}
                            </span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-tl-muted list-disc pl-4">
                            {selectedEvidence.analysisResult.summaryObservations.map((obs, idx) => (
                              <li key={idx}>{obs}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`custody-${selectedEvidence.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: FORENSIC_EASE }}
                    >
                      <CustodyTimeline evidence={selectedEvidence} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </section>

        {/* RIGHT PANEL: Metadata, Findings & Notes */}
        <section className="lg:col-span-4 rounded-lg border border-tl-border bg-tl-panel p-4 space-y-5">
          {!selectedEvidence ? (
            <p className="text-xs text-tl-muted">Select an evidence item to inspect details.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold text-tl-text truncate">
                    {selectedEvidence.fileName}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-tl-muted mt-0.5">
                    <span>{selectedEvidence.id}</span>
                    <span>·</span>
                    <StatusLabel status={selectedEvidence.analysisStatus} />
                  </div>
                </div>
                {!selectedEvidence.isDemoData && (
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(selectedEvidence.id)}
                    title="Remove evidence from workspace"
                    className="p-1.5 rounded text-tl-muted hover:text-tl-alert hover:bg-tl-elevated shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs border-t border-b border-tl-border py-3">
                <div>
                  <dt className="text-tl-muted">Type</dt>
                  <dd className="font-mono text-tl-text uppercase mt-0.5">
                    {selectedEvidence.mediaType}
                  </dd>
                </div>
                <div>
                  <dt className="text-tl-muted">File Size</dt>
                  <dd className="font-mono text-tl-text tabular-nums mt-0.5">
                    {formatFileSize(selectedEvidence.fileSizeBytes)}
                  </dd>
                </div>
                {selectedEvidence.dimensions && (
                  <div>
                    <dt className="text-tl-muted">Dimensions</dt>
                    <dd className="font-mono text-tl-text tabular-nums mt-0.5">
                      {selectedEvidence.dimensions.width}×{selectedEvidence.dimensions.height}px
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-tl-muted">Registered</dt>
                  <dd className="font-mono text-tl-text tabular-nums mt-0.5">
                    {formatTimestamp(selectedEvidence.uploadedAt).slice(0, 12)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-tl-muted mb-0.5">SHA-256 Digest</dt>
                  <dd>
                    <HashCopyField
                      hash={selectedEvidence.sha256}
                      compact
                      originLabel={
                        selectedEvidence.hashOrigin === 'local_sha256'
                          ? 'Calculated locally'
                          : selectedEvidence.hashOrigin === 'server_sha256'
                            ? 'Verified by backend'
                            : undefined
                      }
                    />
                  </dd>
                </div>
              </dl>

              {/* Investigator Notes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-tl-text flex items-center gap-1.5">
                    <MessageSquarePlus className="w-3.5 h-3.5 text-tl-cyan" />
                    <span>Investigator Notes ({selectedEvidence.notes.length})</span>
                  </h4>
                </div>

                <form onSubmit={handleAddNote} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Note category"
                      value={noteCategory}
                      onChange={(e) =>
                        setNoteCategory(e.target.value as InvestigatorNote['category'])
                      }
                      className="rounded border border-tl-border bg-tl-bg-secondary px-2 py-1 text-[11px] text-tl-text outline-none"
                    >
                      <option value="Observation">Observation</option>
                      <option value="Context">Context</option>
                      <option value="Manual Check">Manual Check</option>
                      <option value="Limitation">Limitation</option>
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Record contextual evidence, manual verification checks, or limitations..."
                    className="w-full rounded-md border border-tl-border bg-tl-bg-secondary px-2.5 py-2 text-xs text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none resize-y"
                  />
                  <button
                    type="submit"
                    disabled={!noteText.trim()}
                    className="px-3 py-1.5 rounded-md bg-tl-elevated border border-tl-border text-xs font-medium text-tl-text hover:border-tl-cyan hover:text-tl-cyan disabled:opacity-45 transition-colors"
                  >
                    Add Review Note
                  </button>
                </form>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {selectedEvidence.notes.length === 0 ? (
                    <p className="text-xs text-tl-muted">No review notes recorded yet.</p>
                  ) : (
                    selectedEvidence.notes.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-md border border-tl-border bg-tl-bg-secondary p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-medium text-tl-cyan">{n.category}</span>
                          <span className="font-mono text-tl-muted tabular-nums">
                            {formatTimestamp(n.createdAt).slice(0, 12)}
                          </span>
                        </div>
                        <p className="text-tl-text leading-relaxed">{n.content}</p>
                        <div className="text-[10px] text-tl-muted">— {n.author}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(deleteTargetId)}
        title="Remove Evidence from Workspace"
        description="This removes the selected evidence record and its local notes from your browser workspace. This action cannot be undone."
        confirmLabel="Remove Evidence"
        destructive
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) removeEvidenceItem(deleteTargetId);
          setDeleteTargetId(null);
        }}
      />
    </div>
  );
};
