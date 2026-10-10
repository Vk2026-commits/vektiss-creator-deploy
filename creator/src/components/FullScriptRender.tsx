import {VideoBackground} from './VideoBackground';
import {GraphicPreview} from './GraphicPreview';
import {RenderProgress} from './RenderProgress';
import {useEffect,useState,useRef} from 'react';
import {z} from 'zod';
import {avatarRepository} from '../lib/avatar-repository';
import {watchRender} from '../lib/watch-render';
import {FinishedVideo} from './FinishedVideo';
import {PresenterTest} from './PresenterTest';
import {sameRenderValue,type VideoPlan} from '../domain/video-plan';
import {onResume} from '../lib/resume-events';
const jobSchema=z.object({id:z.string(),status:z.string(),video_url:z.string().nullable(),message:z.string().nullable()});
const reviewSchema=z.object({revision:z.string(),estimated_seconds:z.number(),verification:z.object({test_id:z.string(),crop:z.object({width:z.number().positive(),height:z.number().positive()})}).nullable().optional(),estimate:z.object({engine:z.string(),estimated_cost_usd:z.number().nullable(),basis:z.string()}).optional(),snapshot:z.object({script:z.string(),avatar_name:z.string(),voice_name:z.string().nullable().optional()}),job:jobSchema.nullable()});
export function FullScriptRender({scriptId,revision,disabled,plan,onEditLayout,sourceKind='article',sourceUrl='',onPlanChange}:{scriptId:string;revision:string;disabled:boolean;plan:VideoPlan;onEditLayout:()=>void;sourceKind?:'article'|'video'|'graphic';sourceUrl?:string;onPlanChange:(p:VideoPlan)=>void}){
 const [videoReady,setVideoReady]=useState(false);
 const [verificationEpoch,setVerificationEpoch]=useState(0);
 const [review,setReview]=useState<z.infer<typeof reviewSchema>|null>(null);
 const [job,setJob]=useState<z.infer<typeof jobSchema>|null>(null);
 const submitting=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{if(disabled)return;let live=true,reading=false;setReview(null);setJob(null);
  const read=()=>{if(reading||submitting.current)return;reading=true;setBusy(true);
   void avatarRepository.renderTest({action:'prepare_test',script_id:scriptId,scope:'full'}).then(value=>{if(live){const next=reviewSchema.parse(value);setReview(next);setJob(next.job);setError('');
    if(next.verification&&plan.avatar_id&&(!next.job||next.job.status==='failed')){const avatar_preview={avatar_id:plan.avatar_id,engine:plan.avatar_engine??'avatar_iv',format:plan.format,aspect:next.verification.crop.width/next.verification.crop.height};if(!sameRenderValue(plan.avatar_preview,avatar_preview))onPlanChange({...plan,avatar_preview});}
   }}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load full-script render.');}).finally(()=>{reading=false;if(live)setBusy(false);});
  };
  read();const off=onResume(read);return()=>{live=false;off();};
 },[scriptId,revision,disabled,verificationEpoch]);
 const jobId=job?.id;const active=!!job&&['submitting','pending','processing'].includes(job.status);
 useEffect(()=>{if(!jobId||!active)return;return watchRender(async()=>jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId})),value=>{setJob(value);setError('');},()=>setError('Reconnecting to your saved render… No new render will be submitted.'));},[jobId,active]);
 async function start(retry=false){if(!review?.verification||submitting.current||(job&&!(retry&&job.status==='failed'))||busy||disabled||!backgroundReady)return;submitting.current=true;setBusy(true);setError('');try{setJob(jobSchema.parse(await avatarRepository.renderTest({action:'start_test',script_id:scriptId,scope:'full',revision:review.revision,paid_consent:true,...(retry&&job?{retry_of:job.id}:{})})));}catch(e){setError(e instanceof Error?e.message:'Submission failed. Check HeyGen before retrying.');}finally{submitting.current=false;setBusy(false);}}
 async function refresh(){if(!jobId||busy)return;setBusy(true);try{setJob(jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId})));setError('');}catch(e){setError(String(e));}finally{setBusy(false);}}
	 const backgroundReady=sourceKind==='video'?videoReady:sourceKind==='graphic'?Boolean(plan.article_capture):true;
 return <section className="script-direction render-workspace" aria-label="Full-script presenter">
  {disabled?<p>Saving your selection…</p>:busy&&!review?<RenderProgress value={0} indeterminate label="Opening your video…"/>:null}
	  {job?.status==='completed'?<FinishedVideo sourceKind={sourceKind} jobId={job.id} scriptId={scriptId} plan={plan} rawVideoUrl={job.video_url??undefined}/>:review&&sourceKind==='video'&&<VideoBackground plan={plan} sourceUrl={sourceUrl} onChange={onPlanChange} onReady={setVideoReady}/>}
  {job?.status!=='completed'&&sourceKind==='graphic'&&plan.article_capture&&<GraphicPreview plan={plan}/>}
  {review&&<>
   {!active&&job?.status!=='completed'&&<div className="render-cost-summary">{review.estimate?.engine.replace('avatar_','Avatar ').toUpperCase()} · {review.estimated_seconds}s of speech<br/>{review.estimate?.estimated_cost_usd!=null?`Estimated avatar cost: $${review.estimate.estimated_cost_usd.toFixed(2)} USD`:'Cost unverified — check HeyGen pricing before confirming.'}<small>HeyGen reference estimate; actual charges may differ.</small></div>}
	   {sourceKind==='article'&&!plan.article_capture&&<p>Creating a presenter-only video. Add a source screenshot in Edit layout only if you want it as the background.</p>}
   {!review.verification&&(!job||job.status==='failed')?<div className="render-confirmation" role="status"><strong>First, check this avatar’s background.</strong><p>Approve a short paid test below. Once verified, this avatar and engine are ready for full videos in this video shape.</p></div>:job?job.status==='failed'?<div role="alert" className="render-failure-card"><strong>Ready to retry</strong>{!/credit|quota|balance/i.test(job.message??'')&&<p>{job.message||'HeyGen could not finish this render.'}</p>}<div className="render-actions"><button type="button" className="button primary" disabled={busy||disabled||!backgroundReady} onClick={()=>void start(true)}>{busy?'Submitting retry…':'Retry with HeyGen →'}</button></div><small>Starts a new paid render. Click once to confirm.</small></div>:active?<RenderProgress value={job.status==='processing'?60:30} label={`Creating avatar · ${job.status}`}/>:job.status!=='completed'&&<p role="alert">Render status needs checking. Use Refresh status below before starting another paid render.</p>:<div className="render-confirmation">
    {busy&&<RenderProgress value={15} label="Submitting to HeyGen"/>}
    <small>Creates one paid HeyGen render with your approved script.</small><div className="render-actions"><button disabled={busy} onClick={onEditLayout}>← Back</button><button className="button" disabled={disabled||busy||!backgroundReady} onClick={()=>void start()}>{busy?'Submitting…':'Confirm & create with HeyGen'}</button></div>
   </div>}
   <div className="short-test-secondary"><PresenterTest compact required={!review.verification} onChangePresenter={onEditLayout} onVerified={()=>setVerificationEpoch(n=>n+1)} key={`${scriptId}:${revision}`} scriptId={scriptId} revision={revision} disabled={disabled||busy||active}/></div>
   <details className="render-more"><summary>Render details</summary><p>{review.snapshot.avatar_name} · {review.snapshot.voice_name??'Default voice'}</p>{job?.message&&!/credit|quota|balance/i.test(job.message)&&<p>{job.message}</p>}{job&&<>{job.video_url&&<a href={job.video_url} target="_blank" rel="noreferrer">Open raw presenter clip</a>}<button disabled={busy} onClick={()=>void refresh()}>Refresh status</button></>}</details>
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
