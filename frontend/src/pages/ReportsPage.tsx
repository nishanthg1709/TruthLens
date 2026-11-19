import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileJson, FileText, ShieldAlert } from 'lucide-react';
import { TRUTHLENS_DISCLAIMER } from '../constants/assets';
import { useForensic } from '../context/ForensicContext';
import {
  exportForensicReportJson,
  exportForensicReportPdf,
} from '../services/reportExportService';
import { ReportConfig } from '../types/forensics';
import { formatFileSize, formatTimestamp } from '../utils/cryptoAndValidation';
import { EmptyStatePanel } from '../components/ui/ForensicPrimitives';

const SECTION_LABELS: Array<{ key: keyof ReportConfig['sections']; num: string; label: string }> = [
  { key: 'cover', num: '01', label: 'Cover Header' },
  { key: 'investigationDetails', num: '02', label: 'Investigation Details' },
  { key: 'executiveSummary', num: '03', label: 'Executive Summary' },
  { key: 'evidenceInventory', num: '04', label: 'Evidence Inventory' },
  { key: 'fileIntegrity', num: '05', label: 'File Integrity (SHA-256)' },
  { key: 'analysisMethods', num: '06', label: 'Analysis Methods' },
  { key: 'observedIndicators', num: '07', label: 'Observed Indicators' },
  { key: 'regionObservations', num: '08', label: 'Region-Level Observations' },
  { key: 'supportingEvidence', num: '09', label: 'Supporting Evidence' },
  { key: 'crossModalObservations', num: '10', label: 'Cross-Modal Observations' },
  { key: 'limitations', num: '11', label: 'Limitations' },
  { key: 'alternativeExplanations', num: '12', label: 'Alternative Explanations' },
  { key: 'recommendedVerification', num: '13', label: 'Recommended Manual Verification' },
  { key: 'investigatorNotes', num: '14', label: 'Investigator Notes' },
  { key: 'conclusion', num: '15', label: 'Conclusion' },
];

export const ReportsPage: React.FC = () => {
  const {
    investigations,
    evidence,
    demoMode,
    activeInvestigationId,
    markReportGenerated,
    pushToast,
  } = useForensic();
  const navigate = useNavigate();

  const defaultInv =
    investigations.find((i) => i.id === activeInvestigationId) || investigations[0] || null;

  const [config, setConfig] = useState<ReportConfig>({
    title: defaultInv
      ? `Forensic Examination Report — ${defaultInv.title}`
      : 'TruthLens Digital Forensic Examination Report',
    investigationId: defaultInv?.id || '',
    reportDate: new Date().toISOString().slice(0, 10),
    preparedBy: defaultInv?.investigator || 'Investigator',
    selectedEvidenceIds: evidence.map((e) => e.id),
    investigatorNotes:
      'Review localized indicators carefully alongside original provenance records and environmental lighting context.',
    conclusionDraft:
      'Observed technical indicators require corroboration against original source media and independent contextual documentation prior to drawing operational conclusions.',
    sections: {
      cover: true,
      investigationDetails: true,
      executiveSummary: true,
      evidenceInventory: true,
      fileIntegrity: true,
      analysisMethods: true,
      observedIndicators: true,
      regionObservations: true,
      supportingEvidence: true,
      crossModalObservations: true,
      limitations: true,
      alternativeExplanations: true,
      recommendedVerification: true,
      investigatorNotes: true,
      conclusion: true,
    },
  });

  useEffect(() => {
    const validEvidenceIds = new Set(evidence.map((e) => e.id));
    const preferredInv =
      investigations.find((i) => i.id === activeInvestigationId) || investigations[0] || null;
    setConfig((prev) => {
      const preservedIds = prev.selectedEvidenceIds.filter((id) => validEvidenceIds.has(id));
      const nextEvidenceIds =
        preservedIds.length > 0 ? preservedIds : evidence.map((e) => e.id);
      const invStillExists = investigations.some((i) => i.id === prev.investigationId);
      const nextInv = invStillExists
        ? investigations.find((i) => i.id === prev.investigationId) || null
        : preferredInv;
      return {
        ...prev,
        investigationId: nextInv?.id || '',
        title:
          !invStillExists && nextInv
            ? `Forensic Examination Report — ${nextInv.title}`
            : prev.title,
        preparedBy:
          !invStillExists && nextInv?.investigator ? nextInv.investigator : prev.preparedBy,
        selectedEvidenceIds: nextEvidenceIds,
      };
    });
  }, [demoMode, evidence, investigations, activeInvestigationId]);

  const selectedInvestigation = useMemo(
    () => investigations.find((i) => i.id === config.investigationId) || null,
    [investigations, config.investigationId]
  );

  const selectedEvidence = useMemo(
    () => evidence.filter((e) => config.selectedEvidenceIds.includes(e.id)),
    [evidence, config.selectedEvidenceIds]
  );

  const toggleEvidenceSelection = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      selectedEvidenceIds: prev.selectedEvidenceIds.includes(id)
        ? prev.selectedEvidenceIds.filter((x) => x !== id)
        : [...prev.selectedEvidenceIds, id],
    }));
  };

  const toggleSection = (key: keyof ReportConfig['sections']) => {
    setConfig((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: !prev.sections[key] },
    }));
  };

  const handleExportJson = () => {
    try {
      exportForensicReportJson(config, selectedInvestigation, selectedEvidence, demoMode);
      if (selectedInvestigation && !demoMode) {
        markReportGenerated(selectedInvestigation.id);
      }
      pushToast({
        title: 'JSON Forensic Report Exported',
        description: 'Downloaded structured forensic dossier payload with disclaimer.',
        tone: 'success',
      });
    } catch {
      pushToast({
        title: 'JSON Export Failed',
        description: 'Unable to export JSON dossier in this browser environment.',
        tone: 'alert',
      });
    }
  };

  const handleExportPdf = () => {
    try {
      exportForensicReportPdf(config, selectedInvestigation, selectedEvidence, demoMode);
      if (selectedInvestigation && !demoMode) {
        markReportGenerated(selectedInvestigation.id);
      }
      pushToast({
        title: 'PDF Forensic Report Exported',
        description: 'Generated structured multi-section forensic dossier with disclaimer.',
        tone: 'success',
      });
    } catch {
      pushToast({
        title: 'Report Generation Failed',
        description: 'Unable to generate PDF document in this browser environment.',
        tone: 'alert',
      });
    }
  };

  if (evidence.length === 0 && investigations.length === 0) {
    return (
      <EmptyStatePanel
        title="Generate an evidence-backed report after reviewing your analysis."
        description="Create an investigation or analyze digital evidence first, or enable Demo Mode to preview a complete 15-section forensic document."
        icon={<FileText className="w-5 h-5" />}
        primaryAction={{
          label: 'Go to Image Forensics',
          onClick: () => navigate('/image-forensics'),
        }}
        secondaryAction={{
          label: 'New Investigation',
          onClick: () => navigate('/new-investigation'),
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-tl-text">
            Forensic Reports
          </h1>
          <p className="text-sm text-tl-muted mt-1">
            Configure, preview, and export explainable 15-section forensic examination reports grounded strictly in observed evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-tl-border bg-tl-panel text-xs font-medium text-tl-text hover:border-tl-cyan"
          >
            <FileJson className="w-3.5 h-3.5 text-tl-cyan" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT 4 cols: Configuration Controls */}
        <aside className="xl:col-span-4 space-y-4">
          <section className="rounded-lg border border-tl-border bg-tl-panel p-4 space-y-3 text-xs">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Report Configuration
            </h2>

            <div>
              <label className="block text-tl-muted mb-1">Report Title</label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-tl-text outline-none focus:border-tl-cyan"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-tl-muted mb-1">Investigation</label>
                <select
                  value={config.investigationId}
                  onChange={(e) => {
                    const inv = investigations.find((i) => i.id === e.target.value);
                    setConfig((p) => ({
                      ...p,
                      investigationId: e.target.value,
                      title: inv ? `Forensic Examination Report — ${inv.title}` : p.title,
                    }));
                  }}
                  className="w-full rounded border border-tl-border bg-tl-bg-secondary px-2 py-1.5 text-tl-text outline-none"
                >
                  <option value="">Standalone Report</option>
                  {investigations.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.caseReference}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-tl-muted mb-1">Report Date</label>
                <input
                  type="date"
                  value={config.reportDate}
                  onChange={(e) => setConfig((p) => ({ ...p, reportDate: e.target.value }))}
                  className="w-full rounded border border-tl-border bg-tl-bg-secondary px-2 py-1.5 font-mono text-tl-text outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-tl-muted mb-1">Prepared By</label>
              <input
                type="text"
                value={config.preparedBy}
                onChange={(e) => setConfig((p) => ({ ...p, preparedBy: e.target.value }))}
                className="w-full rounded border border-tl-border bg-tl-bg-secondary px-2.5 py-1.5 text-tl-text outline-none"
              />
            </div>

            <div>
              <div className="text-tl-muted mb-1.5">Include Evidence ({selectedEvidence.length})</div>
              <div className="space-y-1 max-h-36 overflow-y-auto border border-tl-border rounded bg-tl-bg-secondary p-2">
                {evidence.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={config.selectedEvidenceIds.includes(item.id)}
                      onChange={() => toggleEvidenceSelection(item.id)}
                      className="accent-[#37C8F5]"
                    />
                    <span className="truncate text-tl-text">{item.fileName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-tl-muted mb-1">Investigator Notes (Section 14)</label>
              <textarea
                rows={3}
                value={config.investigatorNotes}
                onChange={(e) => setConfig((p) => ({ ...p, investigatorNotes: e.target.value }))}
                className="w-full rounded border border-tl-border bg-tl-bg-secondary p-2 text-tl-text outline-none focus:border-tl-cyan"
              />
            </div>

            <div>
              <label className="block text-tl-muted mb-1">Conclusion Draft (Section 15)</label>
              <textarea
                rows={3}
                value={config.conclusionDraft}
                onChange={(e) => setConfig((p) => ({ ...p, conclusionDraft: e.target.value }))}
                className="w-full rounded border border-tl-border bg-tl-bg-secondary p-2 text-tl-text outline-none focus:border-tl-cyan"
              />
            </div>
          </section>

          {/* 15 Section Toggles */}
          <section className="rounded-lg border border-tl-border bg-tl-panel p-4 space-y-2.5 text-xs">
            <h2 className="font-display text-sm font-semibold text-tl-text">
              Document Sections (15)
            </h2>
            <div className="grid grid-cols-1 gap-1.5">
              {SECTION_LABELS.map((sec) => (
                <label
                  key={sec.key}
                  className="flex items-center justify-between gap-2 cursor-pointer px-2 py-1 rounded hover:bg-tl-elevated/50"
                >
                  <span className="text-tl-text">
                    <span className="font-mono text-tl-muted mr-1.5">{sec.num}.</span>
                    {sec.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={config.sections[sec.key]}
                    onChange={() => toggleSection(sec.key)}
                    className="accent-[#37C8F5]"
                  />
                </label>
              ))}
            </div>
          </section>
        </aside>

        {/* RIGHT 8 cols: Live Professional Forensic Document Preview */}
        <article className="xl:col-span-8 rounded-lg border border-tl-border bg-tl-panel overflow-hidden shadow-lg">
          {demoMode && (
            <div className="bg-tl-caution/15 border-b border-tl-caution/40 px-5 py-2 font-mono text-xs text-tl-caution font-semibold">
              DEMO DATA — NOT A REAL FORENSIC ANALYSIS
            </div>
          )}

          <div className="p-6 md:p-8 space-y-7 text-xs leading-relaxed">
            {/* 01. Cover */}
            {config.sections.cover && (
              <header className="rounded-md border border-tl-border bg-[#0A101B] p-6 space-y-2 text-[#E7EDF5]">
                <div className="font-mono text-[11px] text-[#37C8F5] tracking-wider">
                  TRUTHLENS DIGITAL FORENSIC EXAMINATION REPORT
                </div>
                <h2 className="font-display text-xl font-bold text-[#E7EDF5]">
                  {config.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#91A0B5] pt-2 border-t border-[#243348]">
                  <span>Date: {config.reportDate}</span>
                  <span>·</span>
                  <span>Prepared by: {config.preparedBy || 'Unspecified'}</span>
                  <span>·</span>
                  <span>
                    Case: {selectedInvestigation?.caseReference || 'Standalone Record'}
                  </span>
                </div>
              </header>
            )}

            {/* Mandatory Disclaimer */}
            <div className="rounded-md border border-tl-caution/45 bg-tl-caution/10 p-4 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-tl-caution shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-tl-caution">Mandatory Analytical Disclaimer</div>
                <p className="text-tl-text mt-1">{TRUTHLENS_DISCLAIMER}</p>
              </div>
            </div>

            {/* 02. Investigation Details */}
            {config.sections.investigationDetails && (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  02. Investigation Details
                </h3>
                {selectedInvestigation ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <dt className="text-tl-muted">Investigation ID</dt>
                      <dd className="font-mono text-tl-text">{selectedInvestigation.id}</dd>
                    </div>
                    <div>
                      <dt className="text-tl-muted">Case Reference</dt>
                      <dd className="font-mono text-tl-text">{selectedInvestigation.caseReference}</dd>
                    </div>
                    <div>
                      <dt className="text-tl-muted">Category &amp; Status</dt>
                      <dd className="text-tl-text">
                        {selectedInvestigation.category} · {selectedInvestigation.status}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-tl-muted">Last Updated</dt>
                      <dd className="font-mono text-tl-text">
                        {formatTimestamp(selectedInvestigation.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-tl-muted">Standalone examination report without a linked case record.</p>
                )}
              </section>
            )}

            {/* 03. Executive Summary */}
            {config.sections.executiveSummary && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  03. Executive Summary
                </h3>
                <p className="text-tl-muted">
                  This document compiles {selectedEvidence.length} evidence item(s), including{' '}
                  {selectedEvidence.filter((e) => Boolean(e.analysisResult)).length} item(s) with attached forensic domain outputs. All entries separate raw analytical observations from human interpretation and include known failure modes.
                </p>
              </section>
            )}

            {/* 04. Evidence Inventory */}
            {config.sections.evidenceInventory && (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  04. Evidence Inventory
                </h3>
                <div className="overflow-x-auto border border-tl-border rounded">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-tl-bg-secondary text-tl-muted">
                      <tr>
                        <th className="py-2 px-3">ID</th>
                        <th className="py-2 px-3">Filename</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3 text-right">Size</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tl-border/70">
                      {selectedEvidence.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 text-tl-ice">{item.id}</td>
                          <td className="py-2 px-3 text-tl-text">{item.fileName}</td>
                          <td className="py-2 px-3 uppercase text-tl-muted">{item.mediaType}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-tl-text">
                            {formatFileSize(item.fileSizeBytes)}
                          </td>
                          <td className="py-2 px-3 text-tl-text">{item.analysisStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 05. File Integrity */}
            {config.sections.fileIntegrity && (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  05. File Integrity Information
                </h3>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {selectedEvidence.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-tl-border bg-tl-bg-secondary p-2.5 break-all"
                    >
                      <div className="text-tl-text font-semibold">{item.fileName}</div>
                      <div className="text-tl-cyan mt-0.5">
                        SHA-256: {item.sha256 || 'Unavailable'}
                      </div>
                      <div className="text-tl-muted mt-0.5">
                        Hash Source:{' '}
                        {item.hashOrigin === 'local_sha256'
                          ? 'Calculated locally in browser'
                          : item.hashOrigin === 'server_sha256'
                            ? 'Reported by backend'
                            : 'Unavailable'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 06. Analysis Methods */}
            {config.sections.analysisMethods && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  06. Analysis Methods
                </h3>
                <p className="text-tl-muted">
                  Image forensic analysis inspects four independent domains (Metadata &amp; Provenance, Compression &amp; Recompression via ELA, Noise &amp; Texture Residuals, and 2D FFT Frequency Spectrum) plus a 4×4 Spatial Consistency grid used solely as a supporting localization view.
                </p>
              </section>
            )}

            {/* 07. Observed Indicators */}
            {config.sections.observedIndicators && (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  07. Observed Indicators
                </h3>
                {selectedEvidence.filter((e) => e.analysisResult).length === 0 ? (
                  <p className="text-tl-muted">
                    No completed backend analysis outputs are attached to the selected evidence items.
                  </p>
                ) : (
                  selectedEvidence
                    .filter((e) => e.analysisResult)
                    .map((item) => (
                      <div key={item.id} className="space-y-1">
                        <div className="font-mono text-tl-cyan">{item.fileName}</div>
                        <ul className="list-disc pl-4 space-y-1 text-tl-text">
                          {item.analysisResult!.summaryObservations.map((obs, i) => (
                            <li key={i}>{obs}</li>
                          ))}
                        </ul>
                      </div>
                    ))
                )}
              </section>
            )}

            {/* 08. Region-Level Observations */}
            {config.sections.regionObservations && (
              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  08. Region-Level Observations (4×4 Grid)
                </h3>
                {selectedEvidence.filter((e) => e.analysisResult).length === 0 ? (
                  <p className="text-tl-muted">No regional observations recorded.</p>
                ) : (
                  selectedEvidence
                    .filter((e) => e.analysisResult)
                    .map((item) => {
                      const flagged = item.analysisResult!.regions.filter((r) => r.flagged);
                      return (
                        <div key={item.id} className="space-y-1.5">
                          <div className="font-mono text-tl-text">
                            {item.fileName} — {flagged.length} of 16 regions flagged for human review
                          </div>
                          {flagged.map((reg) => (
                            <div
                              key={reg.regionId}
                              className="rounded border border-tl-border bg-tl-bg-secondary p-2.5"
                            >
                              <div className="font-mono text-tl-caution">
                                {reg.regionId} · {reg.reviewLevel} · Signals: {reg.signals.join(', ')}
                              </div>
                              <p className="text-tl-muted mt-1">{reg.observations.join(' ')}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })
                )}
              </section>
            )}

            {/* 09. Supporting Evidence */}
            {config.sections.supportingEvidence && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  09. Supporting Evidence &amp; Sanitized Metadata
                </h3>
                <p className="text-tl-muted">
                  GPS / geolocation tags are excluded from reports. Sanitized container metadata and investigator contextual attachments are included in exported records.
                </p>
              </section>
            )}

            {/* 10. Cross-Modal Observations */}
            {config.sections.crossModalObservations && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  10. Cross-Modal Observations
                </h3>
                <p className="text-tl-muted">
                  Automated cross-modal correlation is not yet active; multi-source observations reflect investigator contextual review. Correlated signals from a single file do not represent independent verification.
                </p>
              </section>
            )}

            {/* 11. Limitations */}
            {config.sections.limitations && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  11. Limitations
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-tl-muted">
                  <li>Heuristic indicators are uncalibrated and cannot be converted into authenticity probabilities.</li>
                  <li>Social media recompression, platform EXIF stripping, and resizing alter signal baselines.</li>
                  <li>Spatial Consistency is a supporting observation and not an independent evidence domain.</li>
                </ul>
              </section>
            )}

            {/* 12. Alternative Explanations */}
            {config.sections.alternativeExplanations && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  12. Alternative Explanations
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-tl-muted">
                  <li>Benign editorial cropping, exposure grading, or web-export recompression.</li>
                  <li>High-contrast signage, motion blur, in-camera HDR fusion, or lens optics variance.</li>
                </ul>
              </section>
            )}

            {/* 13. Recommended Manual Verification */}
            {config.sections.recommendedVerification && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  13. Recommended Manual Verification
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-tl-muted">
                  <li>Request original uncropped capture files (RAW/DNG or original camera JPEG) for hash verification.</li>
                  <li>Inspect flagged regions at high magnification for shadow geometry, reflections, and edge continuity.</li>
                </ul>
              </section>
            )}

            {/* 14. Investigator Notes */}
            {config.sections.investigatorNotes && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  14. Investigator Notes
                </h3>
                <p className="text-tl-text whitespace-pre-wrap">{config.investigatorNotes}</p>
              </section>
            )}

            {/* 15. Conclusion */}
            {config.sections.conclusion && (
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-tl-text border-b border-tl-border pb-1.5">
                  15. Conclusion
                </h3>
                <p className="text-tl-text whitespace-pre-wrap">{config.conclusionDraft}</p>
              </section>
            )}
          </div>
        </article>
      </div>
    </div>
  );
};
