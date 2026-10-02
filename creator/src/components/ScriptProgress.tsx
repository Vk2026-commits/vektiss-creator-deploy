import './script-progress.css';
export type DraftProgress={percent:number;label:string;failed?:boolean;waiting?:boolean;indeterminate?:boolean};
export function ScriptProgress({progress}:{progress:DraftProgress}){
 const {percent,label,failed,waiting,indeterminate}=progress;
 return <div className={`draft-progress${failed?' draft-progress-failed':''}${percent<100&&!failed&&!waiting?' draft-progress-active':''}`} role="status">
  <div><strong>{label}</strong><span>{failed?'Stopped':waiting?'Your input needed':indeterminate?'Processing…':`${percent}%${percent<100?' estimated':''}`}</span></div>
  {!failed&&!waiting&&<progress max={100} value={indeterminate?undefined:percent} aria-label="Script creation progress" aria-valuetext={indeterminate?label:`${percent}%${percent<100?' estimated':''}. ${label}`}/>}
  <small>{failed?'Your source is kept where available. Retry when you’re ready.':waiting?'Your video is ready. Check the ending below, then select Use this cut & create script.':percent===100?'Ready for your review.':indeterminate?'Working on the current stage. A reliable percentage is not available yet.':'You can stay here. We’ll open your script when it’s ready.'}</small>
 </div>;
}
