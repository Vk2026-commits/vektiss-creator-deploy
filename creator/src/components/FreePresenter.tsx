import {useRef,useState,type ReactNode,type PointerEvent} from 'react';
import type {VideoPlan} from '../domain/video-plan';
import {placementFromLayout,presenterLayout,previewAspect} from '../domain/presenter-layout';
import {SelectedAvatarOverlay} from './SelectedAvatarOverlay';
import './article-layout.css';
import {movePlacement} from '../domain/presenter-gesture';
import {avatarFramings,customFramingBounds,framedAspect,type AvatarFraming} from '../domain/avatar-framing';
type Placement=NonNullable<VideoPlan['presenter_placement']>;
type Point={x:number;y:number};
const avatarFramingLabels:Record<AvatarFraming,string>={original:'Original','head-shoulders':'Head & shoulders','chest-up':'Chest up','waist-up':'Waist up',custom:'Custom'};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function PlacementShortcuts({plan,onChange}:{plan:VideoPlan;onChange:(p:VideoPlan)=>void}){
 const aspect=framedAspect(previewAspect(plan),plan.presenter_framing,plan.presenter_framing_amount);
 const l=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,aspect);
 const change=(p:Placement)=>onChange({...plan,presenter_placement:p});
 return <><div className="article-layout-positions"><button type="button" onClick={()=>onChange({...plan,presenter_size:30,presenter_placement:{x:.5,y:1,width:30},presenter_sizing:'visible-person-v1'})}>Small overlay</button>{(['left','center','right'] as const).map(side=><button type="button" key={side} onClick={()=>change({x:side==='left'?l.width/l.w/2:side==='right'?1-l.width/l.w/2:.5,y:1,width:placementFromLayout(plan,aspect).width})}>Bottom {side==='center'?'middle':side}</button>)}<button type="button" onClick={()=>change({x:.5,y:1,width:70})}>Large & centered</button></div><small>Keyboard: arrow keys move; + / − resize.</small></>;
}
export function FreePresenter({plan,onChange,children,hideShortcuts=false}:{plan:VideoPlan;onChange:(p:VideoPlan)=>void;children?:ReactNode;hideShortcuts?:boolean}){
 const [draft,setDraft]=useState<Placement>();
 const [thumbnailAspect,setThumbnailAspect]=useState<{key:string;aspect:number}>();
 const aspectKey=`${plan.avatar_id}:${plan.avatar_engine}:${plan.format}:${plan.presenter_sizing}`;
 const verifiedAspect=plan.avatar_preview?.avatar_id===plan.avatar_id&&plan.avatar_preview.engine===(plan.avatar_engine??'avatar_iv')&&plan.avatar_preview.format===plan.format;
 const baseAspect=thumbnailAspect?.key===aspectKey&&!verifiedAspect?thumbnailAspect.aspect:previewAspect(plan);
 const current=useRef(plan);current.current=plan;
 const active=useRef<Placement|undefined>(undefined);
 const points=useRef(new Map<number,Point>());
 const start=useRef<{p:Placement;center:Point;distance:number;resize:boolean}|undefined>(undefined);
 const stage=useRef<HTMLDivElement>(null);
 const shown={...plan,presenter_placement:draft??plan.presenter_placement};
 const aspect=framedAspect(baseAspect,shown.presenter_framing,shown.presenter_framing_amount);
 const l=presenterLayout(shown.format,shown.presenter_position,shown.presenter_size,shown.presenter_placement,aspect);
 function sample(){const a=[...points.current.values()];return {center:{x:a.reduce((n,p)=>n+p.x,0)/a.length,y:a.reduce((n,p)=>n+p.y,0)/a.length},distance:a.length>1?Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y):0};}
 function down(e:PointerEvent<HTMLDivElement>){
  if(e.button!==0||points.current.size>=2)return;
  if(!points.current.size&&!(e.target as HTMLElement).closest('[data-avatar-touch]'))return;
  ((e.target as HTMLElement).closest('[data-avatar-touch]') as HTMLElement|null)?.focus({preventScroll:true});
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=active.current??placementFromLayout(current.current,aspect);
  active.current=p;start.current={p,...sample(),resize:Boolean((e.target as HTMLElement).closest('[data-resize]'))};
 }
 function move(e:PointerEvent<HTMLDivElement>){
  if(!points.current.has(e.pointerId)||!start.current||!stage.current)return;
  e.preventDefault();points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const s=start.current,r=stage.current.getBoundingClientRect(),now=sample();
  const p=movePlacement(s.p,s.center,now.center,r,points.current.size===2?now.distance/Math.max(1,s.distance):1,points.current.size===1&&s.resize);
  active.current=p;setDraft(p);
 }
 function up(e:PointerEvent<HTMLDivElement>){
  if(!points.current.delete(e.pointerId))return;
  if(points.current.size){start.current={p:active.current!,...sample(),resize:false};return;}
  if(active.current)onChange({...current.current,presenter_placement:active.current});
  active.current=undefined;start.current=undefined;setDraft(undefined);
 }
 const change=(p:Placement)=>onChange({...plan,presenter_placement:p});
 return <div className="free-presenter-editor"><p className="gesture-hint">Drag to move · Pinch to resize</p>
  <div ref={stage} className="article-layout-stage free-presenter-stage" style={{aspectRatio:`${l.w}/${l.h}`,maxWidth:`min(320px, ${42*l.w/l.h}dvh)`}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
   {children}<SelectedAvatarOverlay plan={shown} onAspect={aspect=>setThumbnailAspect({key:aspectKey,aspect})}/>
   <div data-avatar-touch="true" className="avatar-touch-target" role="group" tabIndex={0} aria-label="Move avatar with arrow keys; plus or minus to resize" style={{left:`${l.x/l.w*100}%`,top:`${l.y/l.h*100}%`,width:`${l.width/l.w*100}%`,height:`${l.height/l.h*100}%`}} onKeyDown={e=>{const p=placementFromLayout(plan,aspect);const d=e.shiftKey?.05:.01;const keys:Record<string,()=>void>={ArrowLeft:()=>change({...p,x:clamp(p.x-d,-2,3)}),ArrowRight:()=>change({...p,x:clamp(p.x+d,-2,3)}),ArrowUp:()=>change({...p,y:clamp(p.y-d,-2,3)}),ArrowDown:()=>change({...p,y:clamp(p.y+d,-2,3)}),'+':()=>change({...p,width:clamp(p.width+2,5,100)}),'-':()=>change({...p,width:clamp(p.width-2,5,100)})};if(keys[e.key]){e.preventDefault();keys[e.key]();}}}>
    <span data-resize="true" className="avatar-resize-handle" aria-hidden="true">↔</span>
   </div>
  </div>
  <details className="avatar-framing-controls" aria-label="Avatar framing"><summary>Framing</summary><div className="article-layout-positions" role="group" aria-label="Framing preset">{avatarFramings.map(mode=><button type="button" aria-pressed={(plan.presenter_framing??'original')===mode} key={mode} onPointerDown={e=>e.stopPropagation()} onClick={()=>onChange({...plan,presenter_framing:mode as AvatarFraming,...(mode==='custom'?{presenter_framing_amount:plan.presenter_framing_amount??customFramingBounds.default}:{})})}>{avatarFramingLabels[mode]}</button>)}</div>
   {plan.presenter_framing==='custom'&&<label className="framing-amount">Visible body<input type="range" min={customFramingBounds.min} max={customFramingBounds.max} step={1} value={plan.presenter_framing_amount??customFramingBounds.default} aria-label="Visible body percentage" onChange={e=>onChange({...plan,presenter_framing_amount:Number(e.target.value)})}/><output>{plan.presenter_framing_amount??customFramingBounds.default}%</output></label>}
   <small>Visible body controls the crop. Drag or pinch controls the framed person's size separately.</small>
  </details>
  {!hideShortcuts&&<details><summary>Placement shortcuts</summary><PlacementShortcuts plan={plan} onChange={onChange}/></details>}
 </div>;
}
