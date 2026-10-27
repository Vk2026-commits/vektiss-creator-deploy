import {useEffect,useRef,useState} from 'react';
import {styleGallery} from '../domain/style-gallery';
import {StyleSampleFootage} from './StyleSampleFootage';
import {editTemplates} from '../domain/edit-templates';
import type {EditBrand} from '../domain/edit-brand';
import {templateSample,templateSampleSource} from '../domain/edit-template-samples';
import {EditComposition} from './EditComposition';
import {HyperframesSample} from './HyperframesSample';
import {editDimensions,type EditAspectRatio} from '../domain/edit-format';

const samples=editTemplates.map(t=>({...t,proposal:templateSample(t.id)}));
const placeholder=<div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',color:'#fff',background:'#27364b'}}><svg width="300" height="380" viewBox="0 0 300 380"><circle cx="150" cy="90" r="65" fill="#a7b6c9"/><path d="M20 370V250a130 130 0 0 1 260 0v120" fill="#7c8fa9"/></svg><span style={{fontSize:30}}>SAMPLE PRESENTER</span></div>;
export function TemplateChooser({brand,selected,onSelect,aspectRatio='9:16',file}:{file?:File|null;brand:EditBrand;selected:string;onSelect:(id:string)=>void;aspectRatio?:EditAspectRatio}){
 const dimensions=editDimensions(aspectRatio);
 const [mediaUrl,setMediaUrl]=useState<string|null>(null);
 useEffect(()=>{if(!file){setMediaUrl(null);return;}const url=URL.createObjectURL(file);setMediaUrl(url);return()=>URL.revokeObjectURL(url);},[file]);
 const [playing,setPlaying]=useState<string|null>(null),[frame,setFrame]=useState(45),[replay,setReplay]=useState(0);
 const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const root=useRef<HTMLDivElement>(null),[width,setWidth]=useState(210);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{setReduced(query.matches);setPlaying(null);};query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(root.current)observer.observe(root.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!playing)return;
  let request=0;const start=performance.now();
  const tick=(now:number)=>{const next=Math.min(149,Math.floor((now-start)*.03));setFrame(next);if(next<149)request=requestAnimationFrame(tick);else setPlaying(null);};
  request=requestAnimationFrame(tick);
  const hide=()=>{if(document.hidden)setPlaying(null);};document.addEventListener('visibilitychange',hide);
  return()=>{cancelAnimationFrame(request);document.removeEventListener('visibilitychange',hide);};
 },[playing,replay]);
 function play(id:string){setFrame(0);setPlaying(id);setReplay(n=>n+1);}
 return <><p>See the look before choosing. Hover or tap Preview for five seconds. Your colors apply immediately. Previewing is free and does not upload your footage.</p><p>{mediaUrl?'Previewing your selected footage, muted. Sample words and graphics illustrate the style; they are not a generated edit of your speech.':'Choose a video above to preview these looks on your footage. Until then, these are layout illustrations only.'}</p><div className="template-grid">{samples.map((t,i)=><article className={`template-card ${selected===t.id?'is-selected':''}`} key={t.id} onPointerEnter={e=>{if(e.pointerType==='mouse'&&!reduced)play(t.id);}} onPointerLeave={()=>setPlaying(current=>current===t.id?null:current)}>
  <div ref={i===0?root:undefined} className="template-demo" style={{aspectRatio:aspectRatio==='16:9'?'16/9':'9/16'}} aria-label={`${styleGallery[t.id].name} illustrative sample`}><div aria-hidden="true" style={{...dimensions,position:'relative',transform:`scale(${width/dimensions.width})`,transformOrigin:'top left'}}>{['hyperframes-motion','phone-mockup','paper-cutout','clean-tech'].includes(t.id)?<HyperframesSample templateId={t.id} mediaUrl={mediaUrl} brand={brand} aspectRatio={aspectRatio} frame={playing===t.id?frame:45}/>:<EditComposition source={templateSampleSource} proposal={{...t.proposal,aspectRatio}} brand={brand} frame={playing===t.id?frame:45} media={mediaUrl?<StyleSampleFootage url={mediaUrl} frame={playing===t.id?frame:45}/>:placeholder}/>}</div></div>
  <h3>{styleGallery[t.id].name}</h3>{t.id==='paper-cutout'&&<p><small>Layout illustration. Your actual presenter is separated during export; edge quality depends on the recording.</small></p>}<p>{styleGallery[t.id].summary}</p><p><small>Best for: {styleGallery[t.id].bestFor}</small></p><ul>{styleGallery[t.id].effects.map(effect=><li key={effect}>{effect}</li>)}</ul>
  <button type="button" className="button" onClick={()=>playing===t.id?setPlaying(null):play(t.id)} aria-label={`${playing===t.id?'Stop':'Preview'} ${styleGallery[t.id].name}`}>{playing===t.id?'Stop preview':'Preview · 5 sec'}</button>
  <button type="button" className="button primary" aria-pressed={selected===t.id} onClick={()=>onSelect(t.id)}>{selected===t.id?'Selected':'Use this look'}</button>
 </article>)}</div></>;
}
