import { useNavigate, useLocation } from 'react-router-dom';
import { Download, FileSearch, ArrowLeft } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Common';
import BackendResult from '../components/ui/BackendResult';
import ImageEvidenceDashboard from '../components/ui/ImageEvidenceDashboard';
import type { InvestigationResult } from '../types';

export default function Results() {
  const nav = useNavigate();
  const location = useLocation();
  const locationState = location.state as { result?: InvestigationResult; previewUrl?: string } | null;
  const result = locationState?.result;
  const previewUrl = locationState?.previewUrl;
  const isImage = result?.mediaTypes.includes('image') || Boolean(result?.imageEvidence);
  const imageEvidence = result?.imageEvidence;

  const assessmentStatus = typeof result?.assessment === 'object'
    ? result.assessment?.status
    : (result?.assessment || 'COMPLETE');

  const assessmentSummary = typeof result?.assessment === 'object'
    ? result.assessment?.summary
    : (result?.assessment ? 'Backend forensic assessment completed.' : 'No backend assessment is available.');

  const downloadReport = () => {
    if (!result) return;
    const exportData = result.rawResponse ?? result;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truthlens-report-${result.id || result.sha256?.[0]?.slice(0, 12) || 'analysis'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Investigation report"
        description="Comprehensive multi-domain forensic evidence and observations returned by the backend."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="button secondary" onClick={() => nav('/analyze')}>
              <ArrowLeft size={16} /> New analysis
            </button>
            {result && (
              <button className="button primary" onClick={downloadReport}>
                <Download size={16} /> Export JSON report
              </button>
            )}
          </div>
        }
      />

      {result ? (
        isImage && imageEvidence ? (
          <>
            <div className="result-placeholder">
              <section className="card">
                <div className="card-header">
                  <span>INVESTIGATION SUMMARY</span>
                  <h3>Image evidence</h3>
                </div>
                <div className="detail-list">
                  <div><span>Original filename</span><strong>{result.filenames[0] ?? 'Evidence item'}</strong></div>
                  <div><span>Investigation ID</span><strong className="hash-value">{result.id ?? 'Unavailable'}</strong></div>
                  <div><span>Analysis timestamp</span><strong>{result.timestamp ? new Date(result.timestamp).toLocaleString() : 'Unavailable'}</strong></div>
                  <div><span>Engine status</span><strong style={{ color: '#22d3ee', textTransform: 'capitalize' }}>{result.analysisStatus ?? 'Completed'}</strong></div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <span>ASSESSMENT</span>
                  <h3>Synthesis status</h3>
                </div>
                <div className="assessment-box">
                  <FileSearch />
                  <strong style={{ marginTop: '10px' }}>{assessmentStatus}</strong>
                  <p style={{ margin: '8px 12px 0', fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                    {assessmentSummary}
                  </p>
                </div>
              </section>
            </div>

            <ImageEvidenceDashboard
              evidence={{
                ...imageEvidence,
                originalImageUrl: imageEvidence.originalImageUrl || previewUrl,
                status: imageEvidence.status ?? result.analysisStatus ?? 'completed',
                sha256: imageEvidence.sha256 ?? result.sha256?.[0],
                fileFormat: imageEvidence.fileFormat ?? result.fileFormat ?? result.imageProperties?.format,
                fileSize: imageEvidence.fileSize ?? result.fileSize ?? result.imageProperties?.sizeBytes,
                width: imageEvidence.width ?? result.imageProperties?.width,
                height: imageEvidence.height ?? result.imageProperties?.height,
              }}
            />
          </>
        ) : (
          <BackendResult result={result} />
        )
      ) : (
        <div className="card report-empty">
          <EmptyState
            title="No investigation result"
            message="There is no backend result to display. Upload media and submit an investigation to produce an evidence report."
            action={<button className="button primary" onClick={() => nav('/analyze')}>Analyze media</button>}
          />
        </div>
      )}
    </>
  );
}
