import { useState } from 'react';
import { ChevronDown, Image as ImageIcon, Maximize2, ShieldAlert } from 'lucide-react';
import type { ImageForensicEvidence, RegionalMeasurement, RGBMeasurements } from '../../types';

function formatBytes(bytes?: number) {
 if (typeof bytes !== 'number') return 'Unavailable';
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function rgbRows(rgb?: RGBMeasurements) {
 if (!rgb) return [];
 return [
  ['Red', rgb.red ?? rgb.r], ['Green', rgb.green ?? rgb.g], ['Blue', rgb.blue ?? rgb.b], ['Mean', rgb.mean],
 ].filter(([,value]) => typeof value === 'number') as [string, number][];
}

function EvidenceDetails({title,subtitle,children}:{title:string;subtitle?:string;children:React.ReactNode}) {
 return <details className="evidence-section"><summary><div><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</div><ChevronDown size={18}/></summary><div className="evidence-section-body">{children}</div></details>;
}

function RegionalGrid({regions}:{regions?: RegionalMeasurement[]}) {
 if (!regions?.length) return <div className="unavailable-data">Regional measurements unavailable.</div>;
 return <div className="regional-grid" role="table" aria-label="4 by 4 regional measurements">{regions.map((region,index)=>{
  const label=typeof region.region==='string'?region.region:`Region ${typeof region.row==='number'&&typeof region.column==='number'?`${region.row+1}.${region.column+1}`:index+1}`;
  const value=typeof region.value==='number'?region.value:Object.values(region.measurements ?? {}).find(value=>typeof value==='number');
  return <div className="regional-cell" role="cell" key={label}><span>{label}</span><strong>{typeof value==='number'?value.toFixed(4):'N/A'}</strong></div>;
 })}</div>;
}

function Visualization({url,title,alt}:{url?:string;title:string;alt:string}) {
 const [open,setOpen]=useState(false);
 if(!url) return <div className="visualization-placeholder"><ImageIcon/><span>{title} unavailable</span></div>;
 return <><div className="visualization-card"><div className="visualization-toolbar"><span>{title}</span><button className="icon-button" type="button" aria-label={`Expand ${title}`} onClick={()=>setOpen(true)}><Maximize2 size={16}/></button></div><img src={url} alt={alt}/></div>{open&&<div className="dialog-backdrop" role="presentation" onClick={()=>setOpen(false)}><div className="image-modal" role="dialog" aria-modal="true" aria-label={`${title} enlarged view`} onClick={event=>event.stopPropagation()}><button className="icon-button dialog-close" type="button" aria-label="Close enlarged visualization" onClick={()=>setOpen(false)}>×</button><img src={url} alt={alt}/></div></div>}</>;
}

export default function ImageEvidenceDashboard({evidence}:{evidence:ImageForensicEvidence}) {
 const exif=evidence.exif;
 const elaRgb=rgbRows(evidence.ela?.rgb);
 const noiseRgb=rgbRows(evidence.noise?.rgb);
 const statusTone=(status?:string)=>status==='completed'?'completed':status==='running'?'running':status==='pending'?'pending':status==='failed'?'failed':status==='unavailable'?'unavailable':'not-implemented';
 const moduleLabel=(status?:string)=>status==='completed'?'Completed':status==='running'?'Analysis in progress':status==='pending'?'Analysis in progress':status==='failed'?'Failed':status==='unavailable'?'Unavailable':'Not yet implemented';

 return <div className="image-evidence-dashboard">
  <EvidenceDetails title="Investigation summary" subtitle="File and analysis metadata">
   <div className="summary-grid">
    <div><span>Investigation ID</span><strong>{evidence.sha256 ? 'Unavailable' : 'Unavailable'}</strong></div>
    <div><span>File format</span><strong>{evidence.fileFormat ?? 'Unavailable'}</strong></div>
    <div><span>File size</span><strong>{formatBytes(evidence.fileSize)}</strong></div>
    <div><span>Image dimensions</span><strong>{evidence.width&&evidence.height?`${evidence.width} × ${evidence.height} px`:evidence.width||evidence.height?`${evidence.width ?? evidence.height ?? 'Unavailable'} px`:'Unavailable'}</strong></div>
    <div><span>Resolution</span><strong>{evidence.resolution ?? 'Unavailable'}</strong></div>
    <div><span>SHA-256</span><strong className="hash-value">{evidence.sha256 ?? 'Unavailable'}</strong></div>
   </div>
  </EvidenceDetails>

  <EvidenceDetails title="Metadata & EXIF" subtitle="Camera, timestamps and editing context">
   <div className="metadata-grid"><div><span>Camera manufacturer</span><strong>{exif?.cameraManufacturer ?? 'Unavailable'}</strong></div><div><span>Camera model</span><strong>{exif?.cameraModel ?? 'Unavailable'}</strong></div><div><span>Original timestamp</span><strong>{exif?.originalTimestamp ?? 'Unavailable'}</strong></div><div><span>Modification timestamp</span><strong>{exif?.modificationTimestamp ?? 'Unavailable'}</strong></div><div><span>Editing software</span><strong>{exif?.editingSoftware ?? 'Unavailable'}</strong></div><div><span>GPS metadata presence</span><strong>{exif?.gpsPresent===undefined?'Unavailable':exif.gpsPresent?'Present — coordinates not displayed':'Not present'}</strong></div></div>
  </EvidenceDetails>

  <EvidenceDetails title="Error Level Analysis" subtitle="ELA visualization and regional measurements">
   <div className="evidence-visual-grid"><Visualization url={evidence.originalImageUrl} title="Original image" alt="Original uploaded image"/><Visualization url={evidence.ela?.visualizationUrl} title="ELA visualization" alt="Backend-provided Error Level Analysis visualization"/></div>
   <div className="measurement-grid"><section><h3>Overall difference</h3>{evidence.ela?.difference&&Object.keys(evidence.ela.difference).length?<dl>{Object.entries(evidence.ela.difference).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{typeof value==='number'?value.toFixed(6):String(value)}</dd></div>)}</dl>:<div className="unavailable-data">Overall ELA metrics unavailable.</div>}</section><section><h3>RGB channel measurements</h3>{elaRgb.length?<dl>{elaRgb.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.toFixed(6)}</dd></div>)}</dl>:<div className="unavailable-data">ELA RGB measurements unavailable.</div>}</section></div>
   <h3 className="regional-heading">4×4 regional analysis</h3><RegionalGrid regions={evidence.ela?.regional}/>
  </EvidenceDetails>

  <EvidenceDetails title="Noise residual analysis" subtitle="Residual visualization and statistical measurements">
   <Visualization url={evidence.noise?.visualizationUrl} title="Noise residual visualization" alt="Backend-provided noise residual visualization"/>
   <div className="measurement-grid"><section><h3>Gaussian smoothing</h3><div className="unavailable-data">{typeof evidence.noise?.gaussianSmoothing==='string'?evidence.noise.gaussianSmoothing: evidence.noise?.gaussianSmoothing?JSON.stringify(evidence.noise.gaussianSmoothing):'Gaussian smoothing information unavailable.'}</div></section><section><h3>Residual statistics</h3>{evidence.noise?.statistics&&Object.keys(evidence.noise.statistics).length?<dl>{Object.entries(evidence.noise.statistics).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{typeof value==='number'?value.toFixed(6):String(value)}</dd></div>)}</dl>:<div className="unavailable-data">Residual statistical measurements unavailable.</div>}</section><section><h3>RGB channel analysis</h3>{noiseRgb.length?<dl>{noiseRgb.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.toFixed(6)}</dd></div>)}</dl>:<div className="unavailable-data">Noise RGB measurements unavailable.</div>}</section></div>
   <h3 className="regional-heading">Regional residual measurements</h3><RegionalGrid regions={evidence.noise?.regional}/>
  </EvidenceDetails>

  <EvidenceDetails title="Evidence interpretation" subtitle="Backend observations only; not a final authenticity judgment">
   <div className="evidence-note"><ShieldAlert/><p>ELA or noise residual anomalies are indicators that require contextual review. They do not prove manipulation or AI generation.</p></div>
   {[['Observed indicators',evidence.evidence?.observedIndicators],['Supporting evidence',evidence.evidence?.supportingEvidence],['Potential anomalies',evidence.evidence?.potentialAnomalies],['Limitations',evidence.evidence?.limitations],['Interpretation notes',evidence.evidence?.interpretationNotes]].map(([title,items])=><section className="interpretation-block" key={String(title)}><h3>{String(title)}</h3>{Array.isArray(items)&&items.length?<ul>{items.map(item=><li key={item}>{item}</li>)}</ul>:<p>Unavailable.</p>}</section>) }
  </EvidenceDetails>

  <EvidenceDetails title="Module status" subtitle="Implemented and unavailable forensic capabilities">
   <div className="module-status-grid"><div><span>ELA</span><strong className={statusTone(evidence.ela?.status)}>{moduleLabel(evidence.ela?.status)}</strong></div><div><span>Noise residual</span><strong className={statusTone(evidence.noise?.status)}>{moduleLabel(evidence.noise?.status)}</strong></div><div><span>Frequency domain</span><strong className={statusTone(evidence.frequencyStatus)}>Not yet implemented</strong></div><div><span>Regional anomaly</span><strong className={statusTone(evidence.regionalStatus)}>Not yet implemented</strong></div><div><span>Evidence aggregation</span><strong className={statusTone(evidence.evidenceStatus)}>Not yet implemented</strong></div></div>
  </EvidenceDetails>
 </div>;
}
