import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Video, AudioLines, TextCursorInput, Play, Trash2, WifiOff } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FileDropzone from '../components/ui/FileDropzone';
import { submitInvestigation, isBackendConfigured } from '../services/analysisAdapter';
import type { MediaType } from '../types';

const types = [
  ['image', 'Image', Image], ['video', 'Video', Video],
  ['audio', 'Audio', AudioLines], ['text', 'Text', TextCursorInput],
] as const;

export default function Analyze() {
  const navigate = useNavigate();
  const [type, setType] = useState<MediaType>('image');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  const validate = (next: File) => {
    setError('');
    if (next.size > 250 * 1024 * 1024) { setError('File exceeds the 250 MB limit.'); return; }
    const ext = next.name.split('.').pop()?.toLowerCase();
    const formats = { image:['jpg','jpeg','png','webp'], video:['mp4','mov','avi'], audio:['mp3','wav','m4a'], text:['txt'] };
    if (!formats[type].includes(ext || '')) { setError(`Unsupported ${type} format.`); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(type === 'text' ? '' : URL.createObjectURL(next));
  };

  const clear = () => { if (preview) URL.revokeObjectURL(preview); setPreview(''); setFile(null); setText(''); setError(''); };
  const submit = async () => {
    if (type === 'text' && !text.trim()) { setError('Enter text or upload a TXT file.'); return; }
    if (type !== 'text' && !file) { setError('Select media before starting analysis.'); return; }
    if (!isBackendConfigured()) { setError('Forensic engine not connected'); return; }
    try { await submitInvestigation({mediaType:type, file:file || undefined, text:type === 'text' ? text : undefined}); navigate('/processing'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Submission failed'); }
  };

  return <>
    <PageHeader title="Analyze media" description="Prepare evidence for forensic examination. Media stays local until submission." />
    <div className="analyze-layout">
      <section className="card evidence-panel">
        <div className="card-header"><span>01 / MEDIA SOURCE</span><h3>Select media type</h3></div>
        <div className="media-tabs">{types.map(([key,label,Icon]) => <button key={key} className={type === key ? 'active':''} onClick={()=>{setType(key);clear();}}><Icon/><span>{label}</span></button>)}</div>
        {type === 'text' ? <div className="text-source">
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste text for examination…" />
          <div className="text-tools"><span>{text.length} characters</span><button className="button secondary small" onClick={()=>{const input=document.createElement('input');input.type='file';input.accept='.txt,text/plain';input.onchange=()=>input.files?.[0]&&validate(input.files[0]);input.click();}}>Upload TXT</button></div>
        </div> : <>
          <FileDropzone mediaType={type} file={file} onFile={validate} onRemove={()=>{if(preview)URL.revokeObjectURL(preview);setPreview('');setFile(null);}} />
          {preview && <div className="media-preview-local">{type==='image'&&<img src={preview} alt="Selected media preview"/>}{type==='video'&&<video src={preview} controls/>}{type==='audio'&&<audio src={preview} controls/>}</div>}
        </>}
        {error && <div className="validation-error">{error}</div>}
      </section>
      <aside className="card submit-panel">
        <div className="card-header"><span>02 / SUBMISSION</span><h3>Investigation</h3></div>
        <div className="submission-info"><div><span>Media type</span><strong>{types.find(t=>t[0]===type)?.[1]}</strong></div><div><span>Submission target</span><strong><span className="offline-dot"/>Own backend</strong></div></div>
        <div className="privacy-note"><WifiOff/><p>Local processing is not performed by this frontend. Configure the backend before submission.</p></div>
        <button className="button primary wide" onClick={submit}><Play size={16}/>Start analysis</button>
        {(file || text) && <button className="button ghost wide" onClick={clear}><Trash2 size={15}/>Clear</button>}
      </aside>
    </div>
  </>;
}
