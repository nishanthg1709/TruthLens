import { jsPDF } from 'jspdf';
import { TRUTHLENS_DISCLAIMER } from '../constants/assets';
import { EvidenceItem, Investigation, ReportConfig } from '../types/forensics';
import { formatFileSize, formatTimestamp } from '../utils/cryptoAndValidation';

export function exportForensicReportPdf(
  config: ReportConfig,
  investigation: Investigation | null,
  selectedEvidence: EvidenceItem[],
  isDemoMode: boolean
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 46;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 52;
      if (isDemoMode) {
        drawDemoBanner();
      }
    }
  };

  const drawDemoBanner = () => {
    doc.setFillColor(245, 184, 75);
    doc.rect(margin, y - 14, maxWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DEMO DATA — NOT A REAL FORENSIC ANALYSIS', margin + 8, y - 1);
    y += 18;
  };

  const addSectionHeading = (num: string, title: string) => {
    ensureSpace(38);
    y += 8;
    doc.setDrawColor(55, 200, 245);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${num}. ${title}`, margin, y);
    y += 16;
  };

  const addParagraph = (text: string, mono = false) => {
    doc.setFont(mono ? 'courier' : 'helvetica', 'normal');
    doc.setFontSize(mono ? 8.5 : 9.5);
    doc.setTextColor(45, 55, 72);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(15);
      doc.text(line, margin, y);
      y += 13.5;
    });
    y += 4;
  };

  if (isDemoMode) {
    drawDemoBanner();
  }

  // 1. Cover
  if (config.sections.cover) {
    doc.setFillColor(14, 21, 32);
    doc.rect(margin, y, maxWidth, 86, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(231, 237, 245);
    doc.text('TRUTHLENS FORENSIC EXAMINATION REPORT', margin + 16, y + 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(55, 200, 245);
    doc.text(config.title || 'Untitled Forensic Report', margin + 16, y + 50);
    doc.setFontSize(8.5);
    doc.setTextColor(145, 160, 181);
    doc.text(
      `Prepared: ${config.reportDate}  |  Investigator: ${config.preparedBy || 'Unspecified'}  |  Case: ${investigation?.caseReference || config.investigationId || 'Standalone'}`,
      margin + 16,
      y + 70
    );
    y += 104;
  }

  // Mandatory Disclaimer Box
  ensureSpace(64);
  doc.setDrawColor(180, 83, 9);
  doc.setFillColor(254, 249, 235);
  doc.rect(margin, y, maxWidth, 50, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text('MANDATORY ANALYTICAL DISCLAIMER', margin + 10, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const discLines = doc.splitTextToSize(TRUTHLENS_DISCLAIMER, maxWidth - 20) as string[];
  doc.text(discLines, margin + 10, y + 27);
  y += 64;

  // 2. Investigation Details
  if (config.sections.investigationDetails) {
    addSectionHeading('02', 'Investigation Details');
    if (investigation) {
      addParagraph(`Investigation ID: ${investigation.id}`, true);
      addParagraph(`Case Reference: ${investigation.caseReference}`, true);
      addParagraph(`Title: ${investigation.title}`);
      addParagraph(`Category: ${investigation.category}  |  Status: ${investigation.status}`);
      addParagraph(`Investigator / Team: ${investigation.investigator}`);
      addParagraph(`Created: ${formatTimestamp(investigation.createdAt)}  |  Updated: ${formatTimestamp(investigation.updatedAt)}`, true);
      if (investigation.description) addParagraph(`Scope: ${investigation.description}`);
    } else {
      addParagraph('No linked investigation record selected. Standalone evidence report.');
    }
  }

  // 3. Executive Summary
  if (config.sections.executiveSummary) {
    addSectionHeading('03', 'Executive Summary');
    const analyzedCount = selectedEvidence.filter((e) => Boolean(e.analysisResult)).length;
    addParagraph(
      `This forensic examination document records ${selectedEvidence.length} evidence item(s), of which ${analyzedCount} have structured image forensic observations attached. TruthLens separates objective technical observations from human interpretation and does not issue automated authenticity verdicts.`
    );
  }

  // 4. Evidence Inventory
  if (config.sections.evidenceInventory) {
    addSectionHeading('04', 'Evidence Inventory');
    if (selectedEvidence.length === 0) {
      addParagraph('No evidence items were included in this report configuration.');
    } else {
      selectedEvidence.forEach((item, idx) => {
        addParagraph(
          `[${idx + 1}] ${item.fileName} (${item.id}) — Type: ${item.mediaType.toUpperCase()} | Size: ${formatFileSize(item.fileSizeBytes)} | Status: ${item.analysisStatus}`,
          true
        );
      });
    }
  }

  // 5. File Integrity Information
  if (config.sections.fileIntegrity) {
    addSectionHeading('05', 'File Integrity Information');
    selectedEvidence.forEach((item) => {
      const originLabel =
        item.hashOrigin === 'local_sha256'
          ? 'Calculated locally in browser (Web Crypto)'
          : item.hashOrigin === 'server_sha256'
            ? 'Verified by forensic backend'
            : 'Unavailable';
      addParagraph(
        `${item.fileName} | SHA-256: ${item.sha256 || 'Unavailable'} | Source: ${originLabel}`,
        true
      );
    });
    addParagraph(
      'Note: Client-side SHA-256 digests assist session traceability and do not constitute a legally certified chain-of-custody ledger on their own.'
    );
  }

  // 6. Analysis Methods
  if (config.sections.analysisMethods) {
    addSectionHeading('06', 'Analysis Methods');
    addParagraph(
      'Implemented image forensic modules evaluate four independent evidence domains — Metadata & Provenance, Compression & Recompression (ELA), Noise & Texture Residuals, and Frequency Spectrum (2D FFT) — alongside a 4×4 Spatial Consistency localization view (supporting observation, not an independent domain).'
    );
  }

  // 7. Observed Indicators
  if (config.sections.observedIndicators) {
    addSectionHeading('07', 'Observed Indicators');
    const withResults = selectedEvidence.filter((e) => e.analysisResult);
    if (withResults.length === 0) {
      addParagraph('No completed forensic engine outputs are attached to the selected evidence items.');
    } else {
      withResults.forEach((item) => {
        const res = item.analysisResult!;
        addParagraph(`Evidence: ${item.fileName} (${res.analysisId})`, true);
        res.summaryObservations.forEach((obs) => addParagraph(`• ${obs}`));
      });
    }
  }

  // 8. Region-Level Observations
  if (config.sections.regionObservations) {
    addSectionHeading('08', 'Region-Level Observations (4×4 Grid)');
    const withResults = selectedEvidence.filter((e) => e.analysisResult);
    if (withResults.length === 0) {
      addParagraph('No regional grid observations available.');
    } else {
      withResults.forEach((item) => {
        const flagged = item.analysisResult!.regions.filter((r) => r.flagged);
        if (flagged.length === 0) {
          addParagraph(`${item.fileName}: 0 of 16 regions flagged for review.`);
        } else {
          flagged.forEach((reg) => {
            addParagraph(
              `${item.fileName} [${reg.regionId}] — Review Level: ${reg.reviewLevel} | Signals: ${reg.signals.join(', ') || 'Unspecified'}`,
              true
            );
            reg.observations.forEach((o) => addParagraph(`  - ${o}`));
          });
        }
      });
    }
  }

  // 9. Supporting Evidence
  if (config.sections.supportingEvidence) {
    addSectionHeading('09', 'Supporting Evidence & Sanitized Metadata');
    selectedEvidence.forEach((item) => {
      if (item.analysisResult?.sanitizedMetadata) {
        const entries = Object.entries(item.analysisResult.sanitizedMetadata)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
        addParagraph(`${item.fileName}: ${entries}`, true);
      } else {
        addParagraph(`${item.fileName}: ${item.sourceContext || 'No supplementary metadata attached.'}`);
      }
    });
  }

  // 10. Cross-Modal Observations
  if (config.sections.crossModalObservations) {
    addSectionHeading('10', 'Cross-Modal Observations');
    const mediaTypes = Array.from(new Set(selectedEvidence.map((e) => e.mediaType)));
    addParagraph(
      `Modalities represented: ${mediaTypes.length > 0 ? mediaTypes.join(', ').toUpperCase() : 'None'}. Automated cross-modal correlation engine is planned; any cross-source relationships documented here reflect investigator contextual review only. Correlated indicators derived from a single signal must not be treated as independent confirmation.`
    );
  }

  // 11. Limitations
  if (config.sections.limitations) {
    addSectionHeading('11', 'Methodological Limitations');
    addParagraph('• Forensic heuristics are sensitive to social media recompression, resizing, lighting transitions, and in-camera processing.');
    addParagraph('• Absence of EXIF metadata does not prove editing; presence of metadata does not guarantee authenticity.');
    addParagraph('• Spatial Consistency is a supporting regional visualization and not an independent evidence domain.');
  }

  // 12. Alternative Explanations
  if (config.sections.alternativeExplanations) {
    addSectionHeading('12', 'Alternative Explanations');
    addParagraph('• Benign post-processing such as cropping, exposure adjustment, or CMS re-encoding.');
    addParagraph('• Natural optical phenomena including motion blur, LED flicker, sensor noise variation, and lens sharpening.');
  }

  // 13. Recommended Manual Verification
  if (config.sections.recommendedVerification) {
    addSectionHeading('13', 'Recommended Manual Verification');
    addParagraph('• Obtain the earliest available source copy or original camera capture file for hash and metadata comparison.');
    addParagraph('• Corroborate visual landmarks, lighting geometry, shadows, and timestamps against independent external records.');
  }

  // 14. Investigator Notes
  if (config.sections.investigatorNotes) {
    addSectionHeading('14', 'Investigator Notes');
    addParagraph(config.investigatorNotes.trim() || 'No investigator notes entered for this report.');
  }

  // 15. Conclusion
  if (config.sections.conclusion) {
    addSectionHeading('15', 'Conclusion');
    addParagraph(
      config.conclusionDraft.trim() ||
        'All observed indicators should be evaluated in full operational context by a qualified human investigator before any editorial, legal, or security action is taken.'
    );
  }

  const safeSlug =
    (config.title || 'truthlens_forensic_report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'truthlens_forensic_report';
  doc.save(`${safeSlug}_${config.reportDate}.pdf`);
}

export function exportForensicReportJson(
  config: ReportConfig,
  investigation: Investigation | null,
  selectedEvidence: EvidenceItem[],
  isDemoMode: boolean
): void {
  const payload = {
    product: 'TruthLens',
    disclaimer: TRUTHLENS_DISCLAIMER,
    isDemoData: isDemoMode,
    generatedAt: new Date().toISOString(),
    reportConfig: config,
    investigation,
    evidence: selectedEvidence.map((e) => ({
      ...e,
      previewUrl: undefined,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `truthlens_report_${config.reportDate}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
