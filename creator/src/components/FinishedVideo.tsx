import {mediaFetch} from "../lib/media-fetch";
import {useEffect,useRef,useState} from 'react';
import {RenderProgress} from './RenderProgress';
import {supabase} from '../lib/supabase';
import type {VideoPlan} from '../domain/video-plan';
import {avatarFraming} from '../domain/avatar-framing';
import {downloadMP4} from '../lib/download-mp4';
export function playbackTime(seconds:number){
 const whole=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
 return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,'0')}`;
}
export function FinishedVideoPlayer({src}:{src:string}){
 const video=useRef<HTMLVideoElement>(null);
 const [duration,setDuration]=useState(0);
 const [time,setTime]=useState(0);
 const sync=()=>{const media=video.current;if(!media)return;setDuration(Number.isFinite(media.duration)?media.duration:0);setTime(media.currentTime||0);};
 useEffect(()=>{setDuration(0);setTime(0);},[src]);
 return <div className="finished-video-player">
  <video ref={video} src={src} controls playsInline preload="metadata" onLoadedMetadata={sync} onDurationChange={sync} onTimeUpdate={sync} onSeeked={sync} onEnded={sync}/>
  <label className="finished-video-timeline">
   <span>Scrub video</span>
   <input type="range" aria-label="Video playback position" min={0} max={duration||1} step={0.1} value={Math.min(time,duration)} disabled={!duration} aria-valuetext={`${playbackTime(time)} of ${playbackTime(duration)}`} onChange={event=>{const next=Number(event.currentTarget.value);if(video.current&&duration){video.current.currentTime=next;setTime(next);}}}/>
   <span className="finished-video-time">{playbackTime(time)} / {playbackTime(duration)}</span>
  </label>
 </div>;
}
export function FinishedVideo({jobId,scriptId,plan,sourceKind='article'}:{jobId:string;scriptId:string;plan:VideoPlan;sourceKind?:'article'|'video'|'graphic';rawVideoUrl?:string}){
 const [url,setUrl]=useState('');const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 const [progress,setProgress]=useState(85);
 const [download,setDownload]=useState<{received:number;total:number|null}|null>(null);
 const captureId=sourceKind==='video'?plan.video_background?.id:plan.article_capture?.id;
 const presenterOnly=sourceKind==='article'&&!captureId;
 useEffect(()=>{if(!captureId&&!presenterOnly)return;const controller=new AbortController();let objectUrl='';let live=true;setUrl('');setError('');setDownload(null);
  async function assemble(){try{setProgress(85);
   const session=await supabase?.auth.getSession();const token=session?.data.session?.access_token;if(!token)throw Error('Sign in again to assemble your video.');
   const response=await mediaFetch('/api/local-capture/full-compose',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1',Authorization:`Bearer ${token}`},signal:controller.signal,body:JSON.stringify({job_id:jobId,script_id:scriptId,...(presenterOnly?{presenter_only:true}:sourceKind==='video'?{video_id:captureId}:{capture_id:captureId}),size:plan.presenter_size,position:plan.presenter_position,format:plan.format,placement:plan.presenter_placement,framing:avatarFraming(plan.avatar_id,plan.format)})});
   const result=await response.json();if(!response.ok)throw Error(result.error??'Assembly failed.');if(live)setProgress(95);
   const media=await mediaFetch(`/api/local-capture/exports/${result.id}`,{headers:{'X-Creator-Capture':'1'},signal:controller.signal});if(!media.ok||!media.headers.get('content-type')?.startsWith('video/mp4'))throw Error('Could not load the final MP4.');
   const blob=await downloadMP4(media,(received,total)=>{if(live)setDownload({received,total});});if(live){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}
  }catch(e){if(live){
   // A phone may suspend while the MP4 body is downloading, after headers
   // arrived. Reopen the saved export; never request a new paid presenter.
   setError(e instanceof TypeError||e instanceof DOMException&&['TimeoutError','AbortError'].includes(e.name)?'The preview download was interrupted. Your completed avatar is saved. Reconnect and retry loading the MP4; no new avatar render will be charged.':e instanceof Error?e.message:'Assembly failed.');
  }}}
  void assemble();return()=>{live=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[jobId,scriptId,captureId,sourceKind,presenterOnly,plan.presenter_size,plan.presenter_position,plan.format,plan.presenter_placement,plan.avatar_id,retry]);
 return <section className="finished-video" aria-label="Finished video">{!captureId&&!presenterOnly?<p>Go back to the source step to attach your background. Your existing avatar render is preserved.</p>:error?<><p role="alert">{error}</p><button className="button" onClick={()=>setRetry(n=>n+1)}>Retry loading MP4 · no new render charge</button></>:!url?<>{download?<><p>Your video is finished. Loading its preview—not rendering again.</p><progress aria-label="Finished video download" max={download.total??undefined} value={download.total?download.received:undefined}/><p role="status">{download.total?`${Math.min(100,Math.round(download.received/download.total*100))}% · `:''}{(download.received/1048576).toFixed(1)} MB{download.total?` of ${(download.total/1048576).toFixed(1)} MB`:''}</p></>:<RenderProgress value={progress} indeterminate label="Opening your video…"/>}</>:<><FinishedVideoPlayer key={url} src={url}/><div className="render-confirmation render-actions"><span role="status">Ready to download</span><a className="button" href={url} download="vektiss-finished-video.mp4">Download MP4 ↓</a></div></>}</section>;
}
