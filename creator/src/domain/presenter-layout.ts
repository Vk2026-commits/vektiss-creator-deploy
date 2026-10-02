import type {VideoPlan} from './video-plan';
import {avatarFraming,stephenCrop} from './avatar-framing';

// Shared by the editor and export so the preview has the same size and anchors.
export function presenterLayout(format:VideoPlan['format'],position:VideoPlan['presenter_position'],size=28,placement?:VideoPlan['presenter_placement'],aspect=328/426){
 const [w,h]=format==='portrait'?[720,1280]:format==='landscape'?[1280,720]:[720,720];
 const width=Math.floor(Math.min(w*(placement?Math.max(5,Math.min(100,placement.width)):Math.max(15,Math.min(90,size)))/100,h*(placement?1:.88)*aspect)/2)*2;
 const height=Math.round(width/aspect/2)*2;
 if(placement)return {w,h,width,height,x:Math.round(placement.x*w-width/2),y:Math.round(placement.y*h-height)};
 const x=Math.round(position.endsWith('left')?w*.04:position.endsWith('right')?w*.96-width:(w-width)/2);
 const y=Math.round(position.startsWith('bottom')?h*.94-height:(h-height)/2);
 return {w,h,width,height,x,y};
}
export const previewAspect=(plan:VideoPlan)=>avatarFraming(plan.avatar_id,plan.format)?stephenCrop.width/stephenCrop.height:328/426;
export function placementFromLayout(plan:VideoPlan){
 const l=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,previewAspect(plan));
 return {x:(l.x+l.width/2)/l.w,y:(l.y+l.height)/l.h,width:l.width/l.w*100};
}
