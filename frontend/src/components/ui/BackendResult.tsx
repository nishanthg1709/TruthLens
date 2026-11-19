import type { InvestigationResult } from '../../types';
import { FileSearch } from 'lucide-react';

export default function BackendResult({ result }: { result: InvestigationResult }) {
  const assessmentStatus = typeof result.assessment === 'object' ? result.assessment.status : (result.assessment || 'INCONCLUSIVE');
  const assessmentSummary = typeof result.assessment === 'object' ? result.assessment.summary : (result.assessment ? 'Backend-provided assessment' : 'No backend assessment is available.');

  return (
    <>
      <div className="result-placeholder">
        <section className="card">
          <div className="card-header">
            <span>INVESTIGATION DETAILS</span>
            <h3>File properties</h3>
          </div>
          <div className="detail-list">
            <div><span>Investigation ID</span><strong>{result.id ?? 'Unavailable'}</strong></div>
            <div><span>Timestamp</span><strong>{result.timestamp ?? 'Unavailable'}</strong></div>
            <div><span>SHA-256</span><strong className="hash-value">{result.sha256?.join(', ') || 'Unavailable'}</strong></div>
            <div><span>Filenames</span><strong>{result.filenames.join(', ') || 'Unavailable'}</strong></div>
          </div>
        </section>
        <section className="card">
          <div className="card-header">
            <span>ASSESSMENT</span>
            <h3>Overall status</h3>
          </div>
          <div className="assessment-box">
            <FileSearch />
            <strong style={{ marginTop: '10px' }}>{assessmentStatus}</strong>
            <p style={{ margin: '8px 12px 0', fontSize: '11px', color: '#94a3b8' }}>{assessmentSummary}</p>
          </div>
        </section>
      </div>

      {result.modules.length > 0 && (
        <section className="card module-results">
          <div className="card-header">
            <span>FORENSIC MODULES</span>
            <h3>Backend module states</h3>
          </div>
          {result.modules.map(module => (
            <div className="module-result" key={module.name}>
              <div>
                <strong>{module.name}</strong>
                <p>{module.status === 'unavailable' ? 'Analysis unavailable' : module.status}</p>
              </div>
              <span>{module.status}</span>
            </div>
          ))}
        </section>
      )}

      {result.findings.length > 0 && (
        <section className="card module-results" style={{ marginTop: '14px' }}>
          <div className="card-header">
            <span>FINDINGS & OBSERVATIONS</span>
            <h3>Backend observations</h3>
          </div>
          {result.findings.map(finding => (
            <article className="method-card" key={finding.id} style={{ marginBottom: '10px' }}>
              <div className="method-copy">
                <h3>{finding.title}</h3>
                <dl>
                  <div>
                    <dt>Observation</dt>
                    <dd>{finding.observation}</dd>
                  </div>
                  <div>
                    <dt>Possible interpretation</dt>
                    <dd>{finding.interpretation ?? 'Unavailable'}</dd>
                  </div>
                  <div>
                    <dt>Limitations</dt>
                    <dd>{finding.limitations ?? 'Unavailable'}</dd>
                  </div>
                  <div>
                    <dt>Evidence reference</dt>
                    <dd>{finding.evidenceReference ?? 'Unavailable'}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
