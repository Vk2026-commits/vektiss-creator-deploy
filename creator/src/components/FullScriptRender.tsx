import {VideoBackground} from './VideoBackground';
import {RenderProgress} from './RenderProgress';
import {useEffect,useState,useRef} from 'react';
import {z} from 'zod';
import {avatarRepository} from '../lib/avatar-repository';
import {watchRender} from '../lib/watch-render';
import {FinishedVideo} from './FinishedVideo';
import type {VideoPlan} from '../domain/video-plan';
const jobSchema=z.object({id:z.string(),status:z.string(),video_url:z.string().nullable(),message:z.string().nullable()});
const reviewSchema=z.object({revision:z.string(),estimated_seconds:z.number(),snapshot:z.object({script:z.string(),avatar_name:z.string(),voice_name:z.string().nullable().optional()}),job:jobSchema.nullable()});
export function FullScriptRender({scriptId,revision,disabled,plan,onEditLayout,sourceKind='article',sourceUrl='',onPlanChange}:{scriptId:string;revision:string;disabled:boolean;plan:VideoPlan;onEditLayout:()=>void;sourceKind?:'article'|'video';sourceUrl?:string;onPlanChange:(p:VideoPlan)=>void}){
 const [videoReady,setVideoReady]=useState(false);
 const [review,setReview]=useState<z.infer<typeof reviewSchema>|null>(null);
 const [job,setJob]=useState<z.infer<typeof jobSchema>|null>(null);
 const submitting=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{if(disabled)return;let live=true;setBusy(true);setReview(null);setJob(null);
  avatarRepository.renderTest({action:'prepare_test',script_id:scriptId,scope:'full'}).then(value=>{if(live){const next=reviewSchema.parse(value);setReview(next);setJob(next.job);setError('');}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load full-script render.');}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};
 },[scriptId,revision,disabled]);
 const jobId=job?.id;const active=!!job&&['submitting','pending','processing'].includes(job.status);
 useEffect(()=>{if(!jobId||!active)return;return watchRender(async()=>jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId})),setJob,e=>setError(String(e)));},[jobId,active]);
 async function start(){if(!review||submitting.current||job||busy||disabled||!backgroundReady)return;submitting.current=true;setBusy(true);setError('');try{setJob(jobSchema.parse(await avatarRepository.renderTest({action:'start_test',script_id:scriptId,scope:'full',revision:review.revision,paid_consent:true})));}catch(e){setError(e instanceof Error?e.message:'Submission failed. Check HeyGen before retrying.');}finally{submitting.current=false;setBusy(false);}}
 async function refresh(){if(!jobId||busy)return;setBusy(true);try{setJob(jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId})));setError('');}catch(e){setError(String(e));}finally{setBusy(false);}}
 const backgroundReady=sourceKind==='video'?videoReady:Boolean(plan.article_capture);
 return <section className="script-direction render-workspace" aria-label="Full-script presenter">
  <div className="render-settings"><span>{review?`${review.snapshot.avatar_name} · ${review.snapshot.voice_name??'Default voice'} · ${review.estimated_seconds}s reaction`:'Loading saved settings…'}</span><button disabled={busy||active} onClick={onEditLayout}>Edit placement / voice</button></div>
  {disabled?<p>Saving your selection…</p>:busy&&!review?<RenderProgress value={10} label="Checking saved renders"/>:null}
  {job?.status==='completed'?<FinishedVideo sourceKind={sourceKind} jobId={job.id} scriptId={scriptId} plan={plan}/>:sourceKind==='video'&&<VideoBackground plan={plan} sourceUrl={sourceUrl} onChange={onPlanChange} onReady={setVideoReady}/>}
  {review&&<>
   {sourceKind==='article'&&!plan.article_capture&&<p>Capture an article in Edit layout before creating your video.</p>}
   {job?job.status!=='completed'&&<RenderProgress value={job.status==='processing'?60:30} label={`Creating avatar · ${job.status}`}/>:<div className="render-confirmation">
    {busy&&<RenderProgress value={15} label="Submitting to HeyGen"/>}
    <small>Creates one paid HeyGen render with your approved script.</small><div className="render-actions"><button disabled={busy} onClick={onEditLayout}>← Back</button><button className="button" disabled={disabled||busy||!backgroundReady} onClick={()=>void start()}>{busy?'Submitting…':'Confirm & create with HeyGen'}</button></div>
   </div>}
   <details className="render-more"><summary>Script & render details</summary><p style={{whiteSpace:'pre-wrap'}}>{review.snapshot.script}</p>{job?.message&&<p>{job.message}</p>}{job&&<>{job.video_url&&<a href={job.video_url} target="_blank" rel="noreferrer">Open raw presenter clip</a>}<button disabled={busy} onClick={()=>void refresh()}>Refresh status</button></>}</details>
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
