import './script-progress.css';
export type DraftProgress={percent:number;label:string;failed?:boolean};
export function ScriptProgress({progress}:{progress:DraftProgress}){
 const {percent,label,failed}=progress;
 return <div className={`draft-progress${percent<100&&!failed?' draft-progress-active':''}`} role="status">
  <div><strong>{label}</strong><span>{percent}%{percent<100?' estimated':''}</span></div>
  <progress max={100} value={percent} aria-label="Script creation progress" aria-valuetext={`${percent}%${percent<100?' estimated':''}. ${label}`}/>
  <small>{failed?'Your source is kept where available. Retry when you’re ready.':percent===100?'Ready for your review.':'You can stay here. We’ll open your script when it’s ready.'}</small>
 </div>;
}
