import {useEffect,useState} from 'react';
import {z} from 'zod';
import {avatarRepository} from '../lib/avatar-repository';
import {watchRender} from '../lib/watch-render';
import {PresenterResult} from './PresenterResult';
const jobSchema=z.object({id:z.string(),status:z.enum(['submitting','pending','processing','completed','failed','uncertain']),video_url:z.string().nullable(),message:z.string().nullable(),output_format:z.string().nullable(),download_url:z.string().nullable().optional(),preview_url:z.string().nullable().optional(),preview_download_url:z.string().nullable().optional()});
const preparedSchema=z.object({revision:z.string(),estimated_seconds:z.number(),estimate:z.object({engine:z.string(),estimated_cost_usd:z.number().nullable(),basis:z.string()}).optional(),snapshot:z.object({avatar_name:z.string(),voice_name:z.string().nullable(),script:z.string(),aspect_ratio:z.string()}),job:jobSchema.nullable()});
type Prepared=z.infer<typeof preparedSchema>;
type Job=z.infer<typeof jobSchema>;
export function PresenterTest({scriptId,revision,disabled,onChangePresenter,onEditLayout,compact=false}:{scriptId:string;revision:string;disabled:boolean;onChangePresenter?:()=>void;onEditLayout?:()=>void;compact?:boolean}){
 const [prepared,setPrepared]=useState<Prepared|null>(null);
 const [job,setJob]=useState<Job|null>(null);
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [checking,setChecking]=useState(false);
 const jobId=job?.id;
 const activeJob=Boolean(job&&['pending','processing','submitting'].includes(job.status));
 const completedJob=job?.status==='completed';
 useEffect(()=>{
  if(!jobId||!completedJob||disabled)return;
  let live=true;
  const renew=async()=>{
   try{const next=jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId}));if(live){setJob(next);setError('');}}
   catch(e){if(live)setError(e instanceof Error?e.message:'Could not renew video links. Use Refresh video links.');}
  };
  void renew();
  const timer=setInterval(()=>void renew(),45*60*1000);
  return()=>{live=false;clearInterval(timer);};
 },[jobId,completedJob,disabled]);
 useEffect(()=>{
  if(!jobId||!activeJob||disabled)return;
  let live=true;
  const stop=watchRender(async()=>{
   setChecking(true);
   try{return jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId}));}
   finally{if(live)setChecking(false);}
  },value=>{setJob(value);setError('');},e=>setError(e instanceof Error?e.message:'Status check failed. Use Refresh test status to retry.'));
  return()=>{live=false;stop();};
 },[jobId,activeJob,disabled]);
 useEffect(()=>{setPrepared(null);setJob(null);setConsent(false);setError('');},[scriptId,revision]);
 async function prepare(){setBusy(true);setError('');try{const data=preparedSchema.parse(await avatarRepository.renderTest({action:'prepare_test',script_id:scriptId}));setPrepared(data);setJob(data.job);setConsent(false);}catch(e){setError(e instanceof Error?e.message:'Could not prepare test.');}finally{setBusy(false);}}
 async function start(){if(!prepared||!consent||busy)return;setBusy(true);setError('');try{setJob(jobSchema.parse(await avatarRepository.renderTest({action:'start_test',script_id:scriptId,revision:prepared.revision,paid_consent:true})));}catch(e){setError(e instanceof Error?e.message:'Could not submit.');setPrepared(null);setConsent(false);}finally{setBusy(false);}}
 async function refresh(){if(!job||busy||checking)return;setBusy(true);setError('');try{setJob(jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:job.id})));}catch(e){setError(e instanceof Error?e.message:'Could not refresh.');}finally{setBusy(false);}}
 if(compact&&!prepared)return <div className="short-test-action"><button type="button" className="button secondary" disabled={disabled||busy} onClick={()=>void prepare()}>{busy?'Preparing…':'Try a short video'}</button><small>Review first · no charge yet</small>{error&&<p role="alert">{error}</p>}</div>;
 return <section className={compact?'short-test-panel':'script-direction'} aria-label="Short video test"><span className="eyebrow">QUICK TEST</span><h2>{job?.status==='completed'?'Your test video is ready.':'Try a short video.'}</h2>
 {onEditLayout&&<button type="button" className="button" disabled={busy} onClick={onEditLayout}>Edit video layout</button>}
 {disabled?<p>Save your latest video plan to prepare a test.</p>:!prepared?<><p>A short voice and background check before the full video.</p><button className="button" disabled={busy} onClick={()=>void prepare()}>{busy?'Preparing…':'Review test — no charge yet'}</button></>:<><p><strong>{prepared.snapshot.avatar_name}</strong> · {prepared.snapshot.voice_name}</p>
 {prepared.estimate&&<p>{prepared.estimate.engine.replace('avatar_','Avatar ').toUpperCase()} · {prepared.estimate.estimated_cost_usd===null?'Check HeyGen pricing':`Estimated test cost: ${prepared.estimate.estimated_cost_usd.toFixed(2)} USD`} · Reference estimate, not a guaranteed charge.</p>}
 {!job?<><blockquote>{prepared.snapshot.script}</blockquote><p>First 30 words · ~{prepared.estimated_seconds} seconds · transparent WebM requested.</p><p>This is paid HeyGen API usage. Actual charges depend on your account and output duration. Check your API balance first.</p><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> I authorize one paid test render.</label><button className="button" disabled={busy||!consent} onClick={()=>void start()}>{busy?'Submitting once…':'Generate paid test'}</button></>:<><p role="status">{job.status==='completed'?'Ready to review':`Test status: ${job.status}`}</p>{job.message&&<p>{job.message}</p>}{job.status==='completed'&&job.video_url&&<PresenterResult id={job.id} url={job.video_url} downloadUrl={job.download_url} previewUrl={job.preview_url} previewDownloadUrl={job.preview_download_url} onRefresh={()=>void refresh()} onChangePresenter={onChangePresenter}/>}<details><summary>Test details & status</summary><blockquote>{prepared.snapshot.script}</blockquote><p>{prepared.snapshot.aspect_ratio} · 720p · WebM · test clip only, without captions or cutaways.</p>{!['failed','uncertain'].includes(job.status)&&<button type="button" disabled={busy||checking} onClick={()=>void refresh()}>{busy||checking?'Checking…':'Refresh test status'}</button>}<p>Pending tests refresh automatically. An uncertain submission needs checking in HeyGen before retrying.</p></details></>}
 </>}{error&&<p role="alert">{error}</p>}</section>;
}
