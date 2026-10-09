import {useEffect,useState} from 'react';
import {avatarRepository} from '../lib/avatar-repository';
import {presenterLayout,previewAspect} from '../domain/presenter-layout';
import type {VideoPlan} from '../domain/video-plan';
import {avatarFraming} from '../domain/avatar-framing';
import {avatarPreviewCutout} from '../domain/avatar-preview';
import {mediaFetch} from '../lib/media-fetch';
import {subscribeAvatarLibrary} from '../lib/avatar-library-events';
export function SelectedAvatarOverlay({plan}:{plan:VideoPlan}) {
 return <AvatarOverlay key={`${plan.avatar_id}:${plan.avatar_engine}:${plan.format}`} plan={plan}/>;
}
function AvatarOverlay({plan}:{plan:VideoPlan}) {
 const [image,setImage]=useState<{id:string;url:string|null;verified?:boolean}|null>(null);
 const [epoch,setEpoch]=useState(0);
 useEffect(()=>subscribeAvatarLibrary(()=>setEpoch(n=>n+1)),[]);
 useEffect(()=>{let live=true,objectUrl:string|null=null;const controller=new AbortController();
  if(plan.avatar_id)void avatarRepository.library().then(async lib=>{
   const avatar=lib.avatars.find(a=>a.id===plan.avatar_id);
   const aspect=plan.format==='portrait'?'9:16':plan.format==='square'?'1:1':'16:9';
   const verified=avatar?.verified_previews?.find(v=>v.engine===(plan.avatar_engine??'avatar_iv')&&v.aspect_ratio===aspect);
   if(verified&&!avatarFraming(plan.avatar_id,plan.format)){const response=await mediaFetch(`/api/local-capture/avatar-preview/${verified.test_id}`,{signal:controller.signal});if(!response.ok)throw Error('Preview unavailable');const blob=await response.blob();if(!live)return;objectUrl=URL.createObjectURL(blob);setImage({id:plan.avatar_id!,url:objectUrl,verified:true});}
   else if(live)setImage({id:plan.avatar_id!,url:avatar?.thumbnail_url??null});
  }).catch(()=>{if(live)setImage({id:plan.avatar_id!,url:null});});
  return()=>{live=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[plan.avatar_id,plan.avatar_engine,plan.format,epoch]);
 const layout=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,previewAspect(plan));
 const verified=image?.id===plan.avatar_id&&image.verified;
 const cutout=Boolean(avatarFraming(plan.avatar_id,plan.format));
 const reference=avatarPreviewCutout(plan.avatar_id,image?.id===plan.avatar_id?image.url:null);
 const url=verified?image.url:cutout?'/brand/stephen-render-framing-v1.png':image?.id===plan.avatar_id?image.url:null;
 return <div className={`selected-avatar-overlay${cutout||reference||verified?' avatar-cutout':''}`} aria-label={`${plan.avatar_name}, ${plan.presenter_placement?'custom placement':plan.presenter_position.replaceAll('-',' ')}, size ${Math.round(plan.presenter_placement?.width??plan.presenter_size)}%`} style={{left:`${layout.x/layout.w*100}%`,top:`${layout.y/layout.h*100}%`,width:`${layout.width/layout.w*100}%`,height:`${layout.height/layout.h*100}%`}}>{reference?<svg width="100%" height="100%" viewBox={reference.viewBox} preserveAspectRatio="xMidYMax meet" role="img" aria-label={`${plan.avatar_name} — placement preview`}><image href={reference.url} width={reference.width} height={reference.height} onError={()=>setImage({id:plan.avatar_id!,url:null})}/></svg>:url?<img src={url} alt={plan.avatar_name} style={verified?{objectFit:'contain',objectPosition:'center bottom'}:undefined} draggable={false} referrerPolicy="no-referrer" onError={()=>setImage({id:plan.avatar_id!,url:null})}/>:<span>{image?'Avatar preview unavailable':'Loading avatar…'}<br/>{plan.avatar_name}</span>}</div>;
}
