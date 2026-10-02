import {mediaFetch} from "../lib/media-fetch";
import {useState} from 'react';
import {analyzeVideo} from '../lib/video-analysis';
export function VideoLink({url,profileId,disabled,onUrl,onText}:{url:string;profileId:string;disabled:boolean;onUrl:(url:string)=>void;onText:(text:string)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [status,setStatus]=useState('');
 const validUrl=(()=>{try{const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password;}catch{return false;}})();
 async function read(){
  setBusy(true);setError('');setStatus('Downloading video…');
  try{
   const response=await mediaFetch('/api/local-capture/video-import',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1'},body:JSON.stringify({url}),signal:AbortSignal.timeout(600000)});
   if(!response.ok){const failure=await response.json().catch(()=>null);throw Error(typeof failure?.error==='string'?failure.error:'Import could not finish. Try again or choose Upload file.');}
   const data=await analyzeVideo(await response.blob(),profileId,setStatus,true);
   if(typeof data.text!=='string'||!data.text.trim())throw Error('No speech was found. Try a video with clear audio.');
   onText(data.text);
   setStatus('Video ready. Select Create my script to continue.');
  }catch(e){setStatus('');setError(e instanceof Error?e.message:'Video import failed. Try uploading the file.');}finally{setBusy(false);}
 }
 return <section aria-busy={busy}><label>Paste a video link<input type="url" value={url} disabled={disabled||busy} placeholder="https://…" onChange={e=>{setStatus('');setError('');onUrl(e.target.value);}}/></label><button type="button" className="button" disabled={busy||disabled||!validUrl||!profileId} onClick={()=>void read()}>{busy?status:'Import & analyze video →'}</button>{status&&<p role="status">{status}</p>}{url.trim()&&!validUrl&&<p role="alert">Paste a video URL starting with https:// — not the instructions below.</p>}<p><small>Original video: up to 3 minutes and 500 MB. Larger files may take a few minutes to prepare.</small></p><details><summary>How video analysis works</summary><p>Audio and eight sampled frames are sent to OpenAI. Sampling may miss details. Only import videos you have permission to use.</p></details>{error&&<p role="alert">{error}</p>}</section>;
}
