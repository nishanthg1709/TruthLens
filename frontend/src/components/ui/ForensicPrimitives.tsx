import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  ShieldAlert,
  X,
} from 'lucide-react';
import { EvidenceAnalysisStatus, InvestigationStatus } from '../../types/forensics';
import { FORENSIC_EASE } from './MotionPrimitives';

export const StatusLabel: React.FC<{
  status:
    | EvidenceAnalysisStatus
    | InvestigationStatus
    | 'Connected'
    | 'Disconnected'
    | 'Checking'
    | 'Planned'
    | 'UI Ready'
    | 'Operational'
    | 'Under Development'
    | 'Not Yet Available'
    | 'Local Tool';
  className?: string;
}> = ({ status, className = '' }) => {
  const toneMap: Record<string, { color: string; glyph: string }> = {
    Operational: { color: 'text-tl-success', glyph: '●' },
    Analyzed: { color: 'text-tl-success', glyph: '●' },
    Completed: { color: 'text-tl-success', glyph: '●' },
    Connected: { color: 'text-tl-success', glyph: '●' },
    Active: { color: 'text-tl-cyan', glyph: '●' },
    Analyzing: { color: 'text-tl-cyan', glyph: '◐' },
    Checking: { color: 'text-tl-cyan', glyph: '◐' },
    'UI Ready': { color: 'text-tl-ice', glyph: '◆' },
    'Local Tool': { color: 'text-tl-ice', glyph: '◆' },
    'Requires Review': { color: 'text-tl-caution', glyph: '▲' },
    'In Review': { color: 'text-tl-caution', glyph: '▲' },
    Queued: { color: 'text-tl-caution', glyph: '◔' },
    'Under Development': { color: 'text-tl-muted', glyph: '◌' },
    'Not Yet Available': { color: 'text-tl-muted', glyph: '○' },
    Planned: { color: 'text-tl-muted', glyph: '○' },
    Unanalyzed: { color: 'text-tl-muted', glyph: '○' },
    Archived: { color: 'text-tl-muted', glyph: '□' },
    'Engine Unavailable': { color: 'text-tl-caution', glyph: '△' },
    Disconnected: { color: 'text-tl-alert', glyph: '✕' },
    Failed: { color: 'text-tl-alert', glyph: '✕' },
  };

  const style = toneMap[status] ?? { color: 'text-tl-muted', glyph: '○' };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${style.color} ${className}`}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {style.glyph}
      </span>
      <span>{status}</span>
    </span>
  );
};

export const HashCopyField: React.FC<{
  hash: string | null;
  originLabel?: string;
  compact?: boolean;
}> = ({ hash, originLabel, compact = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  if (!hash) {
    return (
      <span className="font-mono text-xs text-tl-muted">
        SHA-256 unavailable
      </span>
    );
  }

  const display = compact ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : hash;

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <code
          title={hash}
          className="font-mono text-xs text-tl-text tabular-nums truncate"
        >
          {display}
        </code>
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={handleCopy}
          aria-label="Copy SHA-256 hash"
          title="Copy full SHA-256 digest"
          className="p-1 rounded text-tl-muted hover:text-tl-cyan hover:bg-tl-elevated transition-colors shrink-0"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="copied"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="block"
              >
                <Check className="w-3.5 h-3.5 text-tl-success" />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="block"
              >
                <Copy className="w-3.5 h-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      {originLabel && (
        <span className="text-[11px] text-tl-muted">{originLabel}</span>
      )}
    </div>
  );
};

export const SafeMediaImage: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}> = ({ src, alt, className = '', fallbackLabel }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-tl-bg-secondary border border-tl-border text-tl-muted p-4 text-center ${className}`}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
          className="mb-2 text-tl-cyan/60"
        >
          <rect x="3" y="3" width="30" height="30" rx="3" stroke="currentColor" strokeWidth="1.25" />
          <path d="M3 13H33M3 23H33M13 3V33M23 3V33" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.45" />
          <circle cx="18" cy="18" r="4.5" stroke="currentColor" strokeWidth="1.25" />
        </svg>
        <span className="text-xs font-mono text-tl-muted">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export const EmptyStatePanel: React.FC<{
  title: string;
  description: string;
  icon?: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}> = ({ title, description, icon, primaryAction, secondaryAction }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.24, ease: FORENSIC_EASE }}
    className="border border-tl-border bg-tl-panel rounded-lg p-8 md:p-10 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-6"
  >
    {icon && (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.22, delay: 0.05, ease: FORENSIC_EASE }}
        className="w-11 h-11 rounded-md bg-tl-elevated border border-tl-border flex items-center justify-center text-tl-cyan mb-4"
      >
        {icon}
      </motion.div>
    )}
    <h3 className="font-display text-base font-semibold text-tl-text mb-1.5">
      {title}
    </h3>
    <p className="text-sm text-tl-muted max-w-md leading-relaxed mb-5">
      {description}
    </p>
    {(primaryAction || secondaryAction) && (
      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryAction && (
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={primaryAction.onClick}
            className="px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {primaryAction.label}
          </motion.button>
        )}
        {secondaryAction && (
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={secondaryAction.onClick}
            className="px-4 py-2 rounded-md border border-tl-border bg-tl-elevated text-tl-text text-xs font-medium hover:border-tl-cyan/60 transition-colors whitespace-nowrap"
          >
            {secondaryAction.label}
          </motion.button>
        )}
      </div>
    )}
  </motion.div>
);

export const NoticeCallout: React.FC<{
  tone: 'info' | 'caution' | 'alert' | 'success';
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ tone, title, children, action }) => {
  const styles = {
    info: {
      border: 'border-tl-cyan/35 bg-tl-cyan/5',
      icon: <Info className="w-4 h-4 text-tl-cyan shrink-0 mt-0.5" />,
      titleColor: 'text-tl-text',
    },
    caution: {
      border: 'border-tl-caution/40 bg-tl-caution/8',
      icon: <AlertTriangle className="w-4 h-4 text-tl-caution shrink-0 mt-0.5" />,
      titleColor: 'text-tl-caution',
    },
    alert: {
      border: 'border-tl-alert/45 bg-tl-alert/8',
      icon: <ShieldAlert className="w-4 h-4 text-tl-alert shrink-0 mt-0.5" />,
      titleColor: 'text-tl-alert',
    },
    success: {
      border: 'border-tl-success/40 bg-tl-success/8',
      icon: <CheckCircle2 className="w-4 h-4 text-tl-success shrink-0 mt-0.5" />,
      titleColor: 'text-tl-success',
    },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: FORENSIC_EASE }}
      className={`rounded-md border p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${styles.border}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {styles.icon}
        <div className="min-w-0">
          <div className={`text-xs font-semibold ${styles.titleColor}`}>{title}</div>
          <div className="text-xs text-tl-muted mt-0.5 leading-relaxed">{children}</div>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  );
};

export const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.18, ease: FORENSIC_EASE }}
          className="w-full max-w-md rounded-lg border border-tl-border bg-tl-panel p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 id="confirm-modal-title" className="font-display text-base font-semibold text-tl-text">
              {title}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close confirmation dialog"
              className="p-1 rounded text-tl-muted hover:text-tl-text hover:bg-tl-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-tl-muted leading-relaxed mb-5">{description}</p>
          <div className="flex items-center justify-end gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onCancel}
              className="px-3.5 py-2 rounded-md border border-tl-border bg-tl-elevated text-xs font-medium text-tl-text hover:border-tl-muted transition-colors"
            >
              {cancelLabel}
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-opacity hover:opacity-90 ${
                destructive ? 'bg-tl-alert text-white' : 'bg-tl-text text-tl-bg'
              }`}
            >
              {confirmLabel}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

