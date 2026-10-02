import {mediaFetch} from "../lib/media-fetch";
import {useRef,useState} from 'react';
import type {DraftProgress} from './ScriptProgress';
import {detectReaction} from '../lib/video-analysis';
import {saveSourceVideo,analyzeSelection} from '../lib/source-cut';
import type {SourceCut} from '../domain/source-cut';
import {SourceCutControls} from './SourceCutControls';
import {HostedSourceVideo} from './HostedSourceVideo';
export function SourceVideo({mode,url,profileId,disabled,onUrl,onComplete,onProcessing,onProgress,scope}:{scope?:string;mode:'link'|'upload';url:string;profileId:string;disabled:boolean;onUrl:(url:string)=>void;onComplete:(source:string,cut:SourceCut)=>Promise<void>;onProcessing:(busy:boolean)=>void;onProgress?:(progress:DraftProgress)=>void}){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const running=useRef(false);
 const [retained,setRetained]=useState<{blob:Blob;id:string;duration:number;reason:string}|null>(null),[end,setEnd]=useState(0);
 const progress=(label:string)=>{setStatus(label);onProgress?.({percent:0,label,indeterminate:true});};
 async function finish(blob:Blob,id:string,duration:number,selectedEnd:number,reason:string){
  const result=await analyzeSelection(blob,id,duration,selectedEnd,reason,profileId,progress);await onComplete(result.text,result.cut);
 }
 async function applyCut(){
  if(!retained||running.current||disabled)return;running.current=true;setBusy(true);onProcessing(true);setError('');progress('Applying your cut…');
  try{await finish(retained.blob,retained.id,retained.duration,end,'Cut selected by you.');setRetained(null);}catch(e){const message=e instanceof Error?e.message:'Could not apply cut. Your source is retained.';setError(message);setStatus('');onProgress?.({percent:0,label:message,failed:true});}finally{running.current=false;setBusy(false);onProcessing(false);}
 }
 const valid=mode==='upload'?Boolean(file):(()=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}})();
 async function create(){
  if(running.current||disabled||!valid||!profileId)return;
  running.current=true;setBusy(true);onProcessing(true);setError('');progress('Preparing your video…');
  try{
   let blob:Blob;
   if(mode==='upload'){blob=file!;}else{
    progress('Importing your video…');
    const response=await mediaFetch('/api/local-capture/video-import',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1'},body:JSON.stringify({url}),signal:AbortSignal.timeout(600000)});
    if(!response.ok){const failure=await response.json().catch(()=>null);throw Error(failure?.error??'Import failed. Try again or upload the video.');}
    blob=await response.blob();
   }
   progress('Saving your source…');const id=await saveSourceVideo(blob);
   setRetained({blob,id,duration:180,reason:'Check where the original footage ends.'});
   const detected=await detectReaction(blob,profileId,progress);
   setEnd(detected.end??detected.boundary.end??detected.duration);
   setRetained({blob,id,duration:detected.duration,reason:detected.boundary.reason});
   if(detected.end===null){setStatus('');onProgress?.({percent:0,label:'Check your cut',waiting:true});return;}
   await finish(blob,id,detected.duration,detected.end,detected.boundary.reason);setRetained(null);
  }catch(e){onProgress?.({percent:0,label:'Could not finish. Please retry.',failed:true});setError(e instanceof Error?e.message:'Could not create your draft. Please retry.');setStatus('');}
  finally{running.current=false;setBusy(false);onProcessing(false);}
 }
 if(import.meta.env.PROD&&scope)return <HostedSourceVideo {...{scope,mode,url,profileId,disabled,onUrl,onComplete,onProcessing,onProgress}}/>;
 return <section aria-busy={busy}>
  {retained&&!busy&&<section><p>{retained.reason}</p><SourceCutControls blob={retained.blob} end={end} onEnd={setEnd} disabled={disabled} onDuration={duration=>setRetained(value=>value?{...value,duration}:null)}/><button type="button" className="button" disabled={disabled||end<1} onClick={()=>void applyCut()}>Use this cut & create script →</button></section>}
  {mode==='link'?<label>Paste a video link<input type="url" value={url} placeholder="https://…" disabled={busy||disabled} onChange={e=>{setRetained(null);setEnd(0);onUrl(e.target.value);setError('');}}/></label>:<label>Choose your video<input type="file" accept="video/mp4,video/webm" disabled={busy||disabled} onChange={e=>{const chosen=e.target.files?.[0];if(!chosen)return;setRetained(null);setEnd(0);if(chosen.size>500*1024*1024){setError('Choose a video up to 500 MB.');setFile(null);e.target.value='';return;}setFile(chosen);setError('');}}/></label>}
  <p><small>Up to 3 minutes · 500 MB · MP4 or WebM</small></p>
  {!retained&&<button type="button" className="button" disabled={busy||disabled||!valid||!profileId} onClick={()=>void create()}>{busy?'Creating your script…':'Create my script →'}</button>}
  {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  <details><summary>How it works</summary><p>We analyze audio and sampled frames, then use your profile to draft a script. You approve the angle and script next. No video render starts here.</p><p>Audio and sampled frames are sent to OpenAI. Sampling can miss details. Only use videos you have permission to use.</p></details>
 </section>;
}
