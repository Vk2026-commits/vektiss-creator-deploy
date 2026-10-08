import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import type {ScriptBrief} from '../domain/script-brief';
import type {SourceCut} from '../domain/source-cut';
import {ScriptProgress,type DraftProgress} from './ScriptProgress';
import {HostedSourceVideo} from './HostedSourceVideo';
import {GraphicSource} from './GraphicSource';
import {mediaFetch} from '../lib/media-fetch';
import {recoveryRead,recoveryWrite} from '../lib/recovery-storage';
import {loadSourceVideo} from '../lib/source-cut';
import {composerInput,resolvedSourceSchema,type ResolvedSource} from '../domain/resolved-source';
import './source-composer.css';
import {sourceUploadType} from '../domain/upload-type';

const checkpointSchema=z.object({operation:z.string().uuid(),text:z.string().max(12000),url:z.string(),notes:z.string(),result:resolvedSourceSchema.optional()});
function MediaPreview({file,id}:{file?:File;id?:string}){
 const [src,setSrc]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let disposed=false,url='';setSrc('');setError('');
  void (file?Promise.resolve(file):loadSourceVideo(id!)).then(blob=>{if(!disposed){url=URL.createObjectURL(blob);setSrc(url);}}).catch(()=>{if(!disposed)setError('Preview could not load. Your saved source is preserved.');});
  return()=>{disposed=true;if(url)URL.revokeObjectURL(url);};
 },[file,id]);
 return error?<span role="alert">{error}</span>:!src?<span role="status">Loading preview…</span>:file?.type.startsWith('image/')?<img src={src} alt="Attached screenshot"/>:<video className="resolved-video" src={src} controls playsInline preload="metadata"/>;
}
export function SourcePicker({brief,profileId,disabled,busy=false,scope,onSource,onCapture,onVideo,onGraphic,onProcessing,onProgress}:{brief:ScriptBrief;profileId:string;disabled:boolean;busy?:boolean;scope?:string;onSource:(patch:Partial<ScriptBrief>)=>void;onCapture:(capture:NonNullable<ScriptBrief['graphic_capture']>)=>void;onVideo:(text:string,cut:SourceCut)=>Promise<void>;onGraphic:(text:string)=>Promise<void>;onProcessing:(busy:boolean)=>void;onProgress?:(p:DraftProgress)=>void}){
 const key=`vektiss:source-composer:v1:${scope??'local'}:${profileId}`;
 const [text,setText]=useState([brief.url,brief.notes].filter(Boolean).join('\n\n'));
 const [file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[working,setWorking]=useState('');
 const [resolved,setResolved]=useState<ResolvedSource|null>(brief.prepared_source??(brief.graphic_capture?{kind:'graphic',capture:brief.graphic_capture}:null)),[conflict,setConflict]=useState(false);
 const input=useRef<HTMLInputElement>(null),active=useRef<AbortController|null>(null);
 const reviewHeading=useRef<HTMLHeadingElement>(null),wasWorking=useRef(false);
 useEffect(()=>{
  if(wasWorking.current&&!working&&resolved){reviewHeading.current?.focus({preventScroll:true});reviewHeading.current?.scrollIntoView({block:'start',behavior:'instant'});}
  wasWorking.current=!!working;
 },[working,resolved]);
 const callbacks=useRef({onSource,onProcessing,onProgress});callbacks.current={onSource,onProcessing,onProgress};
 const locked=busy||disabled||!!working;
 function selectFiles(files:File[]){
  if(locked)return;
  if(files.length!==1){setError('Add one video or screenshot at a time.');return;}
  const original=files[0],type=sourceUploadType(original);
  if(!type){setError('Choose an MP4 or WebM video, or a PNG, JPEG or WebP screenshot.');return;}
  const next=original.type===type?original:new File([original],original.name,{type,lastModified:original.lastModified}),video=type.startsWith('video/');
  if(next.size>(video?500:10)*1024*1024){setError(video?'Choose a video under 500 MB.':'Choose a screenshot under 10 MB.');return;}
  setError('');setFile(next);setConflict(false);setResolved(null);recoveryWrite(key,null);
 }
 async function run(checkpoint:z.infer<typeof checkpointSchema>,upload?:File,resume=false){
  if(active.current)return;
  const abort=new AbortController();active.current=abort;setError('');setWorking(resume?'Reconnecting to your source…':'Sending source — keep this page open until accepted…');callbacks.current.onProcessing(true);
  try{
   const response=await mediaFetch('/api/local-capture/source-resolve',{method:'POST',headers:{'Content-Type':upload?.type??'application/json','X-Profile-Id':profileId,...(brief.cost_project_id?{'X-Cost-Project':brief.cost_project_id}:{})},body:resume?undefined:upload??JSON.stringify({url:checkpoint.url}),signal:abort.signal},checkpoint.operation,resume,()=>{if(!abort.signal.aborted)setWorking('Source accepted. You can lock your phone while we prepare it.');});
   const body=await response.json();if(!response.ok)throw Error(body.error??'Could not read this link. Attach a video or screenshot instead.');
   const result=resolvedSourceSchema.parse(body);if(abort.signal.aborted)return;
   recoveryWrite(key,JSON.stringify({...checkpoint,result}));setResolved(result);
   callbacks.current.onSource({kind:result.kind,prepared_source:result,url:checkpoint.url,notes:checkpoint.notes,...(result.kind==='video'?{}:{graphic_capture:result.capture})});
  }catch(e){if(!abort.signal.aborted){setError(e instanceof Error?e.message:'Could not prepare your source. Try again or attach a file.');recoveryWrite(key,null);}}
  finally{if(!abort.signal.aborted){setWorking('');callbacks.current.onProcessing(false);}if(active.current===abort)active.current=null;}
 }
 useEffect(()=>{
  let saved:z.infer<typeof checkpointSchema>|null=null;
  try{saved=checkpointSchema.parse(JSON.parse(recoveryRead(key)??'null'));}catch{/* No saved operation. */}
  if(saved&&!brief.prepared_source){setText(saved.text);if(saved.result){setResolved(saved.result);callbacks.current.onSource({kind:saved.result.kind,prepared_source:saved.result,url:saved.url,notes:saved.notes,...(saved.result.kind==='video'?{}:{graphic_capture:saved.result.capture})});}else void run(saved,undefined,true);}
  return()=>{active.current?.abort();active.current=null;callbacks.current.onProcessing(false);};
 },[key]);
 function start(choice?:'file'|'link'){
  if(locked||active.current)return;
  const parsed=composerInput(text);
  if(parsed.links.length>1){setError('Use one source link at a time.');return;}
  if(file&&parsed.links.length&&!choice){setConflict(true);return;}
  const upload=choice==='link'?undefined:file??undefined,url=upload?'':parsed.links[0]??'';
  if(!upload&&!url){setError('Paste a source link or attach a video or screenshot.');return;}
  if(url.length>2000||parsed.notes.length>10000){setError('Keep the link under 2,000 characters and your direction under 10,000 characters.');return;}
  const checkpoint={operation:crypto.randomUUID(),text,url,notes:parsed.notes};
  setConflict(false);recoveryWrite(key,JSON.stringify(checkpoint));void run(checkpoint,upload);
 }
 return <section aria-label="Add your reaction source" aria-busy={!!working} className="reaction-source-picker">
  {!working&&<h2 ref={reviewHeading} tabIndex={-1} className="source-review-heading">{resolved?'Review your source':'What would you like to react to?'}</h2>}
  {working?null:!resolved?<><div className="source-composer" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();selectFiles(Array.from(e.dataTransfer.files));}}>
   {file&&<div className="source-attachment"><MediaPreview file={file}/><span>{file.name}</span><button type="button" aria-label="Remove attachment" disabled={locked} onClick={()=>{setFile(null);setConflict(false);}}>×</button></div>}
   <textarea aria-label="Source link and optional direction" placeholder="Paste a link or add a video or screenshot…" rows={3} maxLength={12000} value={text} disabled={locked} onChange={e=>{setText(e.target.value);setConflict(false);}} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();selectFiles(files);}}}/>
   <input ref={input} type="file" aria-label="Attach video or screenshot" hidden accept=".mp4,.MP4,.webm,.png,.jpg,.jpeg,.webp,video/mp4,video/webm,image/png,image/jpeg,image/webp" disabled={locked} onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length)selectFiles(files);e.target.value='';}}/>
   <div className="source-composer-footer"><button className="attach-source" type="button" aria-label="Add video or screenshot" title="Add video or screenshot" disabled={locked} onClick={()=>input.current?.click()}>＋</button><button className="button" type="button" disabled={locked||!profileId||(!file&&!text.trim())} onClick={()=>start()}>Continue →</button></div>
  </div><p className="source-composer-help">Instagram, TikTok, YouTube or an article link. You can also drop a file here and add direction for your reaction.</p><p className="source-composer-help">Videos: MP4 / WebM, 3 minutes, 500 MB. Screenshots: PNG / JPEG / WebP, 10 MB.</p></>:<>
   <div className="source-ready-toolbar"><span role="status">✓ {resolved.kind==='video'?'Video':resolved.kind==='article'?'Article':'Graphic post'} ready{resolved.firstOnly?' · First image':''}</span>
   <button type="button" disabled={locked} onClick={()=>{setResolved(null);recoveryWrite(key,null);onSource({prepared_source:undefined,graphic_capture:undefined,source_cut:undefined});}}>Change source</button></div>
   {resolved.kind==='video'?<div className="source-video-review"><div className="source-ready-preview"><MediaPreview id={resolved.original_id}/></div><HostedSourceVideo costProjectId={brief.cost_project_id} originalId={resolved.original_id} scope={`${key}:${resolved.original_id}`} mode="link" url={brief.url} hideInput {...{profileId,disabled,onProcessing,onProgress}} onUrl={url=>onSource({url})} onComplete={onVideo}/></div>:<GraphicSource costProjectId={brief.cost_project_id} mode="link" capture={brief.graphic_capture??resolved.capture} url={brief.url} {...{profileId,disabled,onProcessing,onCapture}} onComplete={onGraphic}/>}
  </>}
  {conflict&&<div role="group" aria-label="Choose one source"><p>You added a file and a link. Which should we use?</p><button type="button" disabled={locked} onClick={()=>start('file')}>Use attached file</button><button type="button" disabled={locked} onClick={()=>start('link')}>Use link</button></div>}
  {working&&<ScriptProgress progress={{percent:0,label:working,indeterminate:true}}/>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
