import React from 'react';
import {AbsoluteFill,Composition,OffthreadVideo,registerRoot,useCurrentFrame,interpolate} from 'remotion';

const palette={navy:'#10263d',blue:'#1688ff',paper:'#f4f8ff',ink:'#10263d'};
function Edit({sourceUrl,source,proposal}:any){
 const frame=useCurrentFrame(),time=frame/30;
 const beat=proposal.beats.find((b:any,i:number)=>time>=(i===0?0:source.words[b.firstWord].start)&&time<(i===proposal.beats.length-1?source.duration:source.words[proposal.beats[i+1].firstWord].start))??proposal.beats[0];
 const start=source.words[beat.firstWord].start,local=frame-start*30;
 const split=proposal.templateId==='premium-explainer'&&beat.visual!=='presenter';
 const tier=beat.visual==='tier-board';
 const nodes=beat.graphics?.nodes??[],links=beat.graphics?.links??[];
 const currentWord=source.words.findIndex((w:any)=>w.start<=time&&time<w.end);
 const captionStart=currentWord<0?-1:Math.floor(currentWord/5)*5;
 const caption=captionStart<0?[]:source.words.slice(captionStart,captionStart+5);
 return <AbsoluteFill style={{background:palette.paper,fontFamily:'Arial, sans-serif',color:palette.ink}}>
  <div style={{position:'absolute',inset:split?'52% 0 0':'0',background:palette.navy}}><OffthreadVideo src={sourceUrl} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></div>
  {(nodes.length>0||beat.headline)&&<div style={{position:'absolute',left:64,right:64,top:split?105:tier?1050:120,height:split?820:tier?570:480,background:split?'transparent':'rgba(244,248,255,.96)',borderRadius:32,padding:30}}>
   <div style={{fontSize:44,fontWeight:800,lineHeight:1.1,maxWidth:820}}>{beat.headline}</div>
   <svg viewBox="0 0 900 560" style={{width:'100%',height:'85%',overflow:'visible'}}>
    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={palette.blue}/></marker></defs>
    {!tier&&links.map((l:any,i:number)=>{const a=nodes[l.from],b=nodes[l.to];if(!a||!b)return null;const dx=(b.x-a.x)*9,dy=(b.y-a.y)*5.6,d=Math.hypot(dx,dy)||1;return <line key={i} x1={a.x*9+dx/d*115} y1={a.y*5.6+dy/d*65} x2={b.x*9-dx/d*115} y2={b.y*5.6-dy/d*95} stroke={palette.blue} strokeWidth={5} markerEnd="url(#arrow)" opacity={interpolate(local,[12+i*5,24+i*5],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>;})}
    {tier&&['S','A','B','C','D'].map((rank,i)=><g key={rank}><rect x={0} y={i*108} width={900} height={100} rx={12} fill={i%2?'#e4effc':'#d6e8fc'}/><text x={30} y={i*108+62} fontSize={38} fontWeight={800} fill={palette.blue}>{rank}</text></g>)}
    {nodes.map((n:any,i:number)=>{const progress=interpolate(local,[i*5,i*5+12],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});const sameTier=nodes.slice(0,i).filter((other:any)=>other.tier===n.tier).length;return <g key={i} transform={`translate(${tier?210+sameTier*235:n.x*9},${(tier?['S','A','B','C','D'].indexOf(n.tier)*108+50:n.y*5.6)+(1-progress)*20})`} opacity={progress}>
     {n.shape==='circle'&&!tier?<circle r={100} fill="white" stroke={palette.blue} strokeWidth={4}/>:<rect x={-110} y={tier?-43:-55} width={220} height={tier?86:110} rx={18} fill="white" stroke={palette.blue} strokeWidth={4}/>}
     <foreignObject x={-99} y={-46} width={198} height={92}><div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',fontSize:25,fontWeight:700,lineHeight:1.15,overflowWrap:'anywhere'}}>{n.tier?`${n.tier} · `:''}{n.label}</div></foreignObject>
    </g>;})}
   </svg>
  </div>}
  {caption.length>0&&<div style={{position:'absolute',bottom:160,left:95,right:95,textAlign:'center',fontSize:45,fontWeight:800,lineHeight:1.3}}><span style={{background:'rgba(8,25,42,.93)',color:'white',padding:'12px 18px',borderRadius:16,boxDecorationBreak:'clone'}}>{caption.map((w:any,i:number)=><span key={i} style={{color:captionStart+i===currentWord?'#6fc5ff':'white'}}>{w.text}{' '}</span>)}</span></div>}
 </AbsoluteFill>;
}
registerRoot(()=> <Composition id="CreatorEdit" component={Edit} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{sourceUrl:'',source:{duration:1,words:[]},proposal:{beats:[]}}} calculateMetadata={({props})=>({durationInFrames:Math.ceil(props.source.duration*30)})}/>);
