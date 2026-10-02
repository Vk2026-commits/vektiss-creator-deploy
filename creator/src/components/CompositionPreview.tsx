import {mediaFetch} from "../lib/media-fetch";
import {useEffect,useRef,useState} from 'react';
import type {VideoPlan} from '../domain/video-plan';
export function CompositionPreview({plan,captureId}:{plan:VideoPlan;captureId?:string}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [result,setResult]=useState<{url:string;key:string;size:number;position:string}|null>(null);
 const objectUrl=useRef('');const request=useRef<AbortController|null>(null);
 const key=JSON.stringify([captureId,plan.presenter_position,plan.format,plan.presenter_size,plan.presenter_placement]);
 useEffect(()=>()=>{request.current?.abort();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);},[]);
 async function render(){
  if(request.current)return;
  setBusy(true);setError('');const abort=new AbortController();request.current=abort;const timer=setTimeout(()=>abort.abort(),150000);
  try{
   const response=await mediaFetch('/api/local-capture/compose',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1'},body:JSON.stringify({capture_id:captureId,position:plan.presenter_position,format:plan.format,size:plan.presenter_size,placement:plan.presenter_placement}),signal:abort.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error??'Export failed.');
   if(data.size!==plan.presenter_size||data.position!==plan.presenter_position||data.format!==plan.format)throw Error('The export did not confirm your current layout. Refresh the app and rebuild before downloading.');
   const media=await mediaFetch(`/api/local-capture/exports/${data.id}`,{headers:{'X-Creator-Capture':'1'},signal:abort.signal});
   if(!media.ok||!media.headers.get('content-type')?.startsWith('video/mp4'))throw Error('Could not load the exported video.');
   const blob=await media.blob();if(abort.signal.aborted)return;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(blob);setResult({url:objectUrl.current,key,size:data.size,position:data.position});
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Export failed.');else setError('Export timed out. Please try again.');}
  finally{clearTimeout(timer);setBusy(false);request.current=null;}
 }
 return <section aria-label="Composed video preview"><h3>See the presenter on your article</h3><p>Uses the existing 15-second “Professional in city office” test—not the full script or a newly selected avatar. No HeyGen credits. Captions are not included in this proof.</p><p>Selected: {plan.presenter_size}% · {plan.presenter_position.replaceAll('-',' ')}</p><button type="button" className="button" disabled={busy||!captureId} onClick={()=>void render()}>{busy?'Building video preview…':result&&result.key!==key?'Rebuild with current size':'Build video preview'}</button>{!captureId&&<p>Capture the article first.</p>}{error&&<p role="alert">{error}</p>}{result&&<CompositionResult result={result} currentKey={key} busy={busy}/>}</section>;
}

export function CompositionResult({result,currentKey,busy}:{result:{url:string;key:string;size:number;position:string};currentKey:string;busy:boolean}){
 if(result.key!==currentKey)return <p role="status">Layout changed. Rebuild with current size to preview and download your updated video.</p>;
 return <><p>Exported: {result.size}% · {result.position.replaceAll('-',' ')}</p><video src={result.url} controls playsInline style={{display:'block',maxWidth:'100%',maxHeight:560,margin:'16px auto'}}/>{!busy&&<a className="button" href={result.url} download={`vektiss-presenter-${result.size}pct-${result.position}.mp4`}>Download composed MP4 · {result.size}%</a>}</>;
}
