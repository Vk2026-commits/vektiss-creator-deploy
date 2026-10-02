import {useRef,useState} from 'react';
import type {SourceCut} from '../domain/source-cut';
import {loadSourceVideo,analyzeSelection} from '../lib/source-cut';
import {SourceCutControls} from './SourceCutControls';
export function AdjustSourceCut({cut,profileId,disabled,onComplete,onProcessing}:{cut:SourceCut;profileId:string;disabled:boolean;onComplete:(text:string,cut:SourceCut)=>Promise<void>;onProcessing:(busy:boolean)=>void}){
 const [blob,setBlob]=useState<Blob|null>(null),[end,setEnd]=useState(cut.end),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const running=useRef(false);
 async function run(apply:boolean){
  if(disabled||running.current)return;running.current=true;setBusy(true);onProcessing(true);setMessage('');
  try{const original=blob??await loadSourceVideo(cut.original_id);setBlob(original);if(apply){const result=await analyzeSelection(original,cut.original_id,cut.duration,end,'Cut adjusted by you.',profileId,setMessage);await onComplete(result.text,result.cut);setBlob(null);}}catch(e){setMessage(e instanceof Error?e.message:'Could not adjust the clip. Your existing script is unchanged.');}finally{running.current=false;setBusy(false);onProcessing(false);}
 }
 return <section aria-label="Original footage selection"><small>Original footage: 0–{cut.end.toFixed(2)}s</small>{blob?<><SourceCutControls blob={blob} end={end} onEnd={setEnd} disabled={busy||disabled}/><button type="button" disabled={busy||disabled||end<1||end>cut.duration} onClick={()=>void run(true)}>Apply cut & rewrite script</button><button type="button" disabled={busy} onClick={()=>setBlob(null)}>Cancel</button></>:<button type="button" disabled={busy||disabled} onClick={()=>void run(false)}>Adjust cut</button>}{message&&<p role="status">{message}</p>}</section>;
}
