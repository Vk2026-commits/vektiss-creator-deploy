import {popoutBrand,popoutBackground,popoutDark} from '../src/domain/popout-brand';
import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {AbsoluteFill,Easing,interpolate,OffthreadVideo,useCurrentFrame} from 'remotion';
import {editStoryboard,type EditSource,type EditProposal} from '../src/domain/edit-templates';
import {editorialScene,editorialSceneStyles,seekEditorialScene} from '../src/domain/editorial-scenes';
import {editorialCaptions} from '../src/domain/editorial-captions';
import type {RenderIllustration} from '../src/domain/edit-illustrations';
import type {EditBrand} from '../src/domain/edit-brand';
import {popoutLayout as layout,popoutBeatIndex} from '../src/domain/popout-layout';
import {popoutDisplayPlan,popoutTitle} from '../src/domain/popout-display';
import {popoutPresenterMotion} from '../src/domain/popout-motion';
const ease=Easing.bezier(.65,0,.2,1);
export const referenceProgress=(frame:number,start:number,duration=8)=>interpolate(frame,[start,start+duration],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
function Graphic({source,beat,time,brand,image,artwork,full=false}:{source:EditSource;beat:ReturnType<typeof editStoryboard>[number];time:number;brand:EditBrand;image?:string;artwork?:Record<string,string>;full?:boolean}){
 const root=useRef<HTMLDivElement>(null),markup=useMemo(()=>editorialScene(source,beat,artwork),[source,beat,artwork]);
 useLayoutEffect(()=>{if(root.current)seekEditorialScene(root.current,time);},[time,markup]);
 const title=popoutTitle(beat),titleRef=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const el=titleRef.current;if(!el)return;let size=76;el.style.fontSize=size+'px';while((el.scrollHeight>el.clientHeight||el.scrollWidth>el.clientWidth)&&size>32){size--;el.style.fontSize=size+'px';}},[title.headline,brand.fontFamily]);
 const duration=brand.motionStyle==='calm'?14:brand.motionStyle==='snappy'?6:9;
 const p=beat.start===0?1:referenceProgress(time*30,beat.start*30,duration);
 const firstGraphic=Math.min(...(beat.graphics?.nodes??[]).map(n=>n.revealWord===undefined?beat.start:source.words[n.revealWord].start));
 const leadShift=!title.support&&Number.isFinite(firstGraphic)&&firstGraphic-beat.start>1.25?140*(1-referenceProgress(time*30,(firstGraphic-.6)*30,18)):0;
 return <div style={{position:'absolute',inset:0,color:brand.text}}>
 <div ref={titleRef} data-popout-title style={{position:'absolute',...layout.title,...(title.support?{top:570,height:220}:{}),fontSize:76,fontWeight:800,lineHeight:1.08,letterSpacing:-2,overflowWrap:'break-word',transform:`translateY(${(1-p)*16+leadShift}px)`,opacity:p}}>{title.headline}{title.support&&<div style={{fontSize:48,fontWeight:500,lineHeight:1.2,marginTop:24,color:brand.primary}}>{title.support}</div>}</div>
 <div ref={root} className="reference-art" style={{position:'absolute',...(full?{left:60,top:480,width:960,height:1000}:beat.scene==='statistic'?{left:60,top:270,width:960,height:570}:layout.artwork),overflow:'hidden',transform:`scale(${1+.025*Math.min(1,Math.max(0,(time-beat.start)/Math.max(.1,beat.end-beat.start)))})`,transformOrigin:'50% 50%'}} dangerouslySetInnerHTML={image?undefined:{__html:title.support||!beat.graphics?.nodes.length?'':markup}}>{image?<img src={image} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:undefined}</div>
 </div>;
}
export function ReferencePopout({sourceUrl,presenterUrl,source,proposal,brand,illustrations=[]}:{illustrations?:RenderIllustration[];sourceUrl:string;presenterUrl:string;source:EditSource;proposal:EditProposal;brand:EditBrand}){
 brand=popoutBrand(brand);
 const frame=useCurrentFrame(),t=frame/30,beats=useMemo(()=>editStoryboard(popoutDisplayPlan(proposal),source),[proposal,source]);
 const index=popoutBeatIndex(beats,t),rawBeat=beats[index];
 const beat=rawBeat;
 const presenterMotion=popoutPresenterMotion(t,beat.start,beat.end);
 const presenterOnly=false,fullGraphic=beat.layout==='full-graphic'&&!presenterOnly;
 const caption=editorialCaptions(source.words).find(c=>t>=c.start&&t<c.end),wide=proposal.aspectRatio==='16:9';
 // The portrait artboard is letterboxed for widescreen; never stretch a face.
 return <AbsoluteFill style={{background:popoutBackground(brand)}}><div style={{position:'absolute',width:1080,height:1920,left:wide?656.25:0,top:0,transform:wide?'scale(.5625)':'none',transformOrigin:'0 0',overflow:'hidden',fontFamily:`${brand.fontFamily??'Arial'},sans-serif`,'--editorial-accent':brand.primary,'--editorial-ink':brand.text,'--editorial-font':brand.fontFamily??'Arial'} as React.CSSProperties}>
 <style>{editorialSceneStyles+`.reference-art>svg{width:100%;height:100%;overflow:hidden}.reference-art .ed-panel,.reference-art .ed-row,.reference-art .ed-frame,.reference-art .ed-hub,.reference-art .ed-satellite,.reference-art .ed-search-field,.reference-art .ed-check-box,.reference-art .ed-step-ring{fill:${popoutDark(brand)?'#101010':'#F7F7F7'};stroke:${popoutDark(brand)?'#FFFFFF24':'#D8D8D8'}}.reference-art .ed-label{fill:${brand.text};color:${brand.text}}.reference-art .ed-context,.reference-art .ed-index{fill:${popoutDark(brand)?'#CCCCCC':'#555555'};color:${popoutDark(brand)?'#CCCCCC':'#555555'}}.reference-art .ed-muted-line,.reference-art .ed-frame-rule,.reference-art .ed-orbit-inner{stroke:#D8D8D8}`}</style>
 <div style={{position:'absolute',...(presenterOnly?{left:0,top:0,width:1080,height:1920}:layout.presenter),opacity:fullGraphic?0:presenterMotion.opacity,transform:`translateY(${presenterMotion.translateY}px) scale(${presenterMotion.scale})`,transformOrigin:'50% 100%'}}>
 {<OffthreadVideo src={sourceUrl} muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:!presenterOnly&&brand.presenterTreatment==='cutout'?0:1,maskImage:!presenterOnly&&brand.presenterTreatment!=='window'?'linear-gradient(to bottom, transparent 28%, black 32%)':undefined,clipPath:presenterOnly?'none':brand.presenterTreatment==='window'?'inset(0 round 30px)':'inset(0 round 30px)'}}/>}
 {<OffthreadVideo src={presenterUrl} transparent muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:presenterOnly||brand.presenterTreatment==='window'?0:1,maskImage:brand.presenterTreatment==='cutout'?undefined:'linear-gradient(to bottom, black 32%, transparent 36%)'}}/>}
 <div style={{position:'absolute',inset:'48% 0 0',background:'linear-gradient(transparent,#08101eaa)'}}/>
 </div>
 <div data-popout-region="graphics" style={{position:'absolute',left:0,right:0,...(fullGraphic?{top:0,height:1700}:layout.graphics),opacity:presenterOnly?0:1,overflow:'hidden'}}>
 {<Graphic key={index} source={source} beat={beat} time={t} brand={brand} full={fullGraphic} artwork={Object.fromEntries(illustrations.filter(a=>a.nodeIndex!==undefined&&proposal.beats[a.beatIndex]?.lastWord===beat.lastWord).map(a=>[proposal.beats[a.beatIndex].graphics!.nodes[a.nodeIndex!].label,a.dataUri]))} image={illustrations.find(a=>a.nodeIndex===undefined&&proposal.beats[a.beatIndex]?.lastWord===beat.lastWord)?.dataUri}/>}

 </div>
 {caption&&brand.captionStyle!=='none'&&<div data-popout-region="captions" style={{position:'absolute',...(presenterOnly||fullGraphic?{left:65,top:1660,width:950,height:145}:layout.captions),display:'block',paddingTop:20,boxSizing:'border-box',overflow:'hidden',background:'transparent',textAlign:'center',fontSize:50,fontWeight:brand.captionStyle==='clean'?500:800,letterSpacing:-2,lineHeight:1.13,color:brand.text,zIndex:20}}>{source.words.filter(w=>w.start>=caption.start&&w.start<caption.end).map((word,i)=><React.Fragment key={i}><span style={{color:brand.captionStyle==='highlight'&&t>=word.start&&t<word.end?brand.primary:undefined}}>{brand.captionStyle==='bold'?word.text.toUpperCase():word.text}</span>{' '}</React.Fragment>)}</div>}

 </div></AbsoluteFill>;
}
