import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {AbsoluteFill,Easing,interpolate,OffthreadVideo,useCurrentFrame} from 'remotion';
import {editStoryboard,type EditSource,type EditProposal} from '../src/domain/edit-templates';
import {editorialScene,editorialSceneStyles,seekEditorialScene} from '../src/domain/editorial-scenes';
import {editorialCaptions} from '../src/domain/editorial-captions';
import type {RenderIllustration} from '../src/domain/edit-illustrations';
import type {EditBrand} from '../src/domain/edit-brand';
import {popoutLayout as layout,popoutBeatIndex} from '../src/domain/popout-layout';
const ease=Easing.bezier(.65,0,.2,1);
export const referenceProgress=(frame:number,start:number,duration=8)=>interpolate(frame,[start,start+duration],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
function Graphic({source,beat,time,brand,image,full=false}:{source:EditSource;beat:ReturnType<typeof editStoryboard>[number];time:number;brand:EditBrand;image?:string;full?:boolean}){
 const root=useRef<HTMLDivElement>(null),markup=useMemo(()=>editorialScene(source,beat),[source,beat]);
 useLayoutEffect(()=>{
  const svg=root.current?.querySelector('svg');
  if(svg){const b=svg.getBBox();if(b.width&&b.height)svg.setAttribute('viewBox',`${b.x-20} ${b.y-20} ${b.width+40} ${b.height+40}`);}
 },[markup]);
 useLayoutEffect(()=>{if(root.current)seekEditorialScene(root.current,time);},[time,markup]);
 const words=beat.headline.split(/\s+/),split=Math.max(1,words.length-Math.ceil(words.length/2));
 const duration=brand.motionStyle==='calm'?14:brand.motionStyle==='snappy'?6:9;
 const p=beat.start===0?1:referenceProgress(time*30,beat.start*30,duration),q=beat.start===0?1:referenceProgress(time*30,beat.start*30+2,duration);
 return <div style={{position:'absolute',inset:0,color:brand.text}}>
 <div style={{position:'absolute',...layout.title,overflow:'hidden',fontSize:beat.headline.length>38?64:76,fontWeight:800,lineHeight:1.03,letterSpacing:-3.5}}><div style={{overflow:'hidden'}}><div style={{transform:`translateY(${(1-p)*110}%)`}}>{words.slice(0,split).join(' ')}</div></div><div style={{overflow:'hidden',fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:400,color:brand.primary}}><div style={{transform:`translateY(${(1-q)*110}%)`}}>{words.slice(split).join(' ')}</div></div></div>
 <div ref={root} className="reference-art" style={{position:'absolute',...(full?{left:60,top:480,width:960,height:1000}:layout.artwork),overflow:'hidden'}} dangerouslySetInnerHTML={image?undefined:{__html:markup}}>{image?<img src={image} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:undefined}</div>
 </div>;
}
export function ReferencePopout({sourceUrl,presenterUrl,source,proposal,brand,illustrations=[]}:{illustrations?:RenderIllustration[];sourceUrl:string;presenterUrl:string;source:EditSource;proposal:EditProposal;brand:EditBrand}){
 const frame=useCurrentFrame(),t=frame/30,beats=useMemo(()=>editStoryboard(proposal,source),[proposal,source]);
 const index=popoutBeatIndex(beats,t),beat=beats[index];
 const presenterOnly=beat.visual==='presenter',fullGraphic=beat.layout==='full-graphic'&&!presenterOnly;
 const caption=editorialCaptions(source.words).find(c=>t>=c.start&&t<c.end),wide=proposal.aspectRatio==='16:9';
 // The portrait artboard is letterboxed for widescreen; never stretch a face.
 return <AbsoluteFill style={{background:brand.background}}><div style={{position:'absolute',width:1080,height:1920,left:wide?656.25:0,top:0,transform:wide?'scale(.5625)':'none',transformOrigin:'0 0',overflow:'hidden',fontFamily:`${brand.fontFamily??'Arial'},sans-serif`,'--editorial-accent':brand.primary,'--editorial-ink':brand.text} as React.CSSProperties}>
 <style>{editorialSceneStyles+'.reference-art>svg{width:100%;height:100%;overflow:hidden}'}</style>
 <div style={{position:'absolute',...(presenterOnly?{left:0,top:0,width:1080,height:1920}:layout.presenter),opacity:fullGraphic?0:1,transform:`translateY(${12*(1-referenceProgress(frame,0,12))}px)`}}>
 {<OffthreadVideo src={sourceUrl} muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:!presenterOnly&&brand.presenterTreatment==='cutout'?0:1,clipPath:presenterOnly?'none':brand.presenterTreatment==='window'?'inset(0 round 30px)':'inset(38% 0 0 round 30px)'}}/>}
 {<OffthreadVideo src={presenterUrl} transparent muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:presenterOnly||brand.presenterTreatment==='window'?0:1,clipPath:brand.presenterTreatment==='cutout'?undefined:'inset(0 0 62% 0)'}}/>}
 <div style={{position:'absolute',inset:'48% 0 0',background:'linear-gradient(transparent,#08101eaa)'}}/>
 </div>
 <div data-popout-region="graphics" style={{position:'absolute',left:0,right:0,...(fullGraphic?{top:0,height:1700}:layout.graphics),opacity:presenterOnly?0:1,overflow:'hidden'}}>
 {<Graphic key={index} source={source} beat={beat} time={t} brand={brand} full={fullGraphic} image={illustrations.find(a=>a.beatIndex===index)?.dataUri}/>}
 <div style={{position:'absolute',top:145,left:80,right:80,fontSize:22,fontWeight:700,letterSpacing:3,color:brand.text}}>THE BIG PICTURE</div>
 </div>
 {caption&&brand.captionStyle!=='none'&&<div data-popout-region="captions" style={{position:'absolute',...(presenterOnly||fullGraphic?{left:65,top:1660,width:950,height:145}:layout.captions),display:'block',paddingTop:20,boxSizing:'border-box',overflow:'hidden',background:brand.background,textAlign:'center',fontSize:50,fontWeight:brand.captionStyle==='clean'?500:800,letterSpacing:-2,lineHeight:1.13,color:brand.text,zIndex:20}}>{source.words.filter(w=>w.start>=caption.start&&w.start<caption.end).map((word,i)=><React.Fragment key={i}><span style={{color:brand.captionStyle==='highlight'&&t>=word.start&&t<word.end?brand.primary:undefined}}>{brand.captionStyle==='bold'?word.text.toUpperCase():word.text}</span>{' '}</React.Fragment>)}</div>}

 </div></AbsoluteFill>;
}
