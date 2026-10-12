import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Film,Plus,Search,X} from 'lucide-react';
import type {Script} from '../domain/scripts';
import {videoStep,videoSteps} from '../domain/video-workflow';
import {videoRenderProgress,type VideoRender} from '../domain/video-plan';
import './video-library-picker.css';

export function filterVideoLibrary(items:Script[],query:string){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return items.filter(item=>words.every(word=>item.title.toLocaleLowerCase().includes(word)));
}
export function VideoLibraryPicker({items,current,disabled,renderStates={},onSelect}:{items:Script[];current:Script|null;disabled:boolean;renderStates?:Record<string,VideoRender|undefined>;onSelect:(item:Script|null)=>void}){
 const [expanded,setExpanded]=useState(false),[query,setQuery]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const id=useId();
 useEffect(()=>{
  if(!expanded)return;
  const element=dialog.current;if(!element)return;
  const overflow=document.body.style.overflow;
  element.showModal();heading.current?.focus({preventScroll:true});document.body.style.overflow='hidden';
  return()=>{if(element.open)element.close();document.body.style.overflow=overflow;};
 },[expanded]);
 function close(){dialog.current?.close();setExpanded(false);}
 function choose(item:Script|null){if(disabled)return;close();if(item?.id!==current?.id||!item)onSelect(item);}
 const visible=filterVideoLibrary(items,query);
 const sheet=<dialog ref={dialog} className="video-library" aria-labelledby={`${id}-title`} onClose={()=>setExpanded(false)} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}}>
  <div className="video-library-grip" aria-hidden="true"/>
  <header className="video-library-header"><div><span className="video-library-eyebrow">YOUR WORKSPACE</span><h2 id={`${id}-title`} ref={heading} tabIndex={-1}>My videos <span>{items.length}</span></h2></div><button type="button" className="video-library-close" aria-label="Close video library" onClick={close}><X size={20}/></button></header>
  <div className="video-library-tools"><button type="button" className="video-library-new" disabled={disabled} onClick={()=>choose(null)}><Plus size={19}/>New video</button><label className="video-library-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search your videos" placeholder="Find a video…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
  <div className="video-library-results"><p className="video-library-count" role="status">{query?`${visible.length} ${visible.length===1?'match':'matches'}`:'Your saved videos'}</p><ul>{visible.map(item=>{const step=videoStep(item.brief,Boolean(item.brief.production));const date=new Date(item.updated_at);const progress=videoRenderProgress(renderStates[item.id]??item.brief.production?.render);return <li key={item.id}><button type="button" className="video-library-item" aria-current={item.id===current?.id?'true':undefined} disabled={disabled} onClick={()=>choose(item)}><span className="video-library-icon" aria-hidden="true"><Film size={20}/></span><span className="video-library-copy"><strong>{item.title}</strong><small>{progress?`${progress.label} · ${progress.percent}% estimated`: `${videoSteps[step-1]} · Step ${step} of 4${Number.isFinite(date.getTime())?` · ${date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:''}`}</small>{progress&&<progress aria-label={`${item.title}: ${progress.label}, ${progress.percent}% estimated`} value={progress.percent} max="100"/>}</span>{item.id===current?.id?<Check size={19} className="video-library-check" aria-label="Current video"/>:<ChevronDown size={17} className="video-library-open" aria-hidden="true"/>}</button></li>;})}</ul>{!visible.length&&<div className="video-library-empty"><Film size={28}/><strong>{items.length?'No videos found':'Your videos start here'}</strong><p>{items.length?'Try a different title.':'Create your first video to save it in this library.'}</p>{query&&<button type="button" onClick={()=>setQuery('')}>Clear search</button>}</div>}</div>
 </dialog>;
 return <><button type="button" className="mobile-video-library-trigger" disabled={disabled} aria-haspopup="dialog" aria-expanded={expanded} aria-label={`Open My videos${current?`: ${current.title}`:''}`} onClick={()=>{setQuery('');setExpanded(true);}}><span className="video-library-icon" aria-hidden="true"><Film size={20}/></span><span><small>MY VIDEOS</small><strong>{current?.title??'Start a new video'}</strong></span><ChevronDown size={18} aria-hidden="true"/></button>{typeof document!=='undefined'&&createPortal(sheet,document.body)}</>;
}
