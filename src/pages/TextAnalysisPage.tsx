import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, FileText, MapPin, Plus, RotateCcw, Upload, User } from 'lucide-react';
import { useForensic } from '../context/ForensicContext';
import { NoticeCallout, StatusLabel } from '../components/ui/ForensicPrimitives';
import { generateId } from '../utils/cryptoAndValidation';

interface ContextStatement {
  id: string;
  bucket:
    | 'Observed Facts'
    | 'Claims'
    | 'Context Provided by User'
    | 'Possible Inconsistencies'
    | 'Unverified Statements';
  text: string;
  timestampRef?: string;
  sourceRef?: string;
}

const DEMO_TEXT_A =
  'On November 18, 2026 at 17:48, Tram Line 7 halted indefinitely at North Transit Plaza due to a structural power outage. Station officials evacuated all platforms and suspended commuter services until midnight.';

const DEMO_TEXT_B =
  'On November 18, 2026 between 17:46 and 17:55, Tram Line 7 experienced a 9-minute signal delay at Central Transit Plaza. Commuter boarding continued normally across all platforms with no evacuation ordered.';

const DEMO_STATEMENTS: ContextStatement[] = [
  {
    id: 'ST-1',
    bucket: 'Observed Facts',
    text: 'Photograph DEMO-EV-001 shows pedestrians walking normally across damp plaza paving with Tram 7 illuminated at the platform.',
    timestampRef: '17:48 local',
    sourceRef: 'DEMO-EV-001',
  },
  {
    id: 'ST-2',
    bucket: 'Claims',
    text: 'Social post claims an indefinite power outage and complete platform evacuation.',
    timestampRef: '18:05 UTC',
    sourceRef: 'Text A (Social Post)',
  },
  {
    id: 'ST-3',
    bucket: 'Possible Inconsistencies',
    text: 'Location name differs ("North Transit Plaza" vs "Central Transit Plaza") and evacuation claim conflicts with visible platform activity.',
    sourceRef: 'Text A vs Text B',
  },
  {
    id: 'ST-4',
    bucket: 'Unverified Statements',
    text: 'Duration of the reported 9-minute signal delay has not yet been independently corroborated by dispatch logs.',
    sourceRef: 'Text B (Bulletin)',
  },
];

interface DiffToken {
  word: string;
  status: 'same' | 'added' | 'removed';
}

function computeWordDiff(a: string, b: string): { left: DiffToken[]; right: DiffToken[] } {
  const wordsA = a.trim() ? a.trim().split(/\s+/) : [];
  const wordsB = b.trim() ? b.trim().split(/\s+/) : [];
  const setA = new Set(wordsA.map((w) => w.toLowerCase().replace(/[.,!?;:"]/g, '')));
  const setB = new Set(wordsB.map((w) => w.toLowerCase().replace(/[.,!?;:"]/g, '')));

  const left: DiffToken[] = wordsA.map((word) => {
    const clean = word.toLowerCase().replace(/[.,!?;:"]/g, '');
    return { word, status: setB.has(clean) ? 'same' : 'removed' };
  });

  const right: DiffToken[] = wordsB.map((word) => {
    const clean = word.toLowerCase().replace(/[.,!?;:"]/g, '');
    return { word, status: setA.has(clean) ? 'same' : 'added' };
  });

  return { left, right };
}

function extractEntities(text: string) {
  const dates = Array.from(
    new Set(
      text.match(
        /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?|\b\d{1,2}:\d{2}\b|\b\d{4}-\d{2}-\d{2}\b/gi
      ) || []
    )
  );
  const capitalized = Array.from(
    new Set(text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z0-9]+)+\b/g) || [])
  );
  return { dates, capitalized };
}

export const TextAnalysisPage: React.FC = () => {
  const { demoMode } = useForensic();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [textA, setTextA] = useState(demoMode ? DEMO_TEXT_A : '');
  const [textB, setTextB] = useState(demoMode ? DEMO_TEXT_B : '');
  const [sourceLabelA, setSourceLabelA] = useState(
    demoMode ? 'DEMO Source A (Sample Caption)' : 'Source Text A (Claim / Caption / OCR)'
  );
  const [sourceLabelB, setSourceLabelB] = useState(
    demoMode ? 'DEMO Source B (Sample Transit Log)' : 'Source Text B (Transcript / Reference Record)'
  );
  const [statements, setStatements] = useState<ContextStatement[]>(
    demoMode ? DEMO_STATEMENTS : []
  );
  const [usingDemoSample, setUsingDemoSample] = useState(demoMode);
  const [newBucket, setNewBucket] = useState<ContextStatement['bucket']>('Claims');
  const [newText, setNewText] = useState('');
  const [newSourceRef, setNewSourceRef] = useState('');

  useEffect(() => {
    if (demoMode) {
      setTextA(DEMO_TEXT_A);
      setTextB(DEMO_TEXT_B);
      setSourceLabelA('DEMO Source A (Sample Caption)');
      setSourceLabelB('DEMO Source B (Sample Transit Log)');
      setStatements(DEMO_STATEMENTS);
      setUsingDemoSample(true);
    } else if (usingDemoSample) {
      setTextA('');
      setTextB('');
      setSourceLabelA('Source Text A (Claim / Caption / OCR)');
      setSourceLabelB('Source Text B (Transcript / Reference Record)');
      setStatements([]);
      setUsingDemoSample(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const diff = useMemo(() => computeWordDiff(textA, textB), [textA, textB]);
  const entitiesA = useMemo(() => extractEntities(textA), [textA]);
  const entitiesB = useMemo(() => extractEntities(textB), [textB]);

  const handleUploadText = async (file: File) => {
    const content = await file.text();
    setTextA(content);
    setSourceLabelA(file.name);
    setUsingDemoSample(false);
  };

  const handleClear = () => {
    setTextA('');
    setTextB('');
    setSourceLabelA('Source Text A (Claim / Caption / OCR)');
    setSourceLabelB('Source Text B (Transcript / Reference Record)');
    setStatements([]);
    setUsingDemoSample(false);
  };

  const handleAddStatement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setStatements((prev) => [
      {
        id: generateId('ST'),
        bucket: newBucket,
        text: newText.trim(),
        sourceRef: newSourceRef.trim() || 'Investigator entry',
      },
      ...prev,
    ]);
    setNewText('');
    setNewSourceRef('');
  };

  const buckets: ContextStatement['bucket'][] = [
    'Observed Facts',
    'Claims',
    'Context Provided by User',
    'Possible Inconsistencies',
    'Unverified Statements',
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
              Text &amp; Context Analysis
            </h1>
            <StatusLabel status="Local Tool" />
          </div>
          <p className="text-sm text-tl-muted mt-1">
            Compare captions, transcripts, OCR excerpts, and source statements side-by-side while separating observed facts from unverified claims.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.srt,.vtt,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUploadText(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-xs font-medium text-tl-text hover:border-tl-cyan"
          >
            <Upload className="w-3.5 h-3.5 text-tl-cyan" />
            <span>Upload Text File</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTextA(DEMO_TEXT_A);
              setTextB(DEMO_TEXT_B);
              setSourceLabelA('DEMO Source A (Sample Caption)');
              setSourceLabelB('DEMO Source B (Sample Transit Log)');
              setStatements(DEMO_STATEMENTS);
              setUsingDemoSample(true);
            }}
            className="px-3.5 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-cyan"
          >
            Load DEMO Sample
          </button>
          {(textA || textB || statements.length > 0) && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tl-border bg-tl-panel text-xs font-medium text-tl-muted hover:text-tl-text hover:border-tl-muted"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {usingDemoSample && (
        <NoticeCallout tone="caution" title="DEMO Sample Text Loaded">
          The current text comparison contains sample demonstration fixtures, not real investigation evidence. Upload a file or clear the fields to analyze your own text.
        </NoticeCallout>
      )}

      <NoticeCallout tone="info" title="Contextual Comparison Only — External Verification Not Implemented">
        TruthLens performs local lexical comparison and structured investigator note organization. Textual differences between two sources do not imply misinformation on their own, and automated external web fact-checking is not implemented.
      </NoticeCallout>

      {/* 3-Panel Text Investigation Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL: Original Inputs */}
        <section className="xl:col-span-4 rounded-lg border border-tl-border bg-tl-panel p-4 space-y-4">
          <h2 className="font-display text-sm font-semibold text-tl-text">
            1. Text Evidence Inputs
          </h2>

          <div className="space-y-1.5">
            <input
              type="text"
              value={sourceLabelA}
              onChange={(e) => setSourceLabelA(e.target.value)}
              aria-label="Source A label"
              className="w-full rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1 text-xs font-medium text-tl-cyan outline-none"
            />
            <textarea
              rows={6}
              value={textA}
              onChange={(e) => setTextA(e.target.value)}
              placeholder="Paste primary claim, social media caption, subtitle, or OCR text..."
              className="w-full rounded-md border border-tl-border bg-tl-bg-secondary p-2.5 text-xs text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <input
              type="text"
              value={sourceLabelB}
              onChange={(e) => setSourceLabelB(e.target.value)}
              aria-label="Source B label"
              className="w-full rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1 text-xs font-medium text-tl-ice outline-none"
            />
            <textarea
              rows={6}
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
              placeholder="Paste reference statement, official transcript, or second text version to compare..."
              className="w-full rounded-md border border-tl-border bg-tl-bg-secondary p-2.5 text-xs text-tl-text placeholder:text-tl-muted focus:border-tl-cyan outline-none leading-relaxed"
            />
          </div>
        </section>

        {/* CENTER PANEL: Text A vs Text B Diff & Entity Extraction */}
        <section className="xl:col-span-4 rounded-lg border border-tl-border bg-tl-panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              2. Text A vs. Text B Comparison
            </h2>
            <span className="text-[11px] font-mono text-tl-muted">Word-level lexical diff</span>
          </div>

          {!textA.trim() && !textB.trim() ? (
            <div className="rounded border border-tl-border bg-tl-bg-secondary p-6 text-center text-xs text-tl-muted">
              <FileText className="w-6 h-6 text-tl-cyan mx-auto mb-2" />
              Enter text in both panels to inspect added, removed, and changed wording alongside extracted dates and named references.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded border border-tl-border bg-tl-bg-secondary p-3 space-y-2">
                <div className="text-[11px] font-semibold text-tl-cyan">{sourceLabelA}</div>
                <p className="text-xs leading-relaxed text-tl-text">
                  {diff.left.map((tok, i) => (
                    <span
                      key={i}
                      className={
                        tok.status === 'removed'
                          ? 'bg-tl-alert/20 text-tl-alert px-0.5 rounded mx-0.5 line-through'
                          : 'mx-0.5'
                      }
                    >
                      {tok.word}
                    </span>
                  ))}
                </p>
              </div>

              <div className="rounded border border-tl-border bg-tl-bg-secondary p-3 space-y-2">
                <div className="text-[11px] font-semibold text-tl-ice">{sourceLabelB}</div>
                <p className="text-xs leading-relaxed text-tl-text">
                  {diff.right.map((tok, i) => (
                    <span
                      key={i}
                      className={
                        tok.status === 'added'
                          ? 'bg-tl-success/20 text-tl-success px-0.5 rounded mx-0.5'
                          : 'mx-0.5'
                      }
                    >
                      {tok.word}
                    </span>
                  ))}
                </p>
              </div>

              {/* Extracted Dates, Times & Named Phrases */}
              <div className="rounded border border-tl-border bg-tl-bg-secondary p-3 space-y-2.5 text-xs">
                <div className="font-semibold text-tl-text">
                  Detected Dates, Times &amp; Named Entities
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <div className="text-[11px] text-tl-muted flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-tl-cyan" />
                      <span>Temporal References (A vs B)</span>
                    </div>
                    <div className="font-mono text-[11px] text-tl-text">
                      A: {entitiesA.dates.join(', ') || 'None detected'}
                    </div>
                    <div className="font-mono text-[11px] text-tl-ice mt-0.5">
                      B: {entitiesB.dates.join(', ') || 'None detected'}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-tl-border/70">
                    <div className="text-[11px] text-tl-muted flex items-center gap-1 mb-1">
                      <MapPin className="w-3 h-3 text-tl-caution" />
                      <User className="w-3 h-3 text-tl-caution" />
                      <span>Named Places / Entities (A vs B)</span>
                    </div>
                    <div className="font-mono text-[11px] text-tl-text">
                      A: {entitiesA.capitalized.join(', ') || 'None detected'}
                    </div>
                    <div className="font-mono text-[11px] text-tl-ice mt-0.5">
                      B: {entitiesB.capitalized.join(', ') || 'None detected'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: Context Analysis & Categorized Statements */}
        <section className="xl:col-span-4 rounded-lg border border-tl-border bg-tl-panel p-4 space-y-4">
          <h2 className="font-display text-sm font-semibold text-tl-text">
            3. Evidence Context &amp; Claim Separation
          </h2>

          <form onSubmit={handleAddStatement} className="space-y-2 pb-3 border-b border-tl-border">
            <select
              aria-label="Statement category"
              value={newBucket}
              onChange={(e) => setNewBucket(e.target.value as ContextStatement['bucket'])}
              className="w-full rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-xs text-tl-text outline-none"
            >
              {buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Log an observed fact, claim, user context, or possible inconsistency..."
              className="w-full rounded border border-tl-border bg-tl-bg-secondary p-2 text-xs text-tl-text placeholder:text-tl-muted outline-none focus:border-tl-cyan"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSourceRef}
                onChange={(e) => setNewSourceRef(e.target.value)}
                placeholder="Source ref (e.g., Text A, Transcript)"
                className="flex-1 rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-xs text-tl-text outline-none"
              />
              <button
                type="submit"
                disabled={!newText.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-tl-text text-tl-bg text-xs font-semibold disabled:opacity-45"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log</span>
              </button>
            </div>
          </form>

          <div className="space-y-3 max-h-[430px] overflow-y-auto">
            {buckets.map((bucket) => {
              const items = statements.filter((s) => s.bucket === bucket);
              return (
                <div key={bucket} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span
                      className={
                        bucket === 'Observed Facts'
                          ? 'text-tl-success'
                          : bucket === 'Possible Inconsistencies'
                            ? 'text-tl-caution'
                            : bucket === 'Unverified Statements'
                              ? 'text-tl-alert'
                              : 'text-tl-cyan'
                      }
                    >
                      {bucket}
                    </span>
                    <span className="font-mono text-tl-muted">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-[11px] text-tl-muted/80 pl-1">No entries logged.</p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded border border-tl-border bg-tl-bg-secondary p-2.5 text-xs space-y-1"
                      >
                        <p className="text-tl-text leading-relaxed">{item.text}</p>
                        <div className="font-mono text-[10px] text-tl-muted">
                          Ref: {item.sourceRef || 'Unspecified'}
                          {item.timestampRef ? ` · ${item.timestampRef}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
