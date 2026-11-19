import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  FORENSIC_EASE,
  ForensicCard,
  StaggerContainer,
  StaggerItem,
} from '../components/ui/MotionPrimitives';
import {
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Grid,
  HardDrive,
  List,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { EvidenceItem, EvidenceMediaType } from '../types/forensics';
import {
  calculateSha256,
  formatFileSize,
  formatShortDate,
  generateId,
  readImageDimensions,
  validateImageFile,
} from '../utils/cryptoAndValidation';
import {
  EmptyStatePanel,
  HashCopyField,
  SafeMediaImage,
  StatusLabel,
} from '../components/ui/ForensicPrimitives';
import { CustodyTimeline } from '../components/evidence/CustodyTimeline';

export const EvidenceVaultPage: React.FC = () => {
  const {
    evidence,
    investigations,
    demoMode,
    addEvidenceItem,
    assignEvidenceToInvestigation,
    setSelectedEvidenceId,
    globalSearchQuery,
    pushToast,
  } = useForensic();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState(globalSearchQuery);
  const [typeFilter, setTypeFilter] = useState<'all' | EvidenceMediaType>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'size'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetInvId, setTargetInvId] = useState<string>(investigations[0]?.id || '');
  const [inspectItem, setInspectItem] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    setQuery(globalSearchQuery);
  }, [globalSearchQuery]);

  useEffect(() => {
    if (investigations.length === 0) {
      setTargetInvId('');
    } else if (!investigations.some((inv) => inv.id === targetInvId)) {
      setTargetInvId(investigations[0].id);
    }
  }, [investigations, targetInvId]);

  useEffect(() => {
    if (!inspectItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectItem]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...evidence]
      .filter((e) => {
        if (typeFilter !== 'all' && e.mediaType !== typeFilter) return false;
        if (!q) return true;
        return (
          e.fileName.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.sha256 || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.fileName.localeCompare(b.fileName);
        if (sortBy === 'size') return b.fileSizeBytes - a.fileSizeBytes;
        return b.uploadedAt.localeCompare(a.uploadedAt);
      });
  }, [evidence, query, typeFilter, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleVaultUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let addedCount = 0;
    for (const file of Array.from(files)) {
      const mediaType: EvidenceMediaType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'text';
      let dimensions: EvidenceItem['dimensions'];
      let previewUrl: string | undefined;
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
      }
      const sha256 = await calculateSha256(file);
      const now = new Date().toISOString();

      addEvidenceItem(
        {
          id: generateId('EV'),
          investigationId: null,
          fileName: file.name,
          mediaType,
          mimeType: file.type || 'application/octet-stream',
          fileSizeBytes: file.size,
          uploadedAt: now,
          sha256,
          hashOrigin: sha256 ? 'local_sha256' : 'unavailable',
          dimensions,
          previewUrl,
          analysisStatus: mediaType === 'image' ? 'Unanalyzed' : 'Engine Unavailable',
          notes: [],
          custodyLog: [
            {
              id: generateId('COC'),
              timestamp: now,
              action: 'Ingested into Evidence Vault',
              actor: 'Client Intake',
              origin: 'local_client',
              details: 'Original file preserved unaltered; SHA-256 calculated locally.',
            },
          ],
        },
        file
      );
      addedCount += 1;
    }
    if (addedCount > 0) {
      pushToast({
        title: 'Evidence Added to Vault',
        description: `${addedCount} file(s) hashed locally and indexed.`,
        tone: 'success',
      });
    }
  };

  const handleOpenAnalysis = (item: EvidenceItem) => {
    setSelectedEvidenceId(item.id);
    if (item.mediaType === 'image') navigate('/image-forensics');
    else if (item.mediaType === 'video') navigate('/video-forensics');
    else if (item.mediaType === 'audio') navigate('/audio-forensics');
    else navigate('/text-analysis');
  };

  const getMediaIcon = (t: EvidenceMediaType) => {
    if (t === 'image') return <FileImage className="w-5 h-5 text-tl-cyan" />;
    if (t === 'video') return <FileVideo className="w-5 h-5 text-tl-ice" />;
    if (t === 'audio') return <FileAudio className="w-5 h-5 text-tl-caution" />;
    return <FileText className="w-5 h-5 text-tl-muted" />;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
            Evidence Vault
          </h1>
          <p className="text-sm text-tl-muted mt-1">
            Centralized digital evidence library with locally computed SHA-256 digests, integrity logs, and investigation linking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleVaultUpload(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add Evidence to Vault</span>
          </button>
        </div>
      </div>

      {/* Controls & Multi-Select Bar */}
      <div className="rounded-lg border border-tl-border bg-tl-panel p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-tl-muted absolute left-3 top-2.5" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search filename, evidence ID, or SHA-256..."
              className="w-full pl-8 pr-3 py-1.5 rounded border border-tl-border bg-tl-bg-secondary text-xs text-tl-text outline-none focus:border-tl-cyan"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {(['all', 'image', 'video', 'audio', 'text'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    typeFilter === t
                      ? 'bg-tl-elevated text-tl-cyan border border-tl-cyan/40'
                      : 'text-tl-muted hover:text-tl-text border border-transparent'
                  }`}
                >
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <select
              aria-label="Sort vault evidence"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-xs text-tl-text outline-none"
            >
              <option value="newest">Sort: Upload Date</option>
              <option value="name">Sort: Filename</option>
              <option value="size">Sort: File Size</option>
            </select>

            <div className="flex items-center rounded border border-tl-border bg-tl-bg-secondary p-0.5">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                className={`p-1.5 rounded ${view === 'grid' ? 'bg-tl-elevated text-tl-cyan' : 'text-tl-muted'}`}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="List view"
                className={`p-1.5 rounded ${view === 'list' ? 'bg-tl-elevated text-tl-cyan' : 'text-tl-muted'}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {selectedIds.length > 0 && !demoMode && (
          <div className="pt-3 border-t border-tl-border flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono text-tl-cyan">
              {selectedIds.length} evidence item(s) selected
            </span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Target investigation"
                value={targetInvId}
                onChange={(e) => setTargetInvId(e.target.value)}
                className="rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-xs text-tl-text"
              >
                {investigations.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.caseReference} — {inv.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!targetInvId}
                onClick={() => {
                  if (targetInvId) {
                    assignEvidenceToInvestigation(selectedIds, targetInvId);
                    setSelectedIds([]);
                  }
                }}
                className="px-3 py-1.5 rounded bg-tl-text text-tl-bg font-semibold disabled:opacity-45"
              >
                Add to Investigation
              </button>
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyStatePanel
          title="Add digital evidence to begin forensic examination."
          description="Your Evidence Vault holds original session media, local SHA-256 integrity digests, and cross-case references."
          icon={<HardDrive className="w-5 h-5" />}
          primaryAction={{
            label: 'Upload Evidence',
            onClick: () => fileInputRef.current?.click(),
          }}
        />
      ) : view === 'grid' ? (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const linkedInv = investigations.find((i) => i.id === item.investigationId);
            const checked = selectedIds.includes(item.id);
            return (
              <StaggerItem key={item.id}>
                <ForensicCard
                  className={`h-full rounded-lg border bg-tl-panel overflow-hidden flex flex-col transition-colors ${
                    checked ? 'border-tl-cyan' : 'border-tl-border hover:border-tl-cyan/50'
                  }`}
                >
                <div className="h-36 bg-[#070B12] relative overflow-hidden flex items-center justify-center border-b border-tl-border">
                  {item.mediaType === 'image' && item.previewUrl ? (
                    <SafeMediaImage
                      src={item.previewUrl}
                      alt={item.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-tl-muted">
                      {getMediaIcon(item.mediaType)}
                      <span className="font-mono text-[11px] uppercase">{item.mediaType}</span>
                    </div>
                  )}
                  {!demoMode && (
                    <label className="absolute top-2.5 left-2.5 bg-[#090D14]/80 rounded p-1 border border-tl-border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select ${item.fileName}`}
                        className="accent-[#37C8F5]"
                      />
                    </label>
                  )}
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3 text-xs">
                  <div className="space-y-1.5">
                    <div className="font-medium text-tl-text truncate" title={item.fileName}>
                      {item.fileName}
                    </div>
                    <div className="font-mono text-[11px] text-tl-muted">
                      {item.id} · {formatFileSize(item.fileSizeBytes)} · {formatShortDate(item.uploadedAt)}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <StatusLabel status={item.analysisStatus} />
                      <span className="font-mono text-[10px] text-tl-muted">
                        {item.hashOrigin === 'local_sha256'
                          ? 'SHA-256 (Local)'
                          : item.hashOrigin === 'server_sha256'
                            ? 'SHA-256 (Server)'
                            : 'No hash'}
                      </span>
                    </div>
                    <div className="text-[11px] text-tl-muted truncate">
                      Case: {linkedInv ? linkedInv.caseReference : 'Unassigned'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-tl-border/70">
                    <button
                      type="button"
                      onClick={() => handleOpenAnalysis(item)}
                      className="flex-1 py-1.5 px-2.5 rounded bg-tl-elevated border border-tl-border text-[11px] font-medium text-tl-cyan hover:border-tl-cyan inline-flex items-center justify-center gap-1"
                    >
                      <span>
                        {item.mediaType === 'image'
                          ? 'Analyze'
                          : item.mediaType === 'text'
                            ? 'Inspect'
                            : 'Module Status'}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectItem(item)}
                      className="py-1.5 px-2.5 rounded border border-tl-border text-[11px] text-tl-text hover:border-tl-cyan"
                    >
                      Integrity
                    </button>
                  </div>
                </div>
                </ForensicCard>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      ) : (
        <div className="rounded-lg border border-tl-border bg-tl-panel overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-tl-border bg-tl-bg-secondary/60 text-tl-muted">
                <th className="py-2.5 px-4 font-mono">ID</th>
                <th className="py-2.5 px-4">Filename</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4 text-right">Size</th>
                <th className="py-2.5 px-4">SHA-256</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tl-border/70">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-tl-elevated/40">
                  <td className="py-2.5 px-4 font-mono text-tl-ice">{item.id}</td>
                  <td className="py-2.5 px-4 font-medium text-tl-text max-w-[220px] truncate">
                    {item.fileName}
                  </td>
                  <td className="py-2.5 px-4 font-mono uppercase text-tl-muted">
                    {item.mediaType}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right tabular-nums text-tl-text">
                    {formatFileSize(item.fileSizeBytes)}
                  </td>
                  <td className="py-2.5 px-4">
                    <HashCopyField hash={item.sha256} compact />
                  </td>
                  <td className="py-2.5 px-4">
                    <StatusLabel status={item.analysisStatus} />
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAnalysis(item)}
                      className="text-tl-cyan hover:underline"
                    >
                      {item.mediaType === 'image'
                        ? 'Open Analysis'
                        : item.mediaType === 'text'
                          ? 'Open Text Tool'
                          : 'Module Status'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectItem(item)}
                      className="text-tl-muted hover:text-tl-text"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Integrity & Custody Modal Drawer */}
      <AnimatePresence>
        {inspectItem && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-end"
            onClick={() => setInspectItem(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: FORENSIC_EASE }}
              className="w-full max-w-lg h-full bg-tl-panel border-l border-tl-border p-5 overflow-y-auto space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-tl-border pb-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-tl-text">
                    Evidence Integrity &amp; Custody
                  </h2>
                  <p className="font-mono text-xs text-tl-muted">{inspectItem.fileName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectItem(null)}
                  aria-label="Close evidence details"
                  className="p-1.5 rounded text-tl-muted hover:text-tl-text hover:bg-tl-elevated"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <CustodyTimeline evidence={inspectItem} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
