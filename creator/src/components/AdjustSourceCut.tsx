import {useRef,useState} from 'react';
import type {SourceCut} from '../domain/source-cut';
import {loadSourceVideo,analyzeSelection} from '../lib/source-cut';
import {SourceCutControls} from './SourceCutControls';
import type {DraftProgress} from './ScriptProgress';
export function AdjustSourceCut({cut,profileId,disabled,onComplete,onProcessing,onProgress}:{cut:SourceCut;profileId:string;disabled:boolean;onComplete:(text:string,cut:SourceCut)=>Promise<void>;onProcessing:(busy:boolean)=>void;onProgress?:(progress:DraftProgress)=>void}){
 const [blob,setBlob]=useState<Blob|null>(null),[end,setEnd]=useState(cut.end),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const running=useRef(false);
 async function run(apply:boolean){
  if(disabled||running.current)return;running.current=true;setBusy(true);onProcessing(true);setMessage('');
  const progress=(label:string)=>{setMessage(label);if(apply)onProgress?.({percent:0,label,indeterminate:true});};
  try{progress('Loading your saved source…');const original=blob??await loadSourceVideo(cut.original_id);setBlob(original);if(apply){const result=await analyzeSelection(original,cut.original_id,cut.duration,end,'Cut adjusted by you.',profileId,progress);await onComplete(result.text,result.cut);setBlob(null);}else setMessage('');}catch(e){const label=e instanceof Error?e.message:'Could not adjust the clip. Your existing script is unchanged.';setMessage(label);if(apply)onProgress?.({percent:0,label,failed:true});}finally{running.current=false;setBusy(false);onProcessing(false);}
 }
 return <section aria-label="Original footage selection"><small>Original footage: 0–{cut.end.toFixed(2)}s</small>{blob?<><SourceCutControls blob={blob} end={end} onEnd={setEnd} disabled={busy||disabled}/><button type="button" disabled={busy||disabled||end<1||end>cut.duration} onClick={()=>void run(true)}>Apply cut & rewrite script</button><button type="button" disabled={busy} onClick={()=>setBlob(null)}>Cancel</button></>:<button type="button" disabled={busy||disabled} onClick={()=>void run(false)}>Adjust cut</button>}{message&&<p role="status">{message}</p>}</section>;
}
