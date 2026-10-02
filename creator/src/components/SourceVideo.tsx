import {mediaFetch} from "../lib/media-fetch";
import {useRef,useState} from 'react';
import type {DraftProgress} from './ScriptProgress';
import {analyzeVideo} from '../lib/video-analysis';
export function SourceVideo({mode,url,profileId,disabled,onUrl,onComplete,onProcessing,onProgress}:{mode:'link'|'upload';url:string;profileId:string;disabled:boolean;onUrl:(url:string)=>void;onComplete:(source:string)=>Promise<void>;onProcessing:(busy:boolean)=>void;onProgress?:(progress:DraftProgress)=>void}){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const running=useRef(false);
 const valid=mode==='upload'?Boolean(file):(()=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}})();
 async function create(){
  if(running.current||disabled||!valid||!profileId)return;
  running.current=true;setBusy(true);onProcessing(true);setError('');onProgress?.({percent:5,label:'Preparing your video…'});
  try{
   let blob:Blob;
   if(mode==='upload'){blob=file!;}else{
    setStatus('Importing your video…');
    const response=await mediaFetch('/api/local-capture/video-import',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1'},body:JSON.stringify({url}),signal:AbortSignal.timeout(600000)});
    if(!response.ok){const failure=await response.json().catch(()=>null);throw Error(failure?.error??'Import failed. Try again or upload the video.');}
    blob=await response.blob();
   }
   const result=await analyzeVideo(blob,profileId,label=>{setStatus(label);const percent=label.startsWith('Uploading')?10:label.startsWith('Following')?30:label.startsWith('Listening')?45:60;onProgress?.({percent,label});},mode==='link');
   if(!result.text.trim())throw Error('Could not understand this video. Try another source.');
   setStatus('Writing your script and angle…');
   await onComplete(result.text);
  }catch(e){onProgress?.({percent:0,label:'Could not finish. Please retry.',failed:true});setError(e instanceof Error?e.message:'Could not create your draft. Please retry.');setStatus('');}
  finally{running.current=false;setBusy(false);onProcessing(false);}
 }
 return <section aria-busy={busy}>
  {mode==='link'?<label>Paste a video link<input type="url" value={url} placeholder="https://…" disabled={busy||disabled} onChange={e=>{onUrl(e.target.value);setError('');}}/></label>:<label>Choose your video<input type="file" accept="video/mp4,video/webm" disabled={busy||disabled} onChange={e=>{const chosen=e.target.files?.[0];if(!chosen)return;if(chosen.size>500*1024*1024){setError('Choose a video up to 500 MB.');setFile(null);e.target.value='';return;}setFile(chosen);setError('');}}/></label>}
  <p><small>Up to 3 minutes · 500 MB · MP4 or WebM</small></p>
  <button type="button" className="button" disabled={busy||disabled||!valid||!profileId} onClick={()=>void create()}>{busy?'Creating your script…':'Create my script →'}</button>
  {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  <details><summary>How it works</summary><p>We analyze audio and sampled frames, then use your profile to draft a script. You approve the angle and script next. No video render starts here.</p><p>Audio and sampled frames are sent to OpenAI. Sampling can miss details. Only use videos you have permission to use.</p></details>
 </section>;
}
