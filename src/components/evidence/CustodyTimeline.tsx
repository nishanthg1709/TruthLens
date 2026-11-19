import React from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { CustodyEvent, EvidenceItem } from '../../types/forensics';
import { formatFileSize, formatTimestamp } from '../../utils/cryptoAndValidation';
import { HashCopyField } from '../ui/ForensicPrimitives';

const ORIGIN_TEXT: Record<CustodyEvent['origin'], string> = {
  local_client: 'Calculated / recorded locally in browser',
  forensic_backend: 'Reported by forensic backend',
  investigator: 'User-entered record',
  demo_fixture: 'Demo fixture (non-operational)',
};

export const CustodyTimeline: React.FC<{ evidence: EvidenceItem }> = ({ evidence }) => {
  const hashOriginDescription =
    evidence.hashOrigin === 'local_sha256'
      ? 'Locally calculated SHA-256 (Web Crypto API)'
      : evidence.hashOrigin === 'server_sha256'
        ? 'Server-verified SHA-256 digest'
        : 'Hash unavailable';

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-tl-border bg-tl-bg-secondary p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-tl-text">
            <ShieldCheck className="w-4 h-4 text-tl-cyan" />
            <span>Evidence Integrity Record</span>
          </div>
          <span className="font-mono text-[11px] text-tl-muted">{evidence.id}</span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs pt-1 border-t border-tl-border/70">
          <div>
            <dt className="text-tl-muted">Original Filename</dt>
            <dd className="font-mono text-tl-text truncate" title={evidence.fileName}>
              {evidence.fileName}
            </dd>
          </div>
          <div>
            <dt className="text-tl-muted">File Size &amp; MIME</dt>
            <dd className="font-mono text-tl-text tabular-nums">
              {formatFileSize(evidence.fileSizeBytes)} · {evidence.mimeType}
            </dd>
          </div>
          <div>
            <dt className="text-tl-muted">Intake Timestamp</dt>
            <dd className="font-mono text-tl-text tabular-nums">
              {formatTimestamp(evidence.uploadedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-tl-muted">Analysis Version</dt>
            <dd className="font-mono text-tl-text">
              {evidence.analysisResult?.engineVersion || 'Not yet analyzed'}
            </dd>
          </div>
          <div className="sm:col-span-2 pt-1">
            <dt className="text-tl-muted mb-0.5">SHA-256 Integrity Digest</dt>
            <dd>
              <HashCopyField hash={evidence.sha256} originLabel={hashOriginDescription} />
            </dd>
          </div>
        </dl>

        <p className="text-[11px] text-tl-muted leading-relaxed pt-1 border-t border-tl-border/70">
          Session integrity tracking preserves original files unaltered in memory and records client-side timestamps. This prototype does not provide legally certified chain-of-custody sealing.
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-tl-text mb-2.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-tl-muted" />
          <span>Custody &amp; Activity Timeline</span>
        </h4>
        {evidence.custodyLog.length === 0 ? (
          <p className="text-xs text-tl-muted">No recorded custody events for this item.</p>
        ) : (
          <ol className="space-y-2.5 border-l border-tl-border ml-1.5 pl-4">
            {evidence.custodyLog.map((ev) => (
              <li key={ev.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-tl-cyan/80 border border-tl-bg"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-tl-text">{ev.action}</span>
                  <span className="font-mono text-[11px] text-tl-muted tabular-nums">
                    {formatTimestamp(ev.timestamp)}
                  </span>
                </div>
                <div className="text-[11px] text-tl-muted mt-0.5">
                  <span>{ev.actor}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{ORIGIN_TEXT[ev.origin]}</span>
                </div>
                {ev.details && (
                  <p className="text-xs text-tl-muted/90 mt-1 break-words">{ev.details}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
