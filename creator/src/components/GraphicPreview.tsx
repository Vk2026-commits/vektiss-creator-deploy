import {useEffect,useState} from 'react';
import {mediaFetch} from '../lib/media-fetch';
import type {VideoPlan} from '../domain/video-plan';
import {SelectedAvatarOverlay} from './SelectedAvatarOverlay';
import {previewAspect,presenterLayout} from '../domain/presenter-layout';
import './article-layout.css';
export function GraphicImage({id}:{id:string}){
 const [image,setImage]=useState<{id:string;url:string}|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{const abort=new AbortController();let url='';setError('');
  void mediaFetch(`/api/local-capture/graphic/${id}`,{signal:abort.signal}).then(async response=>{
   if(!response.ok||!response.headers.get('content-type')?.startsWith('image/png'))throw Error('Could not load your saved graphic. Return to the source to upload it again.');
   const blob=await response.blob();if(abort.signal.aborted)return;url=URL.createObjectURL(blob);setImage({id,url});
  }).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Could not load graphic.');});
  return()=>{abort.abort();if(url)URL.revokeObjectURL(url);};
 },[id]);
 return error?<p role="alert">{error}</p>:image?.id===id?<img src={image.url} alt="Selected screenshot or social graphic"/>:<p role="status">Loading graphic…</p>;
}
export function GraphicPreview({plan}:{plan:VideoPlan}){
 const l=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,previewAspect(plan));
 return <><div className="article-layout-stage" style={{aspectRatio:`${l.w}/${l.h}`}}>{plan.article_capture&&<GraphicImage id={plan.article_capture.id}/>}<SelectedAvatarOverlay plan={plan}/></div><p><small>Your graphic stays on screen while the avatar speaks. No original audio or video introduction.</small></p></>;
}
