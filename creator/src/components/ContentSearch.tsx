import {useState} from 'react';
import {supabase} from '../lib/supabase';
type Result={title:string;url:string;snippet:string;date?:string};
export function ContentSearch({profileId,disabled,onSelect}:{profileId:string;disabled:boolean;onSelect:(url:string,kind:'article'|'video')=>void}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<Result[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[searched,setSearched]=useState(false);
 async function search(){
  if(!supabase||busy)return;
  setBusy(true);setError('');setResults([]);setSearched(false);
  try{
   const {data,error}=await supabase.functions.invoke('content-search',{body:{query,platform:'all',profileId},signal:AbortSignal.timeout(40000)});
   if(error){let code='';try{code=(await error.context.json()).code;}catch{}throw Error(code==='NOT_CONFIGURED'?'Content search is not connected yet. You can still paste a link or upload a video.':code==='RATE_LIMIT'?'Search limit reached. Please try again later.':'Search could not finish. Please try again.');}
   setResults(data.results);setSearched(true);
  }catch(e){setError(e instanceof Error?e.message:'Search failed. Please retry.');}finally{setBusy(false);}
 }
 return <section aria-label="Find content"><p>Find articles and videos about any topic. No need to choose a platform.</p><label>What are you looking for?<input value={query} maxLength={500} placeholder="e.g. recent videos about women’s safety" disabled={busy||disabled} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&query.trim().length>=3){e.preventDefault();void search();}}}/></label><button type="button" className="button" disabled={busy||disabled||!profileId||query.trim().length<3} onClick={()=>void search()}>{busy?'Finding content…':'Find content'}</button><p><small>Results are previews. We’ll read the source after you select it, where supported.</small></p>{error&&<p role="alert">{error}</p>}{searched&&!results.length&&<p role="status">No results found. Try a different search.</p>}<div className="content-search-results">{results.map(r=>{const host=new URL(r.url).hostname;const video=/(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com)$/.test(host)||/\.(mp4|webm)(\?|$)/i.test(r.url);return <article key={r.url}><small>{host}{r.date?` · ${r.date}`:''}</small><h3>{r.title}</h3><p>{r.snippet}</p><a href={r.url} target="_blank" rel="noopener noreferrer">Open source ↗</a><button type="button" className="button" onClick={()=>onSelect(r.url,video?'video':'article')}>Use this source →</button>{video&&<small>This video may need a file upload before we can read its audio.</small>}</article>;})}</div></section>;
}
