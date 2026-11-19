import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Common';
export default function History(){const [q,setQ]=useState('');const nav=useNavigate();return <><PageHeader title="Scan history" description="Search and manage completed investigations."/><div className="history-toolbar"><label className="search-box"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search investigations"/></label><button className="filter-button"><SlidersHorizontal/>Media: All</button><button className="filter-button">Assessment: All</button><button className="filter-button">Newest first</button></div><div className="card"><EmptyState title="No investigations found" message="No scan history exists in this browser." action={<button className="button primary" onClick={()=>nav('/analyze')}>Start an investigation</button>}/></div></>}
