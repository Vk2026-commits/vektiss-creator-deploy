import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {mediaFetch} from '../lib/media-fetch';
import {recoveryRead,recoveryWrite} from '../lib/recovery-storage';
import {loadSourceVideo} from '../lib/source-cut';
import {sourceCutSchema,type SourceCut} from '../domain/source-cut';
import {SourceCutControls} from './SourceCutControls';
import type {DraftProgress} from './ScriptProgress';

const waitingSchema=z.object({original_id:z.string().uuid(),duration:z.number().positive(),end:z.number().positive(),reason:z.string(),waiting:z.literal(true)});
const checkpointSchema=z.object({operation:z.string().uuid(),waiting:waitingSchema.optional()});
type Props={costProjectId?:string;originalId?:string;initialFile?:File;hideInput?:boolean;scope:string;mode:'link'|'upload';url:string;profileId:string;disabled:boolean;onUrl:(url:string)=>void;onComplete:(text:string,cut:SourceCut)=>Promise<void>;onProcessing:(busy:boolean)=>void;onProgress?:(p:DraftProgress)=>void};
export function HostedSourceVideo(props:Props){
 const key=`vektiss:source-workflow:v1:${props.scope}`;
 const [file,setFile]=useState<File|null>(props.initialFile??null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [waiting,setWaiting]=useState<z.infer<typeof waitingSchema>|null>(null),[blob,setBlob]=useState<Blob|null>(null),[end,setEnd]=useState(0);
 const controller=useRef<AbortController|null>(null);
 const callbacks=useRef(props);callbacks.current=props;
 async function showCut(value:z.infer<typeof waitingSchema>,signal:AbortSignal){
  const source=await loadSourceVideo(value.original_id);if(signal.aborted)return;
  setWaiting(value);setEnd(value.end);setBlob(source);callbacks.current.onProgress?.({percent:0,label:'Check your cut',waiting:true});
 }
 async function run(operation:string,body?:BodyInit,type='application/json',resume=false){
  controller.current?.abort();const current=new AbortController();controller.current=current;
  setBusy(true);setError('');callbacks.current.onProcessing(true);
  callbacks.current.onProgress?.({percent:10,label:resume?'Reconnecting to saved source analysis…':'Sending source — keep this page open until accepted…'});
  try{
   const response=await mediaFetch('/api/local-capture/source-workflow',{method:'POST',headers:{'Content-Type':type,'X-Profile-Id':props.profileId,...(props.costProjectId?{'X-Cost-Project':props.costProjectId}:{})},body,signal:current.signal},operation,resume,()=>{if(!current.signal.aborted)callbacks.current.onProgress?.({percent:35,label:'Source accepted. Analyzing on the server — safe to lock your phone.'});});
   const result=await response.json();if(!response.ok)throw Error(result.error??'Source analysis could not finish.');
   if(current.signal.aborted)return;
   if(result.waiting){
    const value=waitingSchema.parse(result);recoveryWrite(key,JSON.stringify({operation,waiting:value}));await showCut(value,current.signal);
   }else{
    const text=z.string().min(1).max(40000).parse(result.text),cut=sourceCutSchema.parse(result.cut);
    await callbacks.current.onComplete(text,cut);
    if(!current.signal.aborted){recoveryWrite(key,null);setWaiting(null);setBlob(null);}
   }
  }catch(e){if(!current.signal.aborted){setError(e instanceof Error?e.message:'Could not reconnect.');callbacks.current.onProgress?.({percent:35,label:'Could not finish. Your saved work is preserved.',failed:true});}}
  finally{if(!current.signal.aborted){setBusy(false);callbacks.current.onProcessing(false);}}
 }
 useEffect(()=>{
  let checkpoint:z.infer<typeof checkpointSchema>|null=null;
  try{checkpoint=checkpointSchema.parse(JSON.parse(recoveryRead(key)??'null'));}catch{/* No resumable source. */}
  if(checkpoint?.waiting){
   const current=new AbortController();controller.current=current;
   void showCut(checkpoint.waiting,current.signal).catch(()=>{if(!current.signal.aborted)setError('Could not reload the saved source. Retry when you are connected.');});
  }else if(checkpoint)void run(checkpoint.operation,undefined,'application/json',true);
  return()=>{controller.current?.abort();callbacks.current.onProcessing(false);};
 },[key]);
 function start(){
  if(busy||props.disabled)return;
  const operation=crypto.randomUUID();recoveryWrite(key,JSON.stringify({operation}));
  if(waiting)void run(operation,JSON.stringify({original_id:waiting.original_id,end}));
  else if(props.originalId)void run(operation,JSON.stringify({original_id:props.originalId}));
  else if(props.mode==='upload'&&file)void run(operation,file,file.type||'video/mp4');
  else void run(operation,JSON.stringify({url:props.url}));
 }
 return <section aria-busy={busy}>
  {waiting&&blob?<><p>{waiting.reason}</p><SourceCutControls blob={blob} end={end} onEnd={setEnd} disabled={busy||props.disabled} onDuration={()=>{}}/></>:props.hideInput?null:props.mode==='link'?<label>Paste a video link<input type="url" value={props.url} disabled={busy||props.disabled} onChange={e=>props.onUrl(e.target.value)}/></label>:<label>Choose your video<input type="file" accept="video/mp4,video/webm" disabled={busy||props.disabled} onChange={e=>{const value=e.target.files?.[0];if(value&&value.size<=500*1024*1024){setFile(value);setError('');}else{setFile(null);setError('Choose a video up to 500 MB.');}}}/></label>}
  {!props.originalId&&<p><small>Up to 3 minutes · 500 MB.</small></p>}
  <div className="workflow-action-bar"><button className="button" type="button" disabled={busy||props.disabled||!props.profileId||(!waiting&&!props.originalId&&(props.mode==='upload'?!file:!props.url.trim()))} onClick={start}>{busy?'Processing saved source…':waiting?'Use this cut & create script →':'Create my script →'}</button></div>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
