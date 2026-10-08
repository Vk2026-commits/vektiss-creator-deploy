import './script-progress.css';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
export type DraftProgress={percent:number;label:string;failed?:boolean;waiting?:boolean;indeterminate?:boolean};
export function ScriptProgress({progress}:{progress:DraftProgress}){
 const {percent,label,failed,waiting,indeterminate}=progress;
 const active=percent<100&&!failed&&!waiting;
 const [minimized,setMinimized]=useState(false);
 useEffect(()=>{if(!active)setMinimized(false);},[active]);
 const panel=<div className={`draft-progress${failed?' draft-progress-failed':''}${active?' draft-progress-active':''}`} role="status" aria-live="polite">
  <div><strong>{label}</strong><span>{failed?'Stopped':waiting?'Your input needed':indeterminate?'Processing…':`${percent}%${percent<100?' estimated':''}`}</span></div>
  {!failed&&!waiting&&<progress max={100} value={indeterminate?undefined:percent} aria-label="Script creation progress" aria-valuetext={indeterminate?label:`${percent}%${percent<100?' estimated':''}. ${label}`}/>}
  <small>{failed?'Your source is kept where available. Retry when you’re ready.':waiting?'Your video is ready. Check the ending below, then select Use this cut & create script.':percent===100?'Ready for your review.':indeterminate?'Working on the current stage. A reliable percentage is not available yet.':'You can stay here. We’ll open your script when it’s ready.'}</small>
 </div>;
 return <>{active?createPortal(minimized?<button className="source-progress-pill" type="button" onClick={()=>setMinimized(false)}>◌ {label} · View progress</button>:<div className="source-progress-overlay"><section className="source-progress-card" aria-label="Source processing"><span className="source-progress-kicker">VEKTISS IS WORKING</span><h2>Bringing your idea to life</h2>{panel}<button type="button" onClick={()=>setMinimized(true)}>Minimize progress</button></section></div>,document.body):panel}</>;
}
