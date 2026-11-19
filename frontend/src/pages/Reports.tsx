import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, ArrowRight } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState, StatusBadge } from '../components/ui/Common';
import { readInvestigations, type StoredInvestigation } from '../lib/investigationStore';

export default function Reports() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<StoredInvestigation[]>(() =>
    readInvestigations().filter(r => r.status === 'completed' || r.status === 'inconclusive')
  );

  useEffect(() => {
    const refresh = () => {
      setRecords(readInvestigations().filter(r => r.status === 'completed' || r.status === 'inconclusive'));
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const openReport = (record: StoredInvestigation) => {
    navigate('/results', { state: { result: record.result } });
  };

  const downloadJson = (record: StoredInvestigation) => {
    const data = record.result?.rawResponse ?? record.result ?? record;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truthlens-report-${record.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Forensic reports"
        description="Completed multi-domain forensic investigation reports available for review and export."
        actions={
          <button className="button primary" onClick={() => navigate('/analyze')}>
            New investigation <ArrowRight size={16} />
          </button>
        }
      />

      {records.length === 0 ? (
        <div className="card report-empty">
          <EmptyState
            title="No reports available"
            message="Completed forensic examination reports will appear here for viewing and JSON export."
            action={
              <button className="button primary" onClick={() => navigate('/analyze')}>
                Analyze media
              </button>
            }
          />
        </div>
      ) : (
        <div className="card history-card">
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Investigation target</th>
                  <th>Media type</th>
                  <th>Analysis date</th>
                  <th>Engine status</th>
                  <th>Investigation ID</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => {
                  const date = new Date(record.submittedAt);
                  return (
                    <tr key={record.id}>
                      <td>
                        <div className="history-file">
                          <strong>{record.filename}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="media-type-label">{record.mediaType}</span>
                      </td>
                      <td>
                        {Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString()}
                      </td>
                      <td>
                        <StatusBadge tone="cyan">Completed</StatusBadge>
                      </td>
                      <td>
                        <code className="investigation-id">{record.id}</code>
                      </td>
                      <td>
                        <div className="history-actions">
                          <button
                            className="button secondary small"
                            type="button"
                            onClick={() => openReport(record)}
                          >
                            <Eye size={15} /> View
                          </button>
                          <button
                            className="button secondary small"
                            type="button"
                            onClick={() => downloadJson(record)}
                          >
                            <Download size={15} /> Export JSON
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
