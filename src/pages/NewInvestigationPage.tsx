import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Trash2,
  Upload,
} from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { EvidenceItem, EvidenceMediaType, InvestigationCategory } from '../types/forensics';
import {
  calculateSha256,
  formatFileSize,
  generateId,
  readImageDimensions,
} from '../utils/cryptoAndValidation';
import { NoticeCallout } from '../components/ui/ForensicPrimitives';

const CATEGORIES: InvestigationCategory[] = [
  'Media Verification',
  'Disinformation Review',
  'Deepfake Investigation',
  'Document & Provenance',
  'Incident Response',
  'Academic Research',
];

const MODULES = [
  { id: 'Image Forensics', note: 'Operational — FastAPI backend connected' },
  { id: 'Text & Context', note: 'Local Tool — client-side lexical comparison' },
  { id: 'Video Forensics', note: 'Under Development — engine not yet available' },
  { id: 'Audio Forensics', note: 'Under Development — engine not yet available' },
  { id: 'Cross-Modal Analysis', note: 'Not Yet Available — engine planned' },
];

interface PendingEvidence {
  item: Omit<EvidenceItem, 'investigationId'>;
  rawFile: File;
}

function detectMediaType(file: File): EvidenceMediaType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'text';
}

export const NewInvestigationPage: React.FC = () => {
  const { createInvestigation, registerSessionFile } = useForensic();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [caseReference, setCaseReference] = useState(
    `CASE-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 899))}`
  );
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<InvestigationCategory>('Media Verification');
  const [investigator, setInvestigator] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'Image Forensics',
    'Text & Context',
  ]);
  const [contextualNotes, setContextualNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingEvidence[]>([]);
  const [hashingBusy, setHashingBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleModule = (modId: string) => {
    setSelectedModules((prev) =>
      prev.includes(modId) ? prev.filter((m) => m !== modId) : [...prev, modId]
    );
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setHashingBusy(true);
    const additions: PendingEvidence[] = [];

    for (const file of Array.from(files)) {
      const mediaType = detectMediaType(file);
      const evId = generateId('EV');
      const sha256 = await calculateSha256(file);
      let dimensions: EvidenceItem['dimensions'];
      let previewUrl: string | undefined;
      let textContent: string | undefined;

      if (mediaType === 'image') {
        previewUrl = URL.createObjectURL(file);
        try {
          const d = await readImageDimensions(file);
          dimensions = {
            width: d.width,
            height: d.height,
            megapixels: Number(((d.width * d.height) / 1_000_000).toFixed(2)),
          };
        } catch {
          // Ignore unreadable dimensions
        }
      } else if (mediaType === 'video' || mediaType === 'audio') {
        previewUrl = URL.createObjectURL(file);
      } else if (file.size < 250_000) {
        try {
          textContent = await file.text();
        } catch {
          // Ignore non-text binary
        }
      }

      const now = new Date().toISOString();
      additions.push({
        rawFile: file,
        item: {
          id: evId,
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
              action: 'Evidence attached during case creation',
              actor: investigator.trim() || 'Investigator',
              origin: 'local_client',
              details: `Original file preserved in browser session (${formatFileSize(file.size)}).`,
            },
            ...(sha256
              ? [
                  {
                    id: generateId('COC'),
                    timestamp: now,
                    action: 'Local SHA-256 digest computed',
                    actor: 'Web Crypto API',
                    origin: 'local_client' as const,
                    details: sha256,
                  },
                ]
              : []),
          ],
          isDemoData: false,
        },
      });
    }

    setPendingFiles((prev) => [...prev, ...additions]);
    setHashingBusy(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a descriptive investigation title.');
      return;
    }
    if (!caseReference.trim()) {
      setFormError('Please provide a case or reference identifier.');
      return;
    }
    if (selectedModules.length === 0) {
      setFormError('Select at least one relevant analysis module.');
      return;
    }

    setFormError(null);
    pendingFiles.forEach((pf) => registerSessionFile(pf.item.id, pf.rawFile));

    const created = createInvestigation(
      {
        title: title.trim(),
        caseReference: caseReference.trim(),
        description: description.trim(),
        category,
        investigator: investigator.trim() || 'Unassigned Investigator',
        selectedModules,
        contextualNotes: contextualNotes.trim(),
      },
      pendingFiles.map((p) => p.item)
    );

    navigate(`/workspace/${created.id}`);
  };

  const getIcon = (t: EvidenceMediaType) => {
    if (t === 'image') return <FileImage className="w-4 h-4 text-tl-cyan shrink-0" />;
    if (t === 'video') return <FileVideo className="w-4 h-4 text-tl-ice shrink-0" />;
    if (t === 'audio') return <FileAudio className="w-4 h-4 text-tl-caution shrink-0" />;
    return <FileText className="w-4 h-4 text-tl-muted shrink-0" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
          New Investigation
        </h1>
        <p className="text-sm text-tl-muted mt-1">
          Initialize a forensic investigation case, register initial digital evidence with local SHA-256 hashing, and enter the Evidence Workspace.
        </p>
      </div>

      <NoticeCallout tone="info" title="Case Persistence & Media Privacy Notice">
        Case metadata created while signed in syncs to your Firebase account and is cached locally in your browser. Original media binaries remain strictly in your active browser session and are only transmitted when you explicitly submit an image to the FastAPI backend.
      </NoticeCallout>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <NoticeCallout tone="alert" title="Validation Required">
            {formError}
          </NoticeCallout>
        )}

        {/* Case Metadata */}
        <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-tl-text">
            1. Investigation Metadata
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="inv-title" className="block text-xs font-medium text-tl-text mb-1.5">
                Investigation Title <span className="text-tl-alert">*</span>
              </label>
              <input
                id="inv-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Transit Plaza Evening Photograph Authenticity Review"
                className="w-full rounded-md border border-tl-border bg-tl-bg-secondary px-3 py-2 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
              />
            </div>

            <div>
              <label htmlFor="inv-ref" className="block text-xs font-medium text-tl-text mb-1.5">
                Case / Reference ID <span className="text-tl-alert">*</span>
              </label>
              <input
                id="inv-ref"
                type="text"
                required
                value={caseReference}
                onChange={(e) => setCaseReference(e.target.value)}
                className="w-full rounded-md border border-tl-border bg-tl-bg-secondary px-3 py-2 font-mono text-sm text-tl-text focus:border-tl-cyan outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="inv-category" className="block text-xs font-medium text-tl-text mb-1.5">
                Investigation Category
              </label>
              <select
                id="inv-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as InvestigationCategory)}
                className="w-full rounded-md border border-tl-border bg-tl-bg-secondary px-3 py-2 text-sm text-tl-text focus:border-tl-cyan outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inv-analyst" className="block text-xs font-medium text-tl-text mb-1.5">
                Investigator Name or Team
              </label>
              <input
                id="inv-analyst"
                type="text"
                value={investigator}
                onChange={(e) => setInvestigator(e.target.value)}
                placeholder="e.g., A. Nair · Media Verification Unit"
                className="w-full rounded-md border border-tl-border bg-tl-bg-secondary px-3 py-2 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="inv-desc" className="block text-xs font-medium text-tl-text mb-1.5">
              Scope &amp; Description (Optional)
            </label>
            <textarea
              id="inv-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize the provenance question, media origin, and specific claims requiring verification."
              className="w-full rounded-md border border-tl-border bg-tl-bg-secondary px-3 py-2 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none resize-y"
            />
          </div>
        </section>

        {/* Analysis Modules */}
        <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-tl-text">
              2. Relevant Analysis Modules
            </h2>
            <p className="text-xs text-tl-muted mt-0.5">
              Select the workspaces applicable to this investigation.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {MODULES.map((mod) => {
              const active = selectedModules.includes(mod.id);
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => toggleModule(mod.id)}
                  className={`text-left rounded-md border p-3 transition-colors ${
                    active
                      ? 'border-tl-cyan bg-tl-cyan/10'
                      : 'border-tl-border bg-tl-bg-secondary hover:border-tl-muted'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-tl-text">{mod.id}</span>
                    {active && <CheckCircle2 className="w-3.5 h-3.5 text-tl-cyan shrink-0" />}
                  </div>
                  <div className="text-[11px] text-tl-muted mt-1">{mod.note}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Evidence Intake */}
        <section className="rounded-lg border border-tl-border bg-tl-panel p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-tl-text">
              3. Attach Initial Evidence (Optional)
            </h2>
            <p className="text-xs text-tl-muted mt-0.5">
              SHA-256 digests are calculated locally in your browser upon intake without altering original files.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              void handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            className={`rounded-md border border-dashed p-6 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-tl-cyan bg-tl-cyan/10'
                : 'border-tl-border bg-tl-bg-secondary hover:border-tl-cyan/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/*,audio/*,.txt,.md,.json,.srt,.vtt"
              onChange={(e) => {
                void handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <Upload className="w-6 h-6 text-tl-cyan mx-auto mb-2" />
            <div className="text-xs font-semibold text-tl-text">
              {hashingBusy ? 'Computing local SHA-256 hashes...' : 'Drop digital evidence files here or click to browse'}
            </div>
            <div className="text-[11px] text-tl-muted mt-1">
              Images (JPEG, PNG, WEBP up to 15 MB) · Video · Audio · Text transcripts
            </div>
          </div>

          {pendingFiles.length > 0 && (
            <ul className="divide-y divide-tl-border border border-tl-border rounded-md bg-tl-bg-secondary">
              {pendingFiles.map((pf) => (
                <li
                  key={pf.item.id}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getIcon(pf.item.mediaType)}
                    <div className="min-w-0">
                      <div className="font-medium text-tl-text truncate">{pf.item.fileName}</div>
                      <div className="font-mono text-[11px] text-tl-muted truncate">
                        {formatFileSize(pf.item.fileSizeBytes)}
                        {pf.item.dimensions
                          ? ` · ${pf.item.dimensions.width}×${pf.item.dimensions.height}px`
                          : ''}
                        {pf.item.sha256 ? ` · SHA-256: ${pf.item.sha256.slice(0, 14)}…` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (pf.item.previewUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(pf.item.previewUrl);
                      }
                      setPendingFiles((prev) => prev.filter((x) => x.item.id !== pf.item.id));
                    }}
                    aria-label={`Remove ${pf.item.fileName}`}
                    className="p-1.5 rounded text-tl-muted hover:text-tl-alert hover:bg-tl-elevated shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label htmlFor="inv-notes" className="block text-xs font-medium text-tl-text mb-1.5">
              Contextual Intake Notes
            </label>
            <textarea
              id="inv-notes"
              rows={2}
              value={contextualNotes}
              onChange={(e) => setContextualNotes(e.target.value)}
              placeholder="Document source URLs, submission timestamps, or external context provided by submitters."
              className="w-full rounded-md border border-tl-border bg-tl-bg-secondary px-3 py-2 text-sm text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none"
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="px-4 py-2 rounded-md border border-tl-border bg-tl-panel text-xs font-medium text-tl-text hover:border-tl-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={hashingBusy}
            className="px-5 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Create Investigation &amp; Open Workspace
          </button>
        </div>
      </form>
    </div>
  );
};
