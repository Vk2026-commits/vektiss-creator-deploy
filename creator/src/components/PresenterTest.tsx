import {useEffect,useState,useRef} from 'react';
import {z} from 'zod';
import {avatarRepository} from '../lib/avatar-repository';
import {watchRender} from '../lib/watch-render';
import {PresenterResult} from './PresenterResult';
import {notifyAvatarLibrary} from '../lib/avatar-library-events';
const jobSchema=z.object({id:z.string(),status:z.enum(['submitting','pending','processing','completed','failed','uncertain']),video_url:z.string().nullable(),message:z.string().nullable(),output_format:z.string().nullable(),download_url:z.string().nullable().optional(),preview_url:z.string().nullable().optional(),preview_download_url:z.string().nullable().optional()});
const preparedSchema=z.object({revision:z.string(),estimated_seconds:z.number(),estimate:z.object({engine:z.string(),estimated_cost_usd:z.number().nullable(),basis:z.string()}).optional(),snapshot:z.object({avatar_name:z.string(),voice_name:z.string().nullable(),script:z.string(),aspect_ratio:z.string()}),job:jobSchema.nullable()});
type Prepared=z.infer<typeof preparedSchema>;
type Job=z.infer<typeof jobSchema>;
export function PresenterTest({scriptId,revision,disabled,onChangePresenter,onEditLayout,compact=false,required=false,onVerified}:{scriptId:string;revision:string;disabled:boolean;onChangePresenter?:()=>void;onEditLayout?:()=>void;compact?:boolean;required?:boolean;onVerified?:()=>void}){
 const [prepared,setPrepared]=useState<Prepared|null>(null);
 const [job,setJob]=useState<Job|null>(null);
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [checking,setChecking]=useState(false);
 const [verified,setVerified]=useState(false);
 const [visualApproved,setVisualApproved]=useState(false);
 const [backgroundRejected,setBackgroundRejected]=useState(false);
 const verifying=useRef(false);
 const submitting=useRef(false);
 const lifecycle=useRef(0);
 const recovered=useRef('');
 useEffect(()=>{lifecycle.current++;return()=>{lifecycle.current++;};},[scriptId,revision]);
 const jobId=job?.id;
 const activeJob=Boolean(job&&['pending','processing','submitting'].includes(job.status));
 const completedJob=job?.status==='completed';
 useEffect(()=>{
  if(!jobId||!completedJob)return;
  let live=true;
  const renew=async()=>{
   try{const next=jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId}));if(live){setJob(next);setError('');}}
   catch(e){if(live)setError(e instanceof Error?e.message:'Could not renew video links. Use Refresh video links.');}
  };
  void renew();
  const timer=setInterval(()=>void renew(),45*60*1000);
  return()=>{live=false;clearInterval(timer);};
 },[jobId,completedJob]);
 useEffect(()=>{
  if(!jobId||!activeJob)return;
  let live=true;
  const stop=watchRender(async()=>{
   setChecking(true);
   try{return jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:jobId}));}
   finally{if(live)setChecking(false);}
  },value=>{setJob(value);setError('');},e=>setError(e instanceof Error?e.message:'Status check failed. Use Refresh test status to retry.'));
  return()=>{live=false;stop();};
 },[jobId,activeJob]);
 useEffect(()=>{setPrepared(null);setJob(null);setConsent(false);setError('');setVerified(false);setBusy(false);setChecking(false);},[scriptId,revision]);
 useEffect(()=>{setVisualApproved(false);setBackgroundRejected(false);setVerified(false);},[job?.id,scriptId,revision]);
	 async function verify(){if(!job||job.status!=='completed'||!visualApproved||backgroundRejected||verifying.current)return;const current=lifecycle.current;verifying.current=true;setBusy(true);setError('');try{await avatarRepository.renderTest({action:'verify_avatar_test',test_id:job.id,visual_approved:true});if(current!==lifecycle.current)return;setVerified(true);notifyAvatarLibrary();onVerified?.();}catch(e){if(current===lifecycle.current)setError(e instanceof Error?e.message:'Could not save this approval. Retry; no new paid render is needed.');}finally{verifying.current=false;if(current===lifecycle.current)setBusy(false);}}
 async function prepare(){if(busy||disabled)return;const current=lifecycle.current;setBusy(true);setError('');try{const data=preparedSchema.parse(await avatarRepository.renderTest({action:'prepare_test',script_id:scriptId}));if(current!==lifecycle.current)return;setPrepared(data);setJob(data.job);setConsent(false);}catch(e){if(current===lifecycle.current)setError(e instanceof Error?e.message:'Could not prepare test.');}finally{if(current===lifecycle.current)setBusy(false);}}
 async function start(){if(!prepared||!consent||busy||disabled||submitting.current)return;const current=lifecycle.current;submitting.current=true;setBusy(true);setError('');try{const next=jobSchema.parse(await avatarRepository.renderTest({action:'start_test',script_id:scriptId,revision:prepared.revision,paid_consent:true,...(job?.status==='failed'?{retry_of:job.id}:{})}));if(current===lifecycle.current)setJob(next);}catch(e){if(current===lifecycle.current){setError(e instanceof Error?e.message:'Could not submit.');setPrepared(null);}}finally{submitting.current=false;if(current===lifecycle.current){setConsent(false);setBusy(false);}}}
 async function refresh(){if(!job||busy||checking)return;const current=lifecycle.current;setBusy(true);setError('');try{const next=jobSchema.parse(await avatarRepository.renderTest({action:'test_status',test_id:job.id}));if(current===lifecycle.current)setJob(next);}catch(e){if(current===lifecycle.current)setError(e instanceof Error?e.message:'Could not refresh.');}finally{if(current===lifecycle.current)setBusy(false);}}
 useEffect(()=>{const key=`${scriptId}:${revision}`;if(required&&!disabled&&!busy&&recovered.current!==key){recovered.current=key;void prepare();}},[required,disabled,busy,scriptId,revision]);
 if(compact&&!prepared)return <div className="short-test-action"><button type="button" className="button secondary" disabled={disabled||busy} onClick={()=>void prepare()}>{busy?'Preparing…':required?'Set up this avatar':'Try a short video'}</button><small>{required?'One approved short test checks the background before a full video.':'Review first · no charge yet'}</small>{error&&<p role="alert">{error}</p>}</div>;
 return <section className={compact?'short-test-panel':'script-direction'} aria-label="Short video test"><span className="eyebrow">QUICK TEST</span><h2>{job?.status==='completed'?'Your test video is ready.':'Try a short video.'}</h2>
 {onEditLayout&&<button type="button" className="button" disabled={busy} onClick={onEditLayout}>Edit video layout</button>}
 {!prepared?<><p>A short voice and background check before the full video.</p><button className="button" disabled={busy||disabled} onClick={()=>void prepare()}>{busy?'Preparing…':disabled?'Saving your choices…':'Review test — no charge yet'}</button></>:<><p><strong>{prepared.snapshot.avatar_name}</strong> · {prepared.snapshot.voice_name}</p>
 {prepared.estimate&&!job&&<p>{prepared.estimate.engine.replace('avatar_','Avatar ').toUpperCase()} · {prepared.estimate.estimated_cost_usd===null?'Price unavailable — check HeyGen pricing':`Estimated $${prepared.estimate.estimated_cost_usd.toFixed(2)}`} · Actual charge may vary.</p>}
 {!job?<><p>About {prepared.estimated_seconds} seconds.</p><label><input type="checkbox" checked={consent} disabled={busy||disabled} onChange={e=>setConsent(e.target.checked)}/> I approve one paid HeyGen test.</label><button className="button" disabled={busy||disabled||!consent} onClick={()=>void start()}>{busy?'Submitting once…':'Create paid test'}</button><details><summary>Test script</summary><blockquote>{prepared.snapshot.script}</blockquote></details></>:<>{activeJob&&<div className="test-processing" role="status" aria-live="polite"><strong>Creating your test video…</strong><progress aria-label="Creating test video"/><span>You can stay here. It will appear when ready.</span></div>}{job.message&&<p role="status">{job.message}</p>}{job.status==='completed'&&job.video_url&&<PresenterResult key={job.id} id={job.id} url={job.video_url} downloadUrl={job.download_url} previewUrl={job.preview_url} previewDownloadUrl={job.preview_download_url} onRefresh={()=>void refresh()}/>}<details><summary>Test details & status</summary><blockquote>{prepared.snapshot.script}</blockquote><p>{prepared.snapshot.aspect_ratio} · {job.status}</p><button type="button" disabled={busy||checking} onClick={()=>void refresh()}>{busy||checking?'Checking…':'Refresh test status'}</button>{job.status==='uncertain'&&<p>Check this submission in HeyGen before retrying to avoid a duplicate charge.</p>}</details></>}
	 </>}{job?.status==='failed'&&<div><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> I approve one new paid test.</label><button type="button" className="button" disabled={busy||!consent||disabled} onClick={()=>void start()}>Retry paid test</button></div>}{completedJob&&<div className="avatar-check-result">{verified?<p role="status">Approved. You can now review your full video.</p>:<><h3>Watch, then approve</h3><label><input type="checkbox" checked={visualApproved} disabled={busy||disabled} onChange={e=>{setVisualApproved(e.target.checked);setBackgroundRejected(false);}}/> Only the person is visible—no couch or unwanted background.</label><div className="presenter-result-actions"><button type="button" className="button" disabled={busy||disabled||!visualApproved||backgroundRejected} onClick={()=>void verify()}>{busy?'Saving approval…':'Looks good — continue'}</button>{onChangePresenter&&<button type="button" className="button secondary" disabled={busy} onClick={onChangePresenter}>Change avatar</button>}</div></>}</div>}{error&&<p role="alert">{error}</p>}</section>;
}
