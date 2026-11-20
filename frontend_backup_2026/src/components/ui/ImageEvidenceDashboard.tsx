import { useState } from 'react';
import {
  ChevronDown,
  Image as ImageIcon,
  Maximize2,
  ShieldAlert,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import type {
  ImageForensicEvidence,
  RegionalMeasurement,
  RGBMeasurements,
  EvidenceRelationship,
  KeyObservation,
  CrossDomainRelationship,
  RegionalAnomalyTile,
} from '../../types';

function formatBytes(bytes?: number) {
  if (typeof bytes !== 'number') return 'Unavailable';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function rgbRows(rgb?: RGBMeasurements) {
  if (!rgb) return [];
  return [
    ['Red', rgb.red ?? rgb.r],
    ['Green', rgb.green ?? rgb.g],
    ['Blue', rgb.blue ?? rgb.b],
    ['Mean', rgb.mean],
  ].filter(([, value]) => typeof value === 'number') as [string, number][];
}

function EvidenceDetails({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="evidence-section" open={defaultOpen}>
      <summary>
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <ChevronDown size={18} />
      </summary>
      <div className="evidence-section-body">{children}</div>
    </details>
  );
}

function RegionalGrid({ regions }: { regions?: RegionalMeasurement[] }) {
  if (!regions?.length) return <div className="unavailable-data">Regional measurements unavailable.</div>;
  return (
    <div className="regional-grid" role="table" aria-label="4 by 4 regional measurements">
      {regions.map((region, index) => {
        const label = typeof region.region === 'string'
          ? region.region
          : `Region ${typeof region.row === 'number' && typeof region.column === 'number' ? `${region.row + 1}.${region.column + 1}` : index + 1}`;
        const value = typeof region.value === 'number'
          ? region.value
          : typeof region.std === 'number'
          ? region.std
          : typeof region.variance === 'number'
          ? region.variance
          : Object.values(region.measurements ?? {}).find(v => typeof v === 'number');
        return (
          <div className="regional-cell" role="cell" key={label}>
            <span>{label}</span>
            <strong>{typeof value === 'number' ? value.toFixed(4) : 'N/A'}</strong>
          </div>
        );
      })}
    </div>
  );
}

function Visualization({ url, title, alt }: { url?: string; title: string; alt: string }) {
  const [open, setOpen] = useState(false);
  if (!url) {
    return (
      <div className="visualization-placeholder">
        <ImageIcon />
        <span>{title} unavailable</span>
      </div>
    );
  }
  return (
    <>
      <div className="visualization-card">
        <div className="visualization-toolbar">
          <span>{title}</span>
          <button className="icon-button" type="button" aria-label={`Expand ${title}`} onClick={() => setOpen(true)}>
            <Maximize2 size={16} />
          </button>
        </div>
        <img src={url} alt={alt} />
      </div>
      {open && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="image-modal" role="dialog" aria-modal="true" aria-label={`${title} enlarged view`} onClick={e => e.stopPropagation()}>
            <button className="icon-button dialog-close" type="button" aria-label="Close enlarged visualization" onClick={() => setOpen(false)}>
              ×
            </button>
            <img src={url} alt={alt} />
          </div>
        </div>
      )}
    </>
  );
}

function RelationshipBadge({ relationship }: { relationship?: EvidenceRelationship }) {
  if (!relationship) return null;
  const config: Record<EvidenceRelationship, { label: string; className: string }> = {
    converging_observations: { label: 'Converging Observations', className: 'converging' },
    isolated_observation: { label: 'Isolated Observation', className: 'isolated' },
    mixed_observations: { label: 'Mixed Observations', className: 'diverging' },
    no_notable_variation: { label: 'No Notable Variation', className: 'no_notable' },
    insufficient_evidence: { label: 'Insufficient Evidence', className: 'insufficient' },
  };
  const item = config[relationship] ?? { label: relationship.replace(/_/g, ' '), className: 'insufficient' };
  return (
    <span className={`relationship-badge ${item.className}`}>
      <Sparkles size={12} />
      {item.label}
    </span>
  );
}

export default function ImageEvidenceDashboard({ evidence }: { evidence: ImageForensicEvidence }) {
  const exif = evidence.exif;
  const elaRgb = rgbRows(evidence.ela?.rgb);
  const noiseRgb = rgbRows(evidence.noise?.rgb);
  const freq = evidence.frequency;
  const regionalAnomaly = evidence.regionalAnomaly;
  const synth = evidence.synthesis;
  const summary = synth?.evidenceSummary;

  const statusTone = (status?: string) =>
    status === 'completed' || status === 'ok' ? 'completed'
    : status === 'running' || status === 'pending' ? 'running'
    : status === 'failed' ? 'failed'
    : 'unavailable';

  const moduleLabel = (status?: string) =>
    status === 'completed' || status === 'ok' ? 'Completed'
    : status === 'running' || status === 'pending' ? 'Analysis in progress'
    : status === 'failed' ? 'Failed'
    : status === 'not_implemented' ? 'Not yet implemented'
    : 'Unavailable';

  return (
    <div className="image-evidence-dashboard">
      {/* Phase 3 Synthesis High-Level Banner */}
      {summary && (
        <section className="synthesis-banner">
          <div className="synthesis-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: '#22d3ee' }} />
              <strong style={{ fontSize: '14px', letterSpacing: '.04em' }}>EVIDENCE AGGREGATION & SYNTHESIS</strong>
            </div>
            <RelationshipBadge relationship={summary.relationship} />
          </div>
          <p className="synthesis-statement">{summary.synthesisStatement || 'Forensic analysis completed across all available domains.'}</p>
          <div className="summary-grid" style={{ marginTop: '8px' }}>
            <div>
              <span>Available Domains</span>
              <strong>{summary.domainsAvailable}</strong>
            </div>
            <div>
              <span>Domains with Notable Variation</span>
              <strong>{summary.domainsWithObservations}</strong>
            </div>
            <div>
              <span>Primary Contributing Domains</span>
              <strong style={{ textTransform: 'capitalize' }}>
                {summary.primaryContributingDomains.length > 0 ? summary.primaryContributingDomains.join(', ') : 'None'}
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* Investigation summary */}
      <EvidenceDetails title="Investigation summary" subtitle="File and analysis metadata" defaultOpen={true}>
        <div className="summary-grid">
          <div>
            <span>Investigation SHA-256</span>
            <strong className="hash-value">{evidence.sha256 ? `${evidence.sha256.slice(0, 16)}…` : 'Unavailable'}</strong>
          </div>
          <div>
            <span>File format</span>
            <strong style={{ textTransform: 'uppercase' }}>{evidence.fileFormat ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>File size</span>
            <strong>{formatBytes(evidence.fileSize)}</strong>
          </div>
          <div>
            <span>Image dimensions</span>
            <strong>
              {evidence.width && evidence.height
                ? `${evidence.width} × ${evidence.height} px`
                : 'Unavailable'}
            </strong>
          </div>
          <div>
            <span>Resolution</span>
            <strong>{evidence.resolution ?? (evidence.width && evidence.height ? `${evidence.width} × ${evidence.height}` : 'Unavailable')}</strong>
          </div>
          <div>
            <span>Full SHA-256 Hash</span>
            <strong className="hash-value">{evidence.sha256 ?? 'Unavailable'}</strong>
          </div>
        </div>
      </EvidenceDetails>

      {/* Metadata & EXIF */}
      <EvidenceDetails title="Metadata & EXIF analysis" subtitle="Camera, timestamps, software, and container properties">
        <div className="metadata-grid">
          <div>
            <span>Camera make</span>
            <strong>{exif?.cameraManufacturer ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>Camera model</span>
            <strong>{exif?.cameraModel ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>Original timestamp</span>
            <strong>{exif?.originalTimestamp ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>Digitized timestamp</span>
            <strong>{exif?.modificationTimestamp ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>Editing software</span>
            <strong>{exif?.editingSoftware ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>Lens model</span>
            <strong>{exif?.lens ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>Color space</span>
            <strong>{exif?.colorSpace ?? 'Unavailable'}</strong>
          </div>
          <div>
            <span>GPS presence</span>
            <strong>{exif?.gpsPresent === undefined ? 'Unavailable' : exif.gpsPresent ? 'Present (Coordinates omitted)' : 'Not present'}</strong>
          </div>
          <div>
            <span>Metadata fields detected</span>
            <strong>{exif?.fieldsFound && exif.fieldsFound.length > 0 ? `${exif.fieldsFound.length} fields` : 'None / Stripped'}</strong>
          </div>
        </div>

        {exif?.observations && exif.observations.length > 0 && (
          <div className="interpretation-block" style={{ marginTop: '12px' }}>
            <h3>Metadata observations</h3>
            <ul>
              {exif.observations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>
        )}

        {exif?.limitations && exif.limitations.length > 0 && (
          <div className="interpretation-block">
            <h3>Metadata limitations</h3>
            <ul>
              {exif.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceDetails>

      {/* Error Level Analysis (ELA) */}
      <EvidenceDetails title="Error Level Analysis (ELA)" subtitle="Recompression response and regional difference measurements">
        <div className="evidence-visual-grid">
          <Visualization url={evidence.originalImageUrl} title="Original image" alt="Original uploaded image" />
          <Visualization url={evidence.ela?.visualizationUrl} title="ELA difference map" alt="Error Level Analysis difference visualization" />
        </div>
        <div className="measurement-grid">
          <section>
            <h3>Difference statistics</h3>
            {evidence.ela?.difference && Object.keys(evidence.ela.difference).length ? (
              <dl>
                {Object.entries(evidence.ela.difference).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{typeof value === 'number' ? value.toFixed(6) : String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="unavailable-data">Overall ELA metrics unavailable.</div>
            )}
          </section>
          <section>
            <h3>Recompression parameters</h3>
            <dl>
              <div>
                <dt>Quality level</dt>
                <dd>{evidence.ela?.recompressionQuality ?? 95}</dd>
              </div>
              <div>
                <dt>Scale factor</dt>
                <dd>{evidence.ela?.scaleFactor ?? 10}</dd>
              </div>
              {evidence.ela?.channelMeans && Object.entries(evidence.ela.channelMeans).map(([ch, val]) => (
                <div key={ch}>
                  <dt>{ch.toUpperCase()} mean</dt>
                  <dd>{val.toFixed(6)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>RGB measurements</h3>
            {elaRgb.length ? (
              <dl>
                {elaRgb.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value.toFixed(6)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="unavailable-data">ELA RGB measurements unavailable.</div>
            )}
          </section>
        </div>

        <h3 className="regional-heading">4×4 regional ELA analysis</h3>
        <RegionalGrid regions={evidence.ela?.regional} />

        {evidence.ela?.observations && evidence.ela.observations.length > 0 && (
          <div className="interpretation-block" style={{ marginTop: '12px' }}>
            <h3>ELA observations</h3>
            <ul>
              {evidence.ela.observations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceDetails>

      {/* Noise Residual Analysis */}
      <EvidenceDetails title="Noise residual analysis" subtitle="High-frequency residual extraction and statistical noise distribution">
        <Visualization url={evidence.noise?.visualizationUrl} title="Noise residual visualization" alt="Noise residual high-frequency visualization" />
        <div className="measurement-grid">
          <section>
            <h3>Smoothing parameters</h3>
            <dl>
              <div>
                <dt>Filter type</dt>
                <dd>Gaussian filter</dd>
              </div>
              <div>
                <dt>Gaussian σ</dt>
                <dd>{evidence.noise?.smoothingSigma ?? 2.0}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Residual statistics</h3>
            {evidence.noise?.statistics && Object.keys(evidence.noise.statistics).length ? (
              <dl>
                {Object.entries(evidence.noise.statistics).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{typeof value === 'number' ? value.toFixed(6) : String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="unavailable-data">Residual statistics unavailable.</div>
            )}
          </section>
          <section>
            <h3>Channel residual std</h3>
            {evidence.noise?.channelStds && Object.keys(evidence.noise.channelStds).length ? (
              <dl>
                {Object.entries(evidence.noise.channelStds).map(([ch, val]) => (
                  <div key={ch}>
                    <dt>{ch.toUpperCase()} std (σ)</dt>
                    <dd>{val.toFixed(6)}</dd>
                  </div>
                ))}
              </dl>
            ) : noiseRgb.length ? (
              <dl>
                {noiseRgb.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value.toFixed(6)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="unavailable-data">Channel noise metrics unavailable.</div>
            )}
          </section>
        </div>

        <h3 className="regional-heading">4×4 regional noise residual metrics</h3>
        <RegionalGrid regions={evidence.noise?.regional} />

        {evidence.noise?.observations && evidence.noise.observations.length > 0 && (
          <div className="interpretation-block" style={{ marginTop: '12px' }}>
            <h3>Noise residual observations</h3>
            <ul>
              {evidence.noise.observations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceDetails>

      {/* Phase 2D: Frequency Domain (2D FFT) */}
      <EvidenceDetails title="Frequency domain analysis (2D FFT)" subtitle="Spatial-frequency spectrum, Hann windowing, and energy band distribution">
        <Visualization url={freq?.visualizationUrl} title="2D FFT power spectrum" alt="2D Fourier transform log-magnitude power spectrum" />
        <div className="measurement-grid">
          <section>
            <h3>Spectral energy distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="energy-bar-wrap">
                <div className="energy-bar-label">
                  <span>Low frequency</span>
                  <strong>{(freq?.lowFrequencyEnergyPct ?? 0).toFixed(2)}%</strong>
                </div>
                <div className="energy-bar">
                  <div className="energy-bar-fill" style={{ width: `${Math.min(freq?.lowFrequencyEnergyPct ?? 0, 100)}%`, background: '#3b82f6' }} />
                </div>
              </div>
              <div className="energy-bar-wrap">
                <div className="energy-bar-label">
                  <span>Mid frequency</span>
                  <strong>{(freq?.midFrequencyEnergyPct ?? 0).toFixed(2)}%</strong>
                </div>
                <div className="energy-bar">
                  <div className="energy-bar-fill" style={{ width: `${Math.min(freq?.midFrequencyEnergyPct ?? 0, 100)}%`, background: '#22d3ee' }} />
                </div>
              </div>
              <div className="energy-bar-wrap">
                <div className="energy-bar-label">
                  <span>High frequency</span>
                  <strong>{(freq?.highFrequencyEnergyPct ?? 0).toFixed(2)}%</strong>
                </div>
                <div className="energy-bar">
                  <div className="energy-bar-fill" style={{ width: `${Math.min(freq?.highFrequencyEnergyPct ?? 0, 100)}%`, background: '#a855f7' }} />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3>Spectral properties</h3>
            <dl>
              <div>
                <dt>Spectral centroid</dt>
                <dd>{freq?.spectralCentroid ? freq.spectralCentroid.toFixed(4) : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Spectral entropy</dt>
                <dd>{freq?.spectralEntropy ? freq.spectralEntropy.toFixed(4) : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Total non-DC power</dt>
                <dd>{freq?.totalPower ? freq.totalPower.toExponential(4) : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Window function</dt>
                <dd style={{ textTransform: 'capitalize' }}>{freq?.windowFunction ?? 'Hann'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>Transform parameters</h3>
            <dl>
              <div>
                <dt>Analysis size</dt>
                <dd>{freq?.analysisWidth && freq?.analysisHeight ? `${freq.analysisWidth} × ${freq.analysisHeight}` : 'Original'}</dd>
              </div>
              <div>
                <dt>Downsampled</dt>
                <dd>{freq?.isDownsampled ? 'Yes (scaled to limit)' : 'No (full resolution)'}</dd>
              </div>
              <div>
                <dt>Spectrum center</dt>
                <dd>DC shifted to center</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{moduleLabel(freq?.status)}</dd>
              </div>
            </dl>
          </section>
        </div>

        {freq?.observations && freq.observations.length > 0 && (
          <div className="interpretation-block" style={{ marginTop: '12px' }}>
            <h3>Frequency domain observations</h3>
            <ul>
              {freq.observations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>
        )}

        {freq?.limitations && freq.limitations.length > 0 && (
          <div className="interpretation-block">
            <h3>Frequency domain limitations</h3>
            <ul>
              {freq.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceDetails>

      {/* Phase 2E: Regional Anomaly Analysis */}
      <EvidenceDetails title="Regional anomaly analysis (4×4 grid)" subtitle="Multivariate spatial deviation and local anomaly detection">
        <Visualization url={regionalAnomaly?.visualizationUrl} title="Regional anomaly heatmap" alt="4x4 composite deviation anomaly heatmap" />

        <div className="measurement-grid">
          <section>
            <h3>Deviation summary</h3>
            <dl>
              <div>
                <dt>Max deviation score</dt>
                <dd>{regionalAnomaly?.maxDeviationScore ? regionalAnomaly.maxDeviationScore.toFixed(4) : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Mean deviation score</dt>
                <dd>{regionalAnomaly?.meanDeviationScore ? regionalAnomaly.meanDeviationScore.toFixed(4) : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Highest deviation tile</dt>
                <dd>{regionalAnomaly?.highestDeviationRegionId ?? 'None'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>Analyzed features</h3>
            {regionalAnomaly?.analyzedFeatures && regionalAnomaly.analyzedFeatures.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {regionalAnomaly.analyzedFeatures.map(feat => (
                  <span className="domain-tag" key={feat}>{feat.replace(/_/g, ' ')}</span>
                ))}
              </div>
            ) : (
              <div className="unavailable-data">Feature list unavailable.</div>
            )}
          </section>

          <section>
            <h3>Active contributing modules</h3>
            {regionalAnomaly?.activeModulesUsed && regionalAnomaly.activeModulesUsed.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {regionalAnomaly.activeModulesUsed.map(mod => (
                  <span className="domain-tag" key={mod}>{mod.replace(/_/g, ' ')}</span>
                ))}
              </div>
            ) : (
              <div className="unavailable-data">Active modules unavailable.</div>
            )}
          </section>
        </div>

        {regionalAnomaly?.tiles && regionalAnomaly.tiles.length > 0 && (
          <>
            <h3 className="regional-heading">4×4 regional anomaly tiles</h3>
            <div className="tile-anomaly-grid" role="table" aria-label="4 by 4 regional anomaly tiles">
              {regionalAnomaly.tiles.map((tile: RegionalAnomalyTile) => {
                const isElevated = tile.deviationScore > 2.0;
                const isModerate = tile.deviationScore > 1.2 && !isElevated;
                return (
                  <div
                    className={`anomaly-cell ${isElevated ? 'elevated' : isModerate ? 'moderate' : 'typical'}`}
                    role="cell"
                    key={tile.regionId}
                  >
                    <div className="anomaly-cell-top">
                      <span>{tile.regionId}</span>
                      <strong>{tile.deviationScore.toFixed(3)}</strong>
                    </div>
                    <div className="anomaly-cell-desc" title={tile.observation || `Neighbor deviation: ${tile.neighborDeviation.toFixed(3)}`}>
                      {tile.observation || `Neighbor dev: ${tile.neighborDeviation.toFixed(3)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {regionalAnomaly?.observations && regionalAnomaly.observations.length > 0 && (
          <div className="interpretation-block" style={{ marginTop: '12px' }}>
            <h3>Regional anomaly observations</h3>
            <ul>
              {regionalAnomaly.observations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceDetails>

      {/* Phase 3: Evidence Aggregation & Synthesis Engine Details */}
      <EvidenceDetails title="Evidence aggregation & cross-domain synthesis" subtitle="Multi-domain correlation, key observations, and methodology" defaultOpen={true}>
        <div className="evidence-note">
          <ShieldAlert />
          <p>
            Forensic synthesis aggregates signals across independent physical domains. Elevated variation indicates structural or compression anomalies requiring contextual review; it does not prove manipulation or AI generation.
          </p>
        </div>

        {/* Key Observations */}
        {synth?.keyObservations && synth.keyObservations.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <h3 style={{ fontSize: '13px', margin: '0 0 10px', color: '#e8eef7' }}>Key forensic observations</h3>
            {synth.keyObservations.map((obs: KeyObservation) => (
              <article className="obs-card" key={obs.observationId}>
                <div className="obs-card-header">
                  <h4>{obs.title}</h4>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {obs.relevantDomains.map(d => (
                      <span className="domain-tag" key={d}>{d}</span>
                    ))}
                  </div>
                </div>
                <p>{obs.description}</p>
                <div className="obs-meta">
                  <div>
                    <span>Neutral interpretation</span>
                    <strong>{obs.neutralInterpretation}</strong>
                  </div>
                  <div>
                    <span>Affected regions</span>
                    <strong>{obs.regionIds.length > 0 ? obs.regionIds.join(', ') : 'Global'}</strong>
                  </div>
                </div>
                {obs.limitations.length > 0 && (
                  <p style={{ marginTop: '8px', fontSize: '10px', color: '#64748b' }}>
                    <em>Limitation:</em> {obs.limitations.join('; ')}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}

        {/* Cross-Domain Relationships */}
        {synth?.crossDomainRelationships && synth.crossDomainRelationships.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <h3 style={{ fontSize: '13px', margin: '0 0 10px', color: '#e8eef7' }}>Cross-domain evidence relationships</h3>
            {synth.crossDomainRelationships.map((rel: CrossDomainRelationship, i) => (
              <div className="obs-card" key={i}>
                <div className="obs-card-header">
                  <h4>{rel.domains.join(' ↔ ')}</h4>
                  <span className={`relationship-badge ${rel.relationshipType}`}>
                    {rel.relationshipType}
                  </span>
                </div>
                <p>{rel.description}</p>
                {rel.supportingEvidence.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '11px', color: '#94a3b8' }}>
                    {rel.supportingEvidence.map((ev, idx) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Spatial Multi-Domain Synthesis */}
        {synth?.regionalSynthesis && (
          <div style={{ marginTop: '14px' }}>
            <h3 style={{ fontSize: '13px', margin: '0 0 10px', color: '#e8eef7' }}>Spatial multi-domain synthesis</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>{synth.regionalSynthesis.summary}</p>
            <div className="summary-grid" style={{ marginTop: '8px' }}>
              <div>
                <span>Elevated Regions</span>
                <strong>{synth.regionalSynthesis.elevatedRegions.length > 0 ? synth.regionalSynthesis.elevatedRegions.join(', ') : 'None'}</strong>
              </div>
              <div>
                <span>Multi-Domain Regions</span>
                <strong>{synth.regionalSynthesis.multiDomainRegions.length > 0 ? synth.regionalSynthesis.multiDomainRegions.join(', ') : 'None'}</strong>
              </div>
              <div>
                <span>Low Variation Regions</span>
                <strong>{synth.regionalSynthesis.lowVariationRegions.length > 0 ? `${synth.regionalSynthesis.lowVariationRegions.length} tiles` : 'None'}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Methodology Disclosure */}
        {synth?.methodology && (
          <div style={{ marginTop: '16px', padding: '12px', background: '#0c1422', border: '1px solid #253449', borderRadius: '7px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Info size={16} style={{ color: '#22d3ee' }} />
              <strong style={{ fontSize: '12px', color: '#e8eef7' }}>Methodology & Policy (v{synth.methodology.version})</strong>
            </div>
            <dl style={{ margin: 0, fontSize: '11px' }}>
              <dt style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Correlated feature policy</dt>
              <dd style={{ margin: '2px 0 8px', color: '#94a3b8' }}>{synth.methodology.correlatedFeaturePolicy}</dd>
              <dt style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Aggregation approach</dt>
              <dd style={{ margin: '2px 0 8px', color: '#94a3b8' }}>{synth.methodology.aggregationApproach}</dd>
              <dt style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Scientific disclaimer</dt>
              <dd style={{ margin: '2px 0 0', color: '#94a3b8' }}>{synth.methodology.disclaimer}</dd>
            </dl>
          </div>
        )}
      </EvidenceDetails>

      {/* Module status */}
      <EvidenceDetails title="Module execution status" subtitle="Status of all implemented TruthLens forensic engines">
        <div className="module-status-grid">
          <div>
            <span>Metadata & EXIF (Phase 2A)</span>
            <strong className={statusTone(exif ? 'completed' : 'unavailable')}>{moduleLabel(exif ? 'completed' : 'unavailable')}</strong>
          </div>
          <div>
            <span>Error Level Analysis (Phase 2B)</span>
            <strong className={statusTone(evidence.ela?.status)}>{moduleLabel(evidence.ela?.status)}</strong>
          </div>
          <div>
            <span>Noise Residual Analysis (Phase 2C)</span>
            <strong className={statusTone(evidence.noise?.status)}>{moduleLabel(evidence.noise?.status)}</strong>
          </div>
          <div>
            <span>Frequency Domain FFT (Phase 2D)</span>
            <strong className={statusTone(evidence.frequency?.status)}>{moduleLabel(evidence.frequency?.status)}</strong>
          </div>
          <div>
            <span>Regional Anomaly Grid (Phase 2E)</span>
            <strong className={statusTone(evidence.regionalAnomaly?.status)}>{moduleLabel(evidence.regionalAnomaly?.status)}</strong>
          </div>
          <div>
            <span>Evidence Aggregation & Synthesis (Phase 3)</span>
            <strong className={statusTone(evidence.synthesis?.status)}>{moduleLabel(evidence.synthesis?.status)}</strong>
          </div>
        </div>
      </EvidenceDetails>
    </div>
  );
}
