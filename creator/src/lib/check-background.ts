import type {VideoPlan} from '../domain/video-plan';
import {mediaFetch} from './media-fetch';
export async function checkBackground(plan:VideoPlan,kind:string,signal?:AbortSignal){
 if(plan.setting==='original')return;
 if(plan.setting==='studio'){
  if(!plan.studio_background)throw Error('Upload or select your studio background before creating this video.');
  const r=await mediaFetch(`/api/local-capture/graphic/${plan.studio_background.id}`,{signal});await r.body?.cancel();
  if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error('Your saved studio image could not load. No render was started.');return;
 }
 const images=plan.screenshot_story?.images.map(i=>i.id)??(plan.article_capture?[plan.article_capture.id]:[]);
 if(kind==='graphic'&&!images.length||kind==='video'&&!plan.video_background)throw Error('Your saved background is missing. Restore it before creating this version; no render was started.');
 const paths=kind==='video'?[`/api/local-capture/video-background/${plan.video_background!.id}`]:images.map(id=>`/api/local-capture/graphic/${id}`);
 for(const path of paths){
  const response=await mediaFetch(path,{signal});
  const correctType=response.headers.get('content-type')?.startsWith(kind==='video'?'video/':'image/');
  // Reading headers is enough to confirm the stored asset exists; don't download
  // an entire source video just to enter review.
  await response.body?.cancel();
  if(!response.ok||!correctType)throw Error('Your saved background could not load. Retry loading it before generating; your original video is unchanged.');
 }
}
