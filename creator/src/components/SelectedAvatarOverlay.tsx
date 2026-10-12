import {useEffect,useState,useRef} from 'react';
import {personThumbnail} from '../lib/person-thumbnail';
import {avatarRepository} from '../lib/avatar-repository';
import {presenterLayout,previewAspect} from '../domain/presenter-layout';
import type {VideoPlan} from '../domain/video-plan';
import {avatarFraming,framedAspect} from '../domain/avatar-framing';
import {mediaFetch} from '../lib/media-fetch';
import {subscribeAvatarLibrary} from '../lib/avatar-library-events';
export function framingPreviewStyle(_framing:VideoPlan['presenter_framing'],_amount:VideoPlan['presenter_framing_amount']){
 // The overlay aspect is already widened to the selected crop. Keep the
 // source image at its natural aspect, pin it to the top, and let the
 // overflow-hidden overlay clip the lower body. Never scale it to fill.
 return {width:'100%',height:'auto',maxWidth:'none',maxHeight:'none',position:'absolute' as const,left:0,top:0};
}
export function SelectedAvatarOverlay({plan,onAspect}:{plan:VideoPlan;onAspect?:(aspect:number)=>void}) {
 return <AvatarOverlay key={`${plan.avatar_id}:${plan.avatar_engine}:${plan.format}`} plan={plan} onAspect={onAspect}/>;
}
function AvatarOverlay({plan,onAspect}:{plan:VideoPlan;onAspect?:(aspect:number)=>void}) {
 const aspectCallback=useRef(onAspect);aspectCallback.current=onAspect;
 const [image,setImage]=useState<{id:string;url:string|null;verified?:boolean;placement?:boolean;aspect?:number}|null>(null);
 const [previewError,setPreviewError]=useState(false);
 const [epoch,setEpoch]=useState(0);
 useEffect(()=>subscribeAvatarLibrary(()=>setEpoch(n=>n+1)),[]);
 useEffect(()=>{let live=true,objectUrl:string|null=null;const controller=new AbortController();setPreviewError(false);setImage(null);
  if(plan.avatar_id)void avatarRepository.library().then(async lib=>{
   const avatar=lib.avatars.find(a=>a.id===plan.avatar_id);
   const aspect=plan.format==='portrait'?'9:16':plan.format==='square'?'1:1':'16:9';
   const verified=avatar?.verified_previews?.find(v=>v.engine===(plan.avatar_engine??'avatar_iv')&&v.aspect_ratio===aspect);
   if(verified&&!avatarFraming(plan.avatar_id,plan.format)){const response=await mediaFetch(`/api/local-capture/avatar-preview/${verified.test_id}`,{signal:controller.signal});if(!response.ok)throw Error('Preview unavailable');const blob=await response.blob();if(!live)return;objectUrl=URL.createObjectURL(blob);setImage({id:plan.avatar_id!,url:objectUrl,verified:true});}
   else if(avatarFraming(plan.avatar_id,plan.format)){if(live)setImage({id:plan.avatar_id!,url:avatar?.thumbnail_url??null});}
   else{
    const response=await mediaFetch(`/api/local-capture/avatar-thumbnail/${plan.avatar_id}`,{signal:controller.signal});
    if(!response.ok)throw Error('Placement preview unavailable');
    const blob=await response.blob();if(!live)return;
    const prepared=plan.presenter_sizing==='visible-person-v1'?await personThumbnail(blob):{blob,aspect:undefined};
    if(!live)return;objectUrl=URL.createObjectURL(prepared.blob);
    setImage({id:plan.avatar_id!,url:objectUrl,placement:true,aspect:prepared.aspect});
    if(prepared.aspect)aspectCallback.current?.(prepared.aspect);
   }
  }).catch(()=>{if(live){setImage({id:plan.avatar_id!,url:null});setPreviewError(true);}});
  return()=>{live=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[plan.avatar_id,plan.avatar_engine,plan.format,plan.presenter_sizing,epoch]);
 const baseAspect=image?.aspect??previewAspect(plan);
 const layout=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,framedAspect(baseAspect,plan.presenter_framing,plan.presenter_framing_amount));
 const verified=image?.id===plan.avatar_id&&image.verified;
 const cutout=Boolean(avatarFraming(plan.avatar_id,plan.format));
 const url=verified?image.url:cutout?'/brand/stephen-render-framing-v1.png':image?.id===plan.avatar_id?image.url:null;
	 const framed=Boolean(plan.presenter_framing&&plan.presenter_framing!=='original');
	 // The overlay's aspect already reflects the selected crop. Enlarging the
	 // source to its full unframed height and clipping from the top makes the
	 // editor show the same vertical source crop as FFmpeg, including for wide
	 // provider thumbnails where object-fit:cover would otherwise only crop sides.
	 const frameStyle=framed?framingPreviewStyle(plan.presenter_framing,plan.presenter_framing_amount):verified||image?.placement?{objectFit:'contain' as const,objectPosition:'center bottom'}:undefined;
	 return <div className={`selected-avatar-overlay${cutout||verified||image?.placement?' avatar-cutout':''}`} aria-label={`${plan.avatar_name}, ${plan.presenter_placement?'custom placement':plan.presenter_position.replaceAll('-',' ')}, size ${Math.round(plan.presenter_placement?.width??plan.presenter_size)}%`} style={{left:`${layout.x/layout.w*100}%`,top:`${layout.y/layout.h*100}%`,width:`${layout.width/layout.w*100}%`,height:`${layout.height/layout.h*100}%`}}>{url?<img src={url} alt={`${plan.avatar_name} — ${verified?'verified video frame':'placement preview'}`} style={frameStyle} draggable={false} referrerPolicy="no-referrer" onError={()=>{setImage({id:plan.avatar_id!,url:null});setPreviewError(true);}}/>:<span role="status">{previewError?'Clean preview unavailable':'Preparing clean preview…'}<br/>{plan.avatar_name}{previewError&&<button type="button" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setEpoch(n=>n+1);}}>Retry preview</button>}</span>}{image?.placement&&<small className="avatar-preview-label">Placement preview · video not verified</small>}</div>;
}
