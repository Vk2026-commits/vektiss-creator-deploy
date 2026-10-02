import {mediaFetch} from "../lib/media-fetch";
import {useEffect,useRef,useState} from 'react';
import {type VideoPlan} from '../domain/video-plan';
import './article-layout.css';
import {CompositionPreview} from './CompositionPreview';
import {FreePresenter} from './FreePresenter';

export function ArticleLayout({plan,sourceUrl='',onChange}:{plan:VideoPlan;sourceUrl?:string;onChange:(plan:VideoPlan)=>void}){
 const [file,setFile]=useState<File|null>(null);
 const [url,setUrl]=useState('');
 const [error,setError]=useState('');
 const [capturing,setCapturing]=useState(false);
 const controller=useRef<AbortController|null>(null);
 const latest=useRef({plan,sourceUrl});latest.current={plan,sourceUrl};
 useEffect(()=>()=>controller.current?.abort(),[]);
 const captureId=plan.article_capture?.source_url===sourceUrl?plan.article_capture.id:undefined;
 useEffect(()=>{
  let active=true;let objectUrl='';const abort=new AbortController();setUrl('');
  async function load(){
   try{let blob:Blob;if(file)blob=file;else if(captureId){const response=await mediaFetch(`/api/local-capture/${captureId}`,{headers:{'X-Creator-Capture':'1'},signal:abort.signal});if(!response.ok||!response.headers.get('content-type')?.startsWith('image/png'))throw Error('This screenshot is stored on the capture computer. Recapture it here if it is unavailable.');blob=await response.blob();}else return;
    if(active){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}
   }catch(e){if(active)setError(e instanceof Error?e.message:'Could not load screenshot.');}
  }void load();return()=>{active=false;abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[file,captureId]);
 async function capture(){
  if(capturing)return;setCapturing(true);setError('');const abort=new AbortController();controller.current=abort;const timer=setTimeout(()=>abort.abort(),65000);
  try{const response=await mediaFetch('/api/local-capture',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1'},body:JSON.stringify({url:sourceUrl}),signal:abort.signal});const result=await response.json();if(!response.ok)throw Error(result.error??'Capture failed.');if(abort.signal.aborted||latest.current.sourceUrl!==sourceUrl)return;setFile(null);onChange({...latest.current.plan,article_capture:result});}
  catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Capture failed.');else setError('Capture stopped or timed out. You can retry or upload a screenshot.');}
  finally{clearTimeout(timer);setCapturing(false);controller.current=null;}
 }
 return <section className="article-layout" aria-label="Article and presenter layout">
  <h3>Keep the headline in view</h3>
  <p>Capture the article in a mobile view, with its headline in frame.</p>
  {import.meta.env.DEV?<><button type="button" className="button" disabled={capturing||!sourceUrl} onClick={()=>void capture()}>{capturing?'Capturing article…':captureId?'Recapture article':'Capture article screenshot'}</button><p>{sourceUrl?'Uses your source article link. Runs locally in a separate Chrome session.':'Add the article link in the Source step first.'}</p></>:<p>Automatic capture requires the local Creator app running on your computer.</p>}
  {captureId&&<p>Captured: {plan.article_capture?.title}. Check that the headline is readable and no banner covers it.</p>}
  <label>Preview a mobile screenshot<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const next=e.target.files?.[0];if(!next)return;if(!['image/png','image/jpeg','image/webp'].includes(next.type)||next.size>10*1024*1024){setError('Choose a PNG, JPEG or WebP under 10 MB.');return;}setError('');setFile(next);}}/></label>
  {error&&<p role="alert">{error}</p>}
  <FreePresenter plan={plan} onChange={onChange}>
   {url?<img src={url} alt="Article screenshot — check that the complete headline is readable" onError={()=>setError('This image could not be displayed. Choose another screenshot.')}/>:<div className="article-layout-placeholder">Article screenshot preview<br/><small>No screenshot loaded</small></div>}
  </FreePresenter>
  <small>Your placement saves with the video. Continue when it looks right.</small>
  <details><summary>Screenshot & preview details</summary><small>Size is a percentage of video width, limited to fit the frame. Captured screenshots stay on this computer. A manually selected image is a preview only and stays in this tab; capture the article to use it in your finished video.</small></details>
  {import.meta.env.DEV&&<details><summary>Optional 15-second layout test</summary><CompositionPreview plan={plan} captureId={file?undefined:captureId}/></details>}
 </section>;
}
