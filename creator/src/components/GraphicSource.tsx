import {useEffect,useRef,useState} from 'react';
import {mediaFetch} from '../lib/media-fetch';
import {graphicCaptureSchema,type VideoPlan} from '../domain/video-plan';
import {GraphicImage} from './GraphicPreview';
type Capture=NonNullable<VideoPlan['article_capture']>;
export function GraphicSource({capture,url,profileId,disabled,onUrl,onCapture,onComplete,onProcessing}:{capture?:Capture;url:string;profileId:string;disabled:boolean;onUrl:(url:string)=>void;onCapture:(capture:Capture)=>void;onComplete:(text:string)=>Promise<void>;onProcessing:(busy:boolean)=>void}){
 const [mode,setMode]=useState<'link'|'upload'>(url?'link':'upload');
 const [working,setWorking]=useState('');const [error,setError]=useState('');
 const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 async function run(file?:File,analyze=false){
  if(active.current)return;
  if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)){setError('Choose a PNG, JPEG or WebP under 10 MB.');return;}
  const abort=new AbortController();active.current=abort;setError('');setWorking(analyze?'Reading your graphic…':file?'Saving your screenshot…':'Capturing the public post graphic…');onProcessing(true);
  try{
   const payload=JSON.stringify(analyze?{id:capture?.id,analyze:true}:{url});
   const tag=analyze?`graphic-analysis:${profileId}:${capture?.id}`:file?`graphic-upload:${file.name}:${file.size}:${file.lastModified}`:`graphic-link:${url}`;
   const response=await mediaFetch('/api/local-capture/graphic-source',{method:'POST',headers:{'Content-Type':file?.type??'application/json','X-Profile-Id':profileId},body:file??payload,signal:abort.signal},tag);
   const result=await response.json();if(!response.ok)throw Error(result.error??'Could not capture this graphic. Try uploading a screenshot.');
   if(abort.signal.aborted)return;
   if(analyze){if(typeof result.text!=='string'||result.text.length<40)throw Error('Could not read enough from this graphic. Try a clearer screenshot.');onProcessing(false);await onComplete(result.text);}
   else onCapture(graphicCaptureSchema.parse(result));
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Could not process graphic.');}
  finally{if(!abort.signal.aborted){setWorking('');onProcessing(false);}active.current=null;}
 }
 return <section aria-label="Screenshot or graphic source">
  <div className="take-modes"><button type="button" disabled={disabled||!!working} aria-pressed={mode==='link'} onClick={()=>setMode('link')}>Paste post link</button><button type="button" disabled={disabled||!!working} aria-pressed={mode==='upload'} onClick={()=>setMode('upload')}>Upload screenshot</button></div>
  {mode==='link'?<><label>Instagram or TikTok post link<input type="url" maxLength={2000} value={url} disabled={disabled||!!working} placeholder="https://…" onChange={e=>onUrl(e.target.value)}/></label><button type="button" className="button" disabled={disabled||!!working||!url.trim()} onClick={()=>void run()}>Capture graphic</button><p><small>Public posts only. The available graphic may be a cover or first slide—not the whole post. Check the preview; upload a screenshot if it is blocked or not the image you want.</small></p></>:<label>Choose your screenshot<input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled||!!working} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(file);}}/><small>PNG, JPEG or WebP · up to 10 MB</small></label>}
  {working&&<div role="status"><p>{working}</p><progress aria-label={working}/><small>Progress is tracked on the server. If your phone sleeps, return and retry this same operation to reconnect.</small></div>}
  {error&&<p role="alert">{error}</p>}
  {capture&&<><div style={{maxWidth:300,margin:'16px auto'}} className="graphic-source-preview"><GraphicImage id={capture.id}/></div><p>Is this the graphic you want to react to?</p><button type="button" className="button" disabled={disabled||!!working||!profileId} onClick={()=>void run(undefined,true)}>Use this graphic & create script →</button></>}
 </section>;
}
