import {VideoBackground} from './VideoBackground';
import {checkBackground} from '../lib/check-background';
import {sameAvatarPreview} from '../domain/render-preview-update';
import {GraphicPreview} from './GraphicPreview';
import {RenderProgress} from './RenderProgress';
import {useEffect,useState,useRef} from 'react';
import {z} from 'zod';
import {avatarRepository} from '../lib/avatar-repository';
import {watchRender} from '../lib/watch-render';
import {FinishedVideo} from './FinishedVideo';
import {PresenterTest} from './PresenterTest';
import {renderStateFromJob,videoRenderProgress,type VideoPlan,type VideoRender} from '../domain/video-plan';
import {onResume} from '../lib/resume-events';

const jobSchema=z.object({id:z.string(),status:z.string(),video_url:z.string().nullable(),message:z.string().nullable()});
const reviewSchema=z.object({revision:z.string(),estimated_seconds:z.number(),verification:z.object({test_id:z.string(),crop:z.object({width:z.number().positive(),height:z.number().positive()})}).nullable().optional(),estimate:z.object({engine:z.string(),estimated_cost_usd:z.number().nullable(),basis:z.string()}).optional(),snapshot:z.object({script:z.string(),avatar_name:z.string(),voice_name:z.string().nullable().optional()}),job:jobSchema.nullable()});

type Props={
 scriptId:string;
 revision:string;
 disabled:boolean;
 plan:VideoPlan;
 onEditLayout:()=>void;
 sourceKind?:'article'|'video'|'graphic';
 sourceUrl?:string;
 onPlanChange:(p:VideoPlan)=>void;
 onRenderStateChange?:(render:VideoRender)=>void;
 onViewLibrary?:()=>void;
 onNewVideo?:()=>void;
 reusableJobId?:string;
};

function sameRender(a:VideoRender|undefined,b:VideoRender){return a?.job_id===b.job_id&&a.status===b.status&&a.export_id===b.export_id&&a.message===b.message;}
export function savedExportJob(render:VideoRender|undefined){
 if(render?.status!=='ready'||!render.export_id)return null;
 return {id:render.job_id,status:'completed',video_url:null,message:null};
}

export function FullScriptRender({scriptId,revision,disabled,plan,onEditLayout,sourceKind='article',sourceUrl='',onPlanChange,onRenderStateChange,onViewLibrary,onNewVideo,reusableJobId}:Props){
 const persistedJob=savedExportJob(plan.render);
 const [videoReady,setVideoReady]=useState(false);
 const [assetsReady,setAssetsReady]=useState(false),[assetError,setAssetError]=useState(''),[assetRetry,setAssetRetry]=useState(0);
 const assetKey=JSON.stringify([sourceKind,plan.article_capture?.id,plan.video_background?.id,plan.screenshot_story?.images.map(i=>i.id)]);
 useEffect(()=>{const abort=new AbortController();setAssetsReady(false);setAssetError('');
  void checkBackground(plan,sourceKind,abort.signal).then(()=>{if(!abort.signal.aborted)setAssetsReady(true);}).catch(e=>{if(!abort.signal.aborted)setAssetError(e instanceof Error?e.message:'Could not load the saved background.');});return()=>abort.abort();
 },[assetKey,assetRetry]);
 const [verificationEpoch,setVerificationEpoch]=useState(0);
 const [skipTestRevision,setSkipTestRevision]=useState<string|null>(null);
 useEffect(()=>setSkipTestRevision(null),[scriptId,revision]);
 const [review,setReview]=useState<z.infer<typeof reviewSchema>|null>(null);
 const [job,setJob]=useState<z.infer<typeof jobSchema>|null>(()=>persistedJob);
 const [submitted,setSubmitted]=useState(Boolean(plan.render));
 const submitting=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const backgroundReady=assetsReady&&(sourceKind==='video'?videoReady:sourceKind==='graphic'?Boolean(plan.article_capture):true);
 const tracked=job&&plan.render?.job_id===job.id?plan.render:undefined;
 const active=Boolean(job&&['submitting','pending','processing'].includes(job.status));
 const progress=videoRenderProgress(tracked);
 const track=(next:z.infer<typeof jobSchema>)=>{
  setJob(next);
  const state=renderStateFromJob(next,plan.render?.job_id===next.id?plan.render:undefined);
  if(!sameRender(plan.render,state))onRenderStateChange?.(state);
 };
 useEffect(()=>{
  // The durable export ID is the authority for an already finished video.
  // Do not wait on a provider/catalog status recheck before opening it.
  if(persistedJob){setReview(null);setJob(persistedJob);setError('');return;}
  if(plan.render?.status==='assembling'&&plan.render.job_id===reusableJobId){setReview(null);setJob({id:reusableJobId,status:'completed',video_url:null,message:null});return;}
  if(disabled)return;let live=true,reading=false;setReview(null);setJob(null);
  const read=()=>{if(reading||submitting.current)return;reading=true;setBusy(true);
   void avatarRepository.renderTest({action:'prepare_test',script_id:scriptId,scope:'full'}).then(value=>{if(live){const next=reviewSchema.parse(value);setReview(next);if(next.job)track(next.job);else setJob(null);setError('');
    if(next.verification&&plan.avatar_id&&(!next.job||next.job.status==='failed')){const avatar_preview={avatar_id:plan.avatar_id,engine:plan.avatar_engine??'avatar_iv',format:plan.format,aspect:next.verification.crop.width/next.verification.crop.height};if(!sameAvatarPreview(plan.avatar_preview,avatar_preview))onPlanChange({...plan,avatar_preview});}
   }}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load full-script render.');}).finally(()=>{reading=false;if(live)setBusy(false);});
  };
  read();const off=onResume(read);return()=>{live=false;off();};
 },[scriptId,revision,disabled,verificationEpoch,persistedJob?.id]);
 const jobId=job?.id;
 useEffect(()=>{if(!jobId||!active)return;return watchRender(async()=>jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId})),value=>{track(value);setError('');},()=>setError('Reconnecting to your saved render… No new render will be submitted.'));},[jobId,active]);
 async function start(retry=false){
  if(!review||(!review.verification&&skipTestRevision!==review.revision)||submitting.current||(job&&!(retry&&job.status==='failed'))||busy||disabled||!backgroundReady)return;
  submitting.current=true;setBusy(true);setError('');
  try{const next=jobSchema.parse(await avatarRepository.renderTest({action:'start_test',script_id:scriptId,scope:'full',revision:review.revision,paid_consent:true,...(!review.verification?{unverified_background_acknowledged:true}:{}),...(retry&&job?{retry_of:job.id}:{})}));setSubmitted(true);track(next);}
  catch(e){setError(e instanceof Error?e.message:'Submission failed. Check HeyGen before retrying.');}
  finally{submitting.current=false;setBusy(false);}
 }
 async function refresh(){if(!jobId||busy)return;setBusy(true);try{track(jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId})));setError('');}catch(e){setError(String(e));}finally{setBusy(false);}}
 const trackedJob=submitted||Boolean(tracked);
 const showSubmitted=active&&trackedJob;
 const waitingForExport=job?.status==='completed'&&trackedJob&&tracked?.status!=='ready';
 const showFinished=job?.status==='completed'&&!waitingForExport;
 return <section className="script-direction render-workspace" aria-label="Full-script presenter">
  {assetError&&<p role="alert">{assetError} <button type="button" onClick={()=>setAssetRetry(n=>n+1)}>Retry background</button></p>}
  {reusableJobId&&!plan.render&&<div className="render-confirmation"><p>Your speech settings are unchanged. Update only the layout using the existing presenter footage.</p><button type="button" className="button" disabled={disabled||busy||!backgroundReady} onClick={()=>{const now=new Date().toISOString();onRenderStateChange?.({job_id:reusableJobId,status:'assembling',submitted_at:now,updated_at:now});setSubmitted(true);setJob({id:reusableJobId,status:'completed',video_url:null,message:null});}}>Update layout · no new HeyGen render</button></div>}
  {!review&&waitingForExport&&<p role="status">Finishing this version with your existing presenter footage. Your original download is unchanged.</p>}
  {review&&!plan.render&&<p>{review.snapshot.avatar_name} · {review.snapshot.voice_name??'Default voice'} · {plan.voice_engine??'Auto'} · {(plan.voice_speed??1).toFixed(2)}× speed</p>}
  {disabled?<p>Saving your selection…</p>:busy&&!review?<RenderProgress value={0} indeterminate label="Opening your video…"/>:null}
  {showFinished?<FinishedVideo sourceKind={sourceKind} jobId={job!.id} scriptId={scriptId} plan={plan} rawVideoUrl={job?.video_url??undefined}/>:review&&sourceKind==='video'&&<VideoBackground plan={plan} sourceUrl={sourceUrl} onChange={onPlanChange} onReady={setVideoReady}/>}
  {job?.status!=='completed'&&sourceKind==='graphic'&&plan.article_capture&&<GraphicPreview plan={plan}/>}
  {review&&<>
   {!active&&job?.status!=='completed'&&<div className="render-cost-summary">{review.estimate?.engine.replace('avatar_','Avatar ').toUpperCase()} · {review.estimated_seconds}s of speech<br/>{review.estimate?.estimated_cost_usd!=null?`Estimated avatar cost: $${review.estimate.estimated_cost_usd.toFixed(2)} USD`:'Cost unverified — check HeyGen pricing before confirming.'}<small>HeyGen reference estimate; actual charges may differ.</small></div>}
   {sourceKind==='article'&&!plan.article_capture&&<p>Creating a presenter-only video. Add a source screenshot in Edit layout only if you want it as the background.</p>}
   {!review.verification&&skipTestRevision!==review.revision&&(!job||job.status==='failed')?<div className="render-confirmation" role="status"><strong>Optional: test this avatar first.</strong><p>This avatar’s background has not been verified for these settings. You can run a short paid test below, or skip it and create the full video. The finished framing or background may differ from the placement preview.</p><button type="button" disabled={busy||disabled} onClick={()=>setSkipTestRevision(review.revision)}>Skip paid test — I understand the risk</button><small>Skipping does not start a render or charge you. You will confirm the full video separately.</small></div>:job?.status==='failed'?<div role="alert" className="render-failure-card"><strong>Ready to retry</strong>{!/credit|quota|balance/i.test(job.message??'')&&<p>{job.message||'HeyGen could not finish this render.'}</p>}<div className="render-actions"><button type="button" className="button primary" disabled={busy||disabled||!backgroundReady} onClick={()=>void start(true)}>{busy?'Submitting retry…':'Retry with HeyGen →'}</button></div><small>Starts a new paid render. Click once to confirm.</small></div>:showSubmitted?<section className="render-submitted" aria-live="polite"><span className="eyebrow">VIDEO SUBMITTED</span><h2>Your video is being created.</h2><p>It is saved in My videos. You can leave this screen or start another video now. We’ll email you when the finished MP4 is ready.</p>{progress&&<RenderProgress value={progress.percent} label={`${progress.label} · ${progress.percent}% estimated`}/>}<div className="render-actions"><button type="button" onClick={onViewLibrary}>Close & view My videos</button><button type="button" className="button" onClick={onNewVideo}>Start another video</button></div></section>:waitingForExport?<section className="render-submitted" aria-live="polite"><span className="eyebrow">FINALIZING VIDEO</span><h2>Your presenter is ready.</h2><p>Finishing your MP4 now. It stays in My videos and we’ll email you as soon as it is ready.</p>{progress&&<RenderProgress value={progress.percent} label={`${progress.label} · ${progress.percent}% estimated`}/>}<div className="render-actions"><button type="button" onClick={onViewLibrary}>View My videos</button><button type="button" className="button" onClick={onNewVideo}>Start another video</button></div></section>:job&&job.status!=='completed'?<p role="alert">Render status needs checking. Use Refresh status below before starting another paid render.</p>:<div className="render-confirmation">{busy&&<RenderProgress value={15} label="Submitting to HeyGen"/>}<small>Creates one paid HeyGen render with your approved script.</small><div className="render-actions"><button disabled={busy} onClick={onEditLayout}>← Back</button><button className="button" disabled={disabled||busy||!backgroundReady} onClick={()=>void start()}>{busy?'Submitting…':'Confirm & create with HeyGen'}</button></div></div>}
   {!showSubmitted&&!waitingForExport&&!showFinished&&<div className="short-test-secondary"><PresenterTest compact required={false} onChangePresenter={onEditLayout} onVerified={()=>setVerificationEpoch(n=>n+1)} key={`${scriptId}:${revision}`} scriptId={scriptId} revision={revision} disabled={disabled||busy||active}/></div>}
   <details className="render-more"><summary>Render details</summary><p>{review.snapshot.avatar_name} · {review.snapshot.voice_name??'Default voice'}</p>{job?.message&&!/credit|quota|balance/i.test(job.message)&&<p>{job.message}</p>}{job&&<>{job.video_url&&<a href={job.video_url} target="_blank" rel="noreferrer">Open raw presenter clip</a>}<button disabled={busy} onClick={()=>void refresh()}>Refresh status</button></>}</details>
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
