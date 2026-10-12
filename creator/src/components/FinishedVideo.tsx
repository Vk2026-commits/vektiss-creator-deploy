import {mediaFetch} from "../lib/media-fetch";
import {useEffect,useRef,useState} from 'react';
import {RenderProgress} from './RenderProgress';
import {supabase} from '../lib/supabase';
import type {VideoPlan} from '../domain/video-plan';
import {lazyMP4} from '../lib/lazy-mp4';
import {fullCompositionInput} from '../lib/full-composition-input';
export function playbackTime(seconds:number){
 const whole=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
 return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,'0')}`;
}
export function FinishedVideoPlayer({src,poster,playOnLoad=false}:{src:string;poster?:string;playOnLoad?:boolean}){
 const video=useRef<HTMLVideoElement>(null);
 const [duration,setDuration]=useState(0);
 const [time,setTime]=useState(0);
 const [playbackError,setPlaybackError]=useState(false);
 const [tapToPlay,setTapToPlay]=useState(false);
 useEffect(()=>{if(playOnLoad)void video.current?.play().catch(()=>setTapToPlay(true));},[src,playOnLoad]);
 const sync=()=>{const media=video.current;if(!media)return;setDuration(Number.isFinite(media.duration)?media.duration:0);setTime(media.currentTime||0);};
 useEffect(()=>{setDuration(0);setTime(0);setPlaybackError(false);},[src]);
 return <div className="finished-video-player">
  <video ref={video} src={src} poster={poster||undefined} controls playsInline preload="metadata" onError={()=>setPlaybackError(true)} onLoadedMetadata={()=>{setPlaybackError(false);sync();}} onDurationChange={sync} onTimeUpdate={sync} onSeeked={sync} onEnded={sync}/>
  {tapToPlay&&<button type="button" className="button" onClick={()=>void video.current?.play().then(()=>setTapToPlay(false)).catch(()=>setPlaybackError(true))}>Tap to play</button>}
  {playbackError&&<p role="alert">Preview could not play. <button type="button" onClick={()=>{setPlaybackError(false);video.current?.load();}}>Reload preview</button> Your MP4 is still available below.</p>}
  <label className="finished-video-timeline">
   <span>Scrub video</span>
   <input type="range" aria-label="Video playback position" min={0} max={duration||1} step={0.1} value={Math.min(time,duration)} disabled={!duration} aria-valuetext={`${playbackTime(time)} of ${playbackTime(duration)}`} onChange={event=>{const next=Number(event.currentTarget.value);if(video.current&&duration){video.current.currentTime=next;setTime(next);}}}/>
   <span className="finished-video-time">{playbackTime(time)} / {playbackTime(duration)}</span>
  </label>
 </div>;
}
type FinishedProps={jobId:string;scriptId:string;plan:VideoPlan;sourceKind?:'article'|'video'|'graphic';rawVideoUrl?:string};
export function FinishedVideo(props:FinishedProps){
 const {jobId,scriptId,plan,sourceKind}=props;
 const identity=JSON.stringify([jobId,scriptId,sourceKind,plan]);
 return <SavedVideo key={identity} {...props}/>;
}
function SavedVideo({jobId,scriptId,plan,sourceKind='article'}:FinishedProps){
 const [url,setUrl]=useState('');const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 const [poster,setPoster]=useState('');
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(false),[playing,setPlaying]=useState(false);
 const loader=useRef<(()=>Promise<string>)|null>(null),controllerRef=useRef<AbortController|null>(null),action=useRef(false);
 const lastAction=useRef<'play'|'download'>('play');
 const [download,setDownload]=useState<{received:number;total:number|null}|null>(null);
 const captureId=sourceKind==='video'?plan.video_background?.id:plan.article_capture?.id;
 const presenterOnly=sourceKind==='article'&&!captureId;
 useEffect(()=>{if(!captureId&&!presenterOnly)return;const controller=new AbortController();controllerRef.current=controller;let posterUrl='';let live=true;setUrl('');setPoster('');setError('');setDownload(null);setReady(false);loader.current=null;
  async function assemble(){try{
   const session=await supabase?.auth.getSession();const token=session?.data.session?.access_token;if(!token)throw Error('Sign in again to assemble your video.');
   const input=await fullCompositionInput({jobId,scriptId,plan,sourceKind});
   const response=await mediaFetch('/api/local-capture/full-compose',{method:'POST',headers:{'Content-Type':'application/json','X-Creator-Capture':'1',Authorization:`Bearer ${token}`},signal:controller.signal,body:JSON.stringify(input)});
   const result=await response.json();if(!response.ok)throw Error(result.error??'Assembly failed.');if(!live)return;
   loader.current=lazyMP4(result.id,controller.signal,(received,total)=>{if(live)setDownload({received,total});});setReady(true);
   // A real JPEG does not depend on iOS decoding video before a user gesture.
   void mediaFetch(`/api/local-capture/export-poster/${result.id}`,{signal:controller.signal}).then(async response=>{
    if(!response.ok||!response.headers.get('content-type')?.startsWith('image/jpeg'))return;
    const image=await response.blob();if(live){posterUrl=URL.createObjectURL(image);setPoster(posterUrl);}
   }).catch(()=>{/* Poster availability must not block the saved MP4. */});
  }catch(e){if(live){
   // A phone may suspend while the MP4 body is downloading, after headers
   // arrived. Reopen the saved export; never request a new paid presenter.
   setError(e instanceof TypeError||e instanceof DOMException&&['TimeoutError','AbortError'].includes(e.name)?'The preview download was interrupted. Your completed avatar is saved. Reconnect and retry loading the MP4; no new avatar render will be charged.':e instanceof Error?e.message:'Assembly failed.');
  }}}
  void assemble();return()=>{live=false;controller.abort();loader.current=null;if(posterUrl)URL.revokeObjectURL(posterUrl);};
 },[jobId,scriptId,captureId,sourceKind,presenterOnly,plan.presenter_size,plan.presenter_position,plan.format,plan.presenter_placement,plan.avatar_id,plan.presenter_framing,plan.presenter_framing_amount,retry]);
 async function activate(intent:'play'|'download'){
  if(action.current||!loader.current)return;
  const controller=controllerRef.current!;
  action.current=true;lastAction.current=intent;setLoading(true);setError('');setDownload(null);
  try{
   const loaded=await loader.current();if(controller.signal.aborted)return;
   setUrl(loaded);
   if(intent==='play')setPlaying(true);
   else{const link=document.createElement('a');link.href=loaded;link.download='vektiss-finished-video.mp4';document.body.append(link);link.click();link.remove();}
  }catch{if(!controller.signal.aborted)setError('Loading was interrupted. Your finished video is saved. Retry without a new render.');}
  finally{if(!controller.signal.aborted){action.current=false;setLoading(false);}}
 }
 return <section className="finished-video" aria-label="Finished video">
  {!captureId&&!presenterOnly?<p>Go back to the source step to attach your background. Your existing avatar render is preserved.</p>:<>
   {!ready&&!error?<RenderProgress value={0} indeterminate label="Opening your video…"/>:ready&&<>
    {playing&&url?<FinishedVideoPlayer src={url} poster={poster} playOnLoad/>:
     <div className="finished-video-poster">
      {poster?<img src={poster} alt="Finished video thumbnail" onError={()=>setPoster('')}/>:<span className="finished-video-placeholder">Your finished video</span>}
      <button type="button" className="button" aria-label="Play finished video" disabled={loading} onClick={()=>void activate('play')} style={{position:'absolute'}}>▶ Play</button>
     </div>}
    {loading&&<div role="status" aria-live="polite"><p>Loading your video…{download?.total?' '+Math.min(100,Math.round(download.received/download.total*100))+'%':''}</p><progress aria-label="Loading saved MP4" max={download?.total??undefined} value={download?.total?download.received:undefined}/></div>}
    <div className="render-confirmation render-actions"><span>Ready to download</span><button type="button" className="button" disabled={loading} onClick={()=>void activate('download')}>Download MP4 ↓</button></div>
   </>}
   {error&&<><p role="alert">{error}</p><button className="button" type="button" disabled={loading} onClick={()=>ready?void activate(lastAction.current):setRetry(n=>n+1)}>Retry loading</button></>}
  </>}
 </section>;
}
