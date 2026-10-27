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
 return <><p>See the look before choosing. Hover or tap Preview for five seconds. Your colors apply immediately. Previewing is free and does not upload your footage.</p><p>{mediaUrl?'Previewing your selected footage, muted. Sample words and graphics illustrate the style; they are not a generated edit of your speech.':'Choose a video above to preview these looks on your footage. All styles use the same sample presenter; words and graphics are illustrative.'}</p><div className="template-grid">{samples.map((t,i)=><article className={`template-card ${selected===t.id?'is-selected':''}`} key={t.id} onPointerEnter={e=>{if(e.pointerType==='mouse'&&!reduced)play(t.id);}} onPointerLeave={()=>setPlaying(current=>current===t.id?null:current)}>
  <div ref={i===0?root:undefined} className="template-demo" style={{aspectRatio:aspectRatio==='16:9'?'16/9':'9/16'}} aria-label={`${styleGallery[t.id].name} illustrative sample`}><div aria-hidden="true" style={{...dimensions,position:'relative',transform:`scale(${width/dimensions.width})`,transformOrigin:'top left'}}>{['hyperframes-motion','phone-mockup','paper-cutout','clean-tech','glass-cards','animated-explainer','charts-comparisons'].includes(t.id)?<HyperframesSample templateId={t.id} mediaUrl={mediaUrl} brand={brand} aspectRatio={aspectRatio} frame={playing===t.id?frame:['animated-explainer','charts-comparisons'].includes(t.id)?120:45}/>:<EditComposition source={templateSampleSource} proposal={{...t.proposal,aspectRatio}} brand={mediaUrl?brand:{...brand,captionStyle:'none'}} frame={playing===t.id?frame:45} media={<StyleSampleFootage url={mediaUrl??'/style-assets/glass-presenter.mp4'} frame={playing===t.id?frame:45}/>}/>}</div></div>
  <div className="template-card-copy"><div className="template-card-title"><h3>{styleGallery[t.id].name}</h3><span>{aspectRatio}</span></div><p>{styleGallery[t.id].summary}</p>
  <details className="template-details"><summary>Style details</summary><p>Best for: {styleGallery[t.id].bestFor}</p><ul>{styleGallery[t.id].effects.map(effect=><li key={effect}>{effect}</li>)}</ul>{t.id==='paper-cutout'&&<p>Your presenter is separated during export; edge quality depends on the recording.</p>}</details>
  <div className="template-card-actions"><button type="button" className="button" onClick={()=>playing===t.id?setPlaying(null):play(t.id)} aria-label={`${playing===t.id?'Stop':'Preview'} ${styleGallery[t.id].name}`}>{playing===t.id?'Stop':'Preview · 5s'}</button>
  <button type="button" className="button primary" aria-label={`Use ${styleGallery[t.id].name}`} aria-pressed={selected===t.id} onClick={()=>onSelect(t.id)}>{selected===t.id?'Selected':'Use style'}</button></div></div>
 </article>)}</div></>;
}
