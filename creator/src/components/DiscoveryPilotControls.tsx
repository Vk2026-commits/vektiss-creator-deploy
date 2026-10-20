import {useEffect,useState} from 'react';
import {discoverySettings,type DiscoverySettings} from '../lib/research-client';
export function DiscoveryPilotControls({profileId,revision,onUpdated}:{profileId:string;revision:number;onUpdated:()=>void}){
 const [settings,setSettings]=useState<DiscoverySettings|null>(null),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;setSettings(null);setError('');void discoverySettings(profileId).then(x=>{if(live)setSettings(x);}).catch(()=>{if(live)setError('Search settings could not load.');});return()=>{live=false;};},[profileId,revision]);
 async function change(action:'toggle'|'follow'|'remove',options:{enabled?:boolean;url?:string;id?:string}){setBusy(true);setError('');try{setSettings(await discoverySettings(profileId,action,options));setUrl('');onUpdated();}catch(e){setError(e instanceof Error?e.message:'Could not save search settings.');}finally{setBusy(false);}}
 if(!settings?.configured)return error?<p role="alert">{error}</p>:null;
 return <details className="discovery-pilot"><summary>Enhanced discovery · {settings.enabled?'On':'Off'}</summary>
  <label><input type="checkbox" checked={settings.enabled} disabled={busy} onChange={e=>void change('toggle',{enabled:e.target.checked})}/> Use focused searches and inspect up to five shortlisted clips</label>
  <p>Metadata and sampled video evidence are labeled separately. Earnings claims remain unverified. Turning this off restores the previous search flow.</p>
  {settings.provider==='Scrape Creators'?<p>Public video search and engagement counts use Scrape Creators. Searches are capped at 40 API requests, including up to five creator comparisons. Unavailable metrics do not pass active filters.</p>:settings.youtube==='apify_fallback'&&<p>YouTube uses the existing Apify search route; the official API is not configured.</p>}
  <h3>Creators to follow</h3><p>Checked when you run a video search. No scheduled polling.</p>
  <form onSubmit={e=>{e.preventDefault();void change('follow',{url});}}><label>Public TikTok, Instagram, or YouTube creator URL<input type="url" required value={url} disabled={busy} onChange={e=>setUrl(e.target.value)} placeholder="https://www.youtube.com/@creator"/></label><button type="submit" className="button secondary" disabled={busy||!url.trim()}>Follow creator</button></form>
  {!settings.watchlist.length&&<p>No creators followed yet.</p>}
  <ul>{settings.watchlist.map(w=><li key={w.id}><a href={w.url} target="_blank" rel="noreferrer">{w.name}</a> · {w.platform} <button type="button" disabled={busy} onClick={()=>void change('remove',{id:w.id})} aria-label={`Stop following ${w.name}`}>Remove</button></li>)}</ul>
  {error&&<p role="alert">{error}</p>}
 </details>;
}
