import {useEffect,useRef,useState} from 'react';
import {editTemplates} from '../domain/edit-templates';
import type {EditBrand} from '../domain/edit-brand';
import {templateSample,templateSampleSource} from '../domain/edit-template-samples';
import {EditComposition} from './EditComposition';

const samples=editTemplates.map(t=>({...t,proposal:templateSample(t.id)}));
const placeholder=<div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',color:'#fff',background:'#27364b'}}><svg width="300" height="380" viewBox="0 0 300 380"><circle cx="150" cy="90" r="65" fill="#a7b6c9"/><path d="M20 370V250a130 130 0 0 1 260 0v120" fill="#7c8fa9"/></svg><span style={{fontSize:30}}>SAMPLE PRESENTER</span></div>;
export function TemplateChooser({brand,selected,onSelect}:{brand:EditBrand;selected:string;onSelect:(id:string)=>void}){
 const [playing,setPlaying]=useState<string|null>(null),[frame,setFrame]=useState(45),[replay,setReplay]=useState(0);
 const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
 return <><p>Hover to preview five seconds, or tap Preview. Choose a style separately. Samples use your colors and captions; no AI calls or charges.</p><div className="template-grid">{samples.map((t,i)=><article className={`template-card ${selected===t.id?'is-selected':''}`} key={t.id} onPointerEnter={e=>{if(e.pointerType==='mouse'&&!reduced)play(t.id);}} onPointerLeave={()=>setPlaying(current=>current===t.id?null:current)}>
  <div ref={i===0?root:undefined} className="template-demo" aria-label={`${t.name} illustrative sample`}><div aria-hidden="true" style={{width:1080,height:1920,position:'relative',transform:`scale(${width/1080})`,transformOrigin:'top left'}}><EditComposition source={templateSampleSource} proposal={t.proposal} brand={brand} frame={playing===t.id?frame:45} media={placeholder}/></div></div>
  <h3>{t.name}</h3><p>{t.description}</p>
  <button type="button" className="button" onClick={()=>play(t.id)} aria-label={`Preview ${t.name}`}>Preview · 5 sec</button>
  {playing===t.id&&<button type="button" onClick={()=>setPlaying(null)}>Stop preview</button>}
  <button type="button" className="button primary" aria-pressed={selected===t.id} onClick={()=>onSelect(t.id)}>{selected===t.id?'Selected':'Use this style'}</button>
 </article>)}</div></>;
}
