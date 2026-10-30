import {captionWordAt} from '../domain/caption-timing';
import {cloneElement,isValidElement,type CSSProperties,type ReactNode} from 'react';
import type {EditSource,EditProposal} from '../domain/edit-templates';
import type {EditBrand} from '../domain/edit-brand';

const ease=(n:number)=>1-Math.pow(1-Math.max(0,Math.min(1,n)),3);
type Beat=EditProposal['beats'][number];
function PeopleMark({color,size=90}:{color:string;size?:number}){return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="28" r="12" fill={color}/><circle cx="20" cy="40" r="9" fill={color} opacity=".45"/><circle cx="80" cy="40" r="9" fill={color} opacity=".45"/><path d="M29 83V66a21 21 0 0 1 42 0v17M5 83V69a15 15 0 0 1 21-14M95 83V69a15 15 0 0 0-21-14" stroke={color} strokeWidth="7" strokeLinecap="round"/></svg>;}
export function sceneFor(beat:Beat){return beat.scene??(beat.visual==='comparison'?'comparison':beat.visual==='steps'?'process':beat.visual==='typography'?'spotlight':'network');}
export function RichEditComposition({source,proposal,brand,frame,media}:{source:EditSource;proposal:EditProposal;brand:EditBrand;frame:number;media:ReactNode}){
 const time=frame/30;
 const wide=proposal.aspectRatio==='16:9';
 const index=Math.max(0,proposal.beats.findIndex((b,i)=>time>=(i===0?0:source.words[b.firstWord].start)&&time<(i===proposal.beats.length-1?source.duration:source.words[proposal.beats[i+1].firstWord].start)));
 const beat=proposal.beats[index],nodes=beat.graphics?.nodes??[];
 const start=index===0?0:source.words[beat.firstWord].start;
 const end=index===proposal.beats.length-1?source.duration:source.words[proposal.beats[index+1].firstWord].start;
 const local=time-start,scene=sceneFor(beat);
 const presenter=beat.visual==='presenter'||beat.layout==='presenter';
 const full=beat.layout==='full-graphic'&&!presenter;
 const tier=beat.visual==='tier-board';
 const reveal=(i:number)=>ease((time-(nodes[i]?.revealWord===undefined?start+i*Math.min(.65,(end-start)/(nodes.length+1)):source.words[nodes[i].revealWord!].start))/.45);
 const entrance=ease(local/.5);
 const ink=brand.text,accent=brand.primary,paper=brand.background;
 const card:CSSProperties={background:paper,border:`2px solid ${accent}55`,borderRadius:28,boxShadow:`0 18px 45px ${ink}12`,padding:'28px 32px',fontSize:40,fontWeight:700,lineHeight:1.15};
 const animated=(i:number):CSSProperties=>({opacity:reveal(i),transform:`translateY(${(1-reveal(i))*24}px)`});
 const activeWord=captionWordAt(source.words,time);
 const caption=activeWord<0?[]:source.words.slice(Math.floor(activeWord/4)*4,Math.floor(activeWord/4)*4+4);
 const graphicTop=wide?85:full?300:125;
 const framedMedia=isValidElement<{style?:CSSProperties}>(media)?cloneElement(media,{style:{...media.props.style,objectFit:proposal.templateId==='walkthrough'?'contain':'cover',objectPosition:'center'}}):media;
 return <div data-renderer="2" data-scene={scene} style={{position:'absolute',inset:0,background:paper,color:ink,fontFamily:`${brand.fontFamily??'Arial'}, sans-serif`,overflow:'hidden'}}>
  <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 90% 0%, ${accent}20, transparent 65%)`}}/>
  {!full&&<div style={{position:'absolute',...(presenter?{inset:0}:wide?{left:1040,right:55,top:90,bottom:140}:{left:38,right:38,top:1060,bottom:60}),overflow:'hidden',borderRadius:presenter?0:36,background:ink}}>{framedMedia}</div>}
  {!presenter&&<section style={{position:'absolute',top:graphicTop,left:wide?(full?492:60):72,width:936,opacity:entrance,transformOrigin:'top left',transform:`translateY(${(1-entrance)*18}px) scale(${wide&&!full?.94:1})`}}>
   <div style={{display:'flex',alignItems:'center',gap:18,marginBottom:28}}><span style={{height:6,width:64,background:accent,borderRadius:8}}/><span style={{fontSize:20,fontWeight:700,letterSpacing:4,color:accent}}>KEY IDEA · {String(index+1).padStart(2,'0')}</span></div>
   <h2 style={{fontSize:64,lineHeight:1.03,letterSpacing:-2,margin:'0 0 48px',maxWidth:900}}>{beat.headline}</h2>
   <div style={{position:'relative',height:full?950:650}}>
    {tier?<div style={{display:'grid',gap:12}}>{['S','A','B','C','D'].map(rank=><div key={rank} style={{display:'flex',alignItems:'center',gap:16,minHeight:100,background:`${accent}12`,borderRadius:20,padding:'8px 16px'}}><b style={{fontSize:48,width:60,color:accent}}>{rank}</b>{nodes.map((n,i)=>n.tier===rank?<div key={i} style={{...card,...animated(i),fontSize:26,padding:16,flex:1}}>{n.label}</div>:null)}</div>)}</div>:
    scene==='process'||scene==='timeline'?<div style={{position:'relative',display:'grid',gap:16}}>
     <div style={{position:'absolute',left:38,top:42,bottom:42,width:4,background:`${accent}35`,transformOrigin:'top',transform:`scaleY(${ease(local/Math.max(1,nodes.length*.65))})`}}/>
     {nodes.map((n,i)=><div key={i} style={{display:'flex',gap:24,alignItems:'center',...animated(i)}}><div style={{zIndex:1,width:80,height:80,borderRadius:scene==='timeline'?40:20,background:accent,color:paper,display:'grid',placeItems:'center',fontSize:34,fontWeight:800,flexShrink:0}}>{String(i+1).padStart(2,'0')}</div><div style={{...card,fontSize:nodes.length>4?30:38,padding:nodes.length>4?'18px 26px':'26px 32px',flex:1}}>{n.label}</div></div>)}
    </div>:
    scene==='comparison'?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>{nodes.map((n,i)=><div key={i} style={{...card,...animated(i),minHeight:150,borderTop:`8px solid ${accent}`,display:'flex',alignItems:'center',fontSize:38}}>{n.label}</div>)}</div>:
    scene==='statistic'?<div style={{...card,...animated(0),padding:48}}><div style={{fontSize:112,fontWeight:900,letterSpacing:-5,lineHeight:1.05,color:accent,overflowWrap:'anywhere'}}>{nodes[0]?.label}</div><div style={{height:5,background:accent,margin:'34px 0',transformOrigin:'left',transform:`scaleX(${ease((local-.3)/.8)})`}}/>{nodes.slice(1).map((n,i)=><p key={i} style={{fontSize:34,...animated(i+1)}}>{n.label}</p>)}</div>:
    scene==='document'?<div style={{...card,padding:48,minHeight:420,transform:`rotate(${(1-entrance)*-3}deg)`,borderTop:`9px solid ${accent}`}}><div style={{display:'flex',alignItems:'center',gap:22,marginBottom:35}}><svg width="78" height="88" viewBox="0 0 78 88" fill="none"><path d="M12 4h36l18 20v60H12z" stroke={accent} strokeWidth="4"/><path d="M48 4v20h18M24 42h30M24 55h30M24 68h18" stroke={accent} strokeWidth="4"/></svg><div style={{fontSize:23,letterSpacing:4,color:accent}}>YOUR NEXT MOVE</div></div>{nodes.map((n,i)=><div key={i} style={{...animated(i),display:'flex',gap:22,alignItems:'center',padding:'22px 0',borderBottom:`2px solid ${ink}18`,fontSize:40}}><span style={{color:accent,fontSize:36}}>✓</span>{n.label}</div>)}</div>:
    scene==='spotlight'?<div style={{display:'grid',gap:24}}>{nodes.map((n,i)=><div key={i} style={{...animated(i),fontSize:nodes.length===1?88:52,fontWeight:900,letterSpacing:-2,lineHeight:1.08,padding:'24px 0',borderBottom:`5px solid ${accent}`,color:i===0?accent:ink}}>{n.label}</div>)}</div>:
    <div style={{position:'relative',height:620}}>
     <svg viewBox="0 0 936 620" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>{nodes.slice(1).map((_,i)=>{const angle=(i/Math.max(1,nodes.length-1))*Math.PI*2-Math.PI/2;return <line key={i} x1="468" y1="310" x2={468+Math.cos(angle)*320} y2={310+Math.sin(angle)*230} stroke={accent} strokeWidth="3" opacity={reveal(i+1)*.5}/>;})}</svg>
     {nodes.map((n,i)=>{const angle=((i-1)/Math.max(1,nodes.length-1))*Math.PI*2-Math.PI/2;return <div key={i} style={{...card,...animated(i),position:'absolute',left:i===0?318:468+Math.cos(angle)*320-130,top:i===0?210:310+Math.sin(angle)*230-70,width:i===0?300:260,minHeight:i===0?200:140,boxSizing:'border-box',padding:20,fontSize:i===0?38:30,textAlign:'center',display:'grid',placeItems:'center',background:i===0?accent:paper,color:i===0?paper:ink,borderRadius:i===0?48:24}}>{i===0&&<PeopleMark color={paper} size={85}/>}<span>{n.label}</span></div>;})}
    </div>}
   </div>
  </section>}
  {presenter&&beat.headline&&<div style={{position:'absolute',top:125,left:65,right:65,textAlign:'center',opacity:entrance}}><span style={{background:paper,color:ink,fontSize:58,fontWeight:900,lineHeight:1.2,padding:'12px 24px',boxDecorationBreak:'clone'}}>{beat.headline}</span></div>}
  {brand.captionStyle!=='none'&&caption.length>0&&<div style={{position:'absolute',bottom:wide?45:presenter?180:full?180:130,left:80,right:80,textAlign:'center',fontSize:brand.captionStyle==='bold'?56:44,fontWeight:brand.captionStyle==='clean'?500:800,lineHeight:1.35,textTransform:brand.captionStyle==='bold'?'uppercase':'none'}}><span style={{background:paper,color:ink,padding:'12px 20px',borderRadius:12,boxDecorationBreak:'clone',boxShadow:`0 4px 18px ${ink}20`}}>{caption.map((w,i)=><span key={i} style={{color:brand.captionStyle==='highlight'&&w===source.words[activeWord]?accent:ink}}>{w.text}{' '}</span>)}</span></div>}
 </div>;
}
