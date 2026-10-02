import {useEffect,useState} from 'react';
import {avatarRepository} from '../lib/avatar-repository';
import {presenterLayout,previewAspect} from '../domain/presenter-layout';
import type {VideoPlan} from '../domain/video-plan';
import {avatarFraming} from '../domain/avatar-framing';
export function SelectedAvatarOverlay({plan}:{plan:VideoPlan}) {
 const [image,setImage]=useState<{id:string;url:string|null}|null>(null);
 useEffect(()=>{let live=true;if(plan.avatar_id)void avatarRepository.library().then(lib=>{if(live)setImage({id:plan.avatar_id!,url:lib.avatars.find(a=>a.id===plan.avatar_id)?.thumbnail_url??null});}).catch(()=>{if(live)setImage({id:plan.avatar_id!,url:null});});return()=>{live=false;};},[plan.avatar_id]);
 const layout=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,previewAspect(plan));
 const cutout=Boolean(avatarFraming(plan.avatar_id,plan.format));
 const url=cutout?'/brand/stephen-render-framing-v1.png':image?.id===plan.avatar_id?image.url:null;
 return <div className={`selected-avatar-overlay${cutout?' avatar-cutout':''}`} aria-label={`${plan.avatar_name}, ${plan.presenter_placement?'custom placement':plan.presenter_position.replaceAll('-',' ')}, size ${Math.round(plan.presenter_placement?.width??plan.presenter_size)}%`} style={{left:`${layout.x/layout.w*100}%`,top:`${layout.y/layout.h*100}%`,width:`${layout.width/layout.w*100}%`,height:`${layout.height/layout.h*100}%`}}>{url?<img src={url} alt={plan.avatar_name} draggable={false} referrerPolicy="no-referrer" onError={()=>setImage({id:plan.avatar_id!,url:null})}/>:<span>{image?'Avatar preview unavailable':'Loading avatar…'}<br/>{plan.avatar_name}</span>}</div>;
}
