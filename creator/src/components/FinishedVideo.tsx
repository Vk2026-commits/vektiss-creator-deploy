import {mediaFetch} from "../lib/media-fetch";
import {useEffect,useState} from 'react';
import {RenderProgress} from './RenderProgress';
import {supabase} from '../lib/supabase';
import type {VideoPlan} from '../domain/video-plan';
import {avatarFraming} from '../domain/avatar-framing';
export function FinishedVideo({jobId,scriptId,plan,sourceKind='article'}:{jobId:string;scriptId:string;plan:VideoPlan;sourceKind?:'article'|'video'}){
 const [url,setUrl]=useState('');const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 const [progress,setProgress]=useState(85);
 const captureId=sourceKind==='video'?plan.video_background?.id:plan.article_capture?.id;
 useEffect(()=>{if(!captureId)return;const controller=new AbortController();let objectUrl='';let live=true;let reconnect:ReturnType<typeof setTimeout>|undefined;setUrl('');setError('');
  async function assemble(){try{setProgress(85);
   const session=await supabase?.auth.getSession();const token=session?.data.session?.access_token;if(!token)throw Error('Sign in again to assemble your video.');
   const response=await mediaFetch('/api/local-capture/full-compose',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1',Authorization:`Bearer ${token}`},signal:controller.signal,body:JSON.stringify({job_id:jobId,script_id:scriptId,...(sourceKind==='video'?{video_id:captureId}:{capture_id:captureId}),size:plan.presenter_size,position:plan.presenter_position,format:plan.format,placement:plan.presenter_placement,framing:avatarFraming(plan.avatar_id,plan.format)})});
   const result=await response.json();if(!response.ok)throw Error(result.error??'Assembly failed.');if(live)setProgress(95);
   const media=await mediaFetch(`/api/local-capture/exports/${result.id}`,{headers:{'X-Creator-Capture':'1'},signal:controller.signal});if(!media.ok||!media.headers.get('content-type')?.startsWith('video/mp4'))throw Error('Could not load the final MP4.');
   const blob=await media.blob();if(live){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}
  }catch(e){if(live){
   // A phone may suspend while the MP4 body is downloading, after headers
   // arrived. Reopen the saved export; never request a new paid presenter.
   if(e instanceof TypeError)reconnect=setTimeout(()=>setRetry(n=>n+1),2000);
   else setError(e instanceof Error?e.message:'Assembly failed.');
  }}}
  void assemble();return()=>{live=false;clearTimeout(reconnect);controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[jobId,scriptId,captureId,sourceKind,plan.presenter_size,plan.presenter_position,plan.format,plan.presenter_placement,plan.avatar_id,retry]);
 return <section className="finished-video" aria-label="Finished video">{!captureId?<p>Go back to the source step to attach your background.</p>:error?<><p role="alert">{error}</p><button className="button" onClick={()=>setRetry(n=>n+1)}>Retry export · no new render charge</button></>:!url?<RenderProgress value={progress} label={progress===95?'Loading finished MP4':'Merging video + avatar'}/>:<><video src={url} controls playsInline/><div className="render-confirmation render-actions"><span role="status">Ready to download</span><a className="button" href={url} download="vektiss-finished-video.mp4">Download MP4 ↓</a></div></>}</section>;
}
