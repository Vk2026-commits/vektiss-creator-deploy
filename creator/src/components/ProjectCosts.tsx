import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {usageSummary,type ProcessingUsage} from '../domain/project-cost';
import './project-costs.css';
type AI={id:string;project_id:string|null;model:string;action:string;status:string;estimated_cost_usd:number|null;pricing_version:string|null};
type Video={id:string;title:string;brief:{cost_project_id?:string}};
type Render={id:string;script_id:string;status:string;provider_video_id:string|null;snapshot:{scope?:string;voice_engine?:string}};
type Entry={id:string;project_id:string;kind:'heygen'|'support';render_id:string|null;quantity:number;unit_rate_usd:number;note:string};
type Data={videos:Video[];ai:AI[];jobs:ProcessingUsage[];renders:Render[];entries:Entry[]};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:4}).format(n);
async function rows<T,>(table:string,columns:string):Promise<T[]>{
 const all:T[]=[];
 for(let start=0;;start+=500){const {data,error}=await supabase!.from(table).select(columns).order('id').range(start,start+499);if(error)throw error;all.push(...data as T[]);if(data.length<500)return all;}
}
export function ProjectCosts({preview=false}:{preview?:boolean}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[project,setProject]=useState('');
 const [kind,setKind]=useState<'heygen'|'support'>('heygen'),[render,setRender]=useState(''),[quantity,setQuantity]=useState(''),[rate,setRate]=useState(''),[note,setNote]=useState('');
 const saving=useRef(false),pendingEntry=useRef<{fingerprint:string;id:string}|null>(null);
 async function load(){
  setBusy(true);setError('');
  try{
   if(!preview){const access=await supabase!.rpc('creator_is_cost_admin');if(access.error||access.data!==true)throw Error('ADMIN_REQUIRED');}
   if(preview){setData({videos:[{id:'demo',title:'Sample project — demonstration only',brief:{}}],ai:[{id:'demo-ai',project_id:'demo',model:'gpt-4o-mini',action:'generate',status:'complete',estimated_cost_usd:.012,pricing_version:'Demo rates'}],jobs:[{id:'demo-job',project_id:'demo',operation:'full-compose',status:'done',elapsed_ms:12000,retained_bytes:20000000,upload_bytes:10000000,assets:[{key:'demo.mp4',bytes:20000000}],started_at:'2026-10-04'}],renders:[{id:'demo-render',script_id:'demo',status:'completed',provider_video_id:null,snapshot:{scope:'full'}}],entries:[]});return;}
   const [videos,ai,jobs,renders,entries]=await Promise.all([
    rows<Video>('creator_scripts','id,title,brief'),rows<AI>('creator_ai_generations','id,project_id,model,action,status,estimated_cost_usd,pricing_version'),
    rows<ProcessingUsage>('creator_processing_usage','*'),rows<Render>('creator_presenter_tests','id,script_id,status,provider_video_id,snapshot'),rows<Entry>('creator_cost_entries','*')]);
   setData({videos,ai,jobs,renders,entries});
  }catch{setData(null);setError('Administrator access is required. If you are an administrator, refresh to retry.');}finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 const keys=data?[...new Set([...data.videos.map(v=>v.brief.cost_project_id??v.id),...data.ai.map(a=>a.project_id),...data.jobs.map(j=>j.project_id)].filter((v):v is string=>!!v))]:[];
 const selected=project||keys[0]||'';
 const video=data?.videos.find(v=>(v.brief.cost_project_id??v.id)===selected);
 const renders=data?.renders.filter(r=>data.videos.some(v=>v.id===r.script_id&&(v.brief.cost_project_id??v.id)===selected))??[];
 const jobs=data?.jobs.filter(j=>j.project_id===selected)??[],ai=data?.ai.filter(a=>a.project_id===selected)??[],entries=data?.entries.filter(e=>e.project_id===selected)??[];
 const totals=usageSummary(jobs);
 const aiCost=ai.reduce((n,a)=>n+Number(a.estimated_cost_usd??0),0);
 const manualCost=entries.reduce((n,e)=>n+Number(e.quantity)*Number(e.unit_rate_usd),0);
 const missingAI=ai.filter(a=>a.estimated_cost_usd===null).length;
 const missingCredits=renders.filter(r=>!entries.some(e=>e.render_id===r.id)).length;
 const unused=data?data.ai.filter(a=>!a.project_id).length+data.jobs.filter(j=>!j.project_id).length:0;
 async function record(event:React.FormEvent){
  event.preventDefault();if(busy||saving.current||!selected)return;
  const q=Number(quantity),r=Number(rate);
  if(!quantity.trim()||!rate.trim()||!Number.isFinite(q)||!Number.isFinite(r)||q<0||r<0||q>1000000||r>100000){setError('Enter valid non-negative usage and rate.');return;}
  if(kind==='heygen'&&!renders.some(v=>v.id===render)){setError('Choose the matching HeyGen render.');return;}
  saving.current=true;setBusy(true);setError('');
  try{
   const session=await supabase!.auth.getUser();if(!session.data.user)throw Error('AUTH');
   const fingerprint=JSON.stringify([selected,kind,render,q,r,note]);
   if(pendingEntry.current?.fingerprint!==fingerprint)pendingEntry.current={fingerprint,id:crypto.randomUUID()};
   const {error}=await supabase!.from('creator_cost_entries').insert({id:pendingEntry.current.id,user_id:session.data.user.id,project_id:selected,kind,render_id:kind==='heygen'?render:null,quantity:q,unit_rate_usd:kind==='support'?r/60:r,note});
   if(error)throw error;pendingEntry.current=null;setQuantity('');setNote('');await load();
  }catch{setError('Entry could not be saved. Refresh before retrying. A render can have only one credit entry.');}finally{saving.current=false;setBusy(false);}
 }
 return <section className="project-costs" aria-labelledby="cost-heading">
  <header><h1 id="cost-heading">Project costs</h1><button onClick={()=>void load()} disabled={busy}>Refresh</button></header>
  <p>Usage and partial cost totals for your account. Not an invoice or a fully loaded cost.</p>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Loading or saving cost records…</p>}
  {unused>0&&<p>{unused} legacy/unattributed records are excluded. They are not silently assigned to a project.</p>}
  <label>Video project<select value={selected} onChange={e=>{setProject(e.target.value);setRender('');}}><option value="" disabled>Select a project</option>{keys.map(id=><option key={id} value={id}>{data?.videos.find(v=>(v.brief.cost_project_id??v.id)===id)?.title??`Unfinished project ${id.slice(0,8)}`}</option>)}</select></label>
  {!selected?<p>No tracked projects yet. New source processing will appear here, including unsuccessful attempts.</p>:<>
   <h2>{video?.title??'Unfinished project'}</h2><small>Project {selected}</small>
   <dl className="cost-metrics">
    <div><dt>Known cost subtotal</dt><dd>{money(aiCost+manualCost)}</dd></div>
    <div><dt>OpenAI · calculated</dt><dd>{money(aiCost)}</dd></div>
    <div><dt>Bunny job wall time</dt><dd>{totals.seconds.toFixed(1)} sec</dd></div>
    <div><dt>Recorded retained media</dt><dd>{(totals.bytes/1024**2).toFixed(2)} MiB</dd></div>
    <div><dt>Retries / processing failures</dt><dd>{totals.retries} / {totals.failures}</dd></div>
    <div><dt>Failed / uncertain avatar renders</dt><dd>{renders.filter(r=>r.status==='failed').length} / {renders.filter(r=>r.status==='uncertain').length}</dd></div>
    <div><dt>HeyGen credits · manually reported</dt><dd>{entries.filter(e=>e.kind==='heygen').reduce((n,e)=>n+Number(e.quantity),0)}{missingCredits>0?' + unknown':''}</dd></div>
    <div><dt>Support · logged minutes</dt><dd>{entries.some(e=>e.kind==='support')?entries.filter(e=>e.kind==='support').reduce((n,e)=>n+Number(e.quantity),0):'Not logged'}</dd></div>
   </dl>
   <p>{missingAI} AI calls with unknown cost; {missingCredits} renders without reported credits. {ai.filter(a=>a.status==='error').length} failed AI operations. {jobs.filter(j=>j.status==='running').length} jobs pending completion.</p>
   <p>Bunny wall time includes waiting for providers, not billed CPU time. Storage is a last-observed retained-file snapshot, not byte-month billing. Transfer, idle hosting, Vercel, Supabase and other shared costs are not included. Missing values are not zero-cost work.</p>
   <details><summary>Attempts and evidence</summary>
    <ul>{ai.map(a=><li key={a.id}>OpenAI · {a.model} · {a.status} · {a.estimated_cost_usd===null?'Cost unknown':money(Number(a.estimated_cost_usd))} · {a.pricing_version??'No rate snapshot'}<small>{a.id}</small></li>)}{jobs.map(j=><li key={j.id}>{j.operation.split('/').at(-1)} · {j.status} · {j.elapsed_ms===null?'Duration unknown':`${j.elapsed_ms/1000}s`}<small>{j.id}</small></li>)}</ul>
    <p>HTTP request bytes received: {totals.uploadBytes.toLocaleString()}. This is not total network transfer. Repeated operations, including deliberate revisions: {totals.repeatAttempts}.</p>
   </details>
   <details><summary>Log HeyGen credits or support time</summary>
    <form onSubmit={record}>
     <label>Entry type<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="heygen">HeyGen credits from dashboard</option><option value="support">Support time</option></select></label>
     {kind==='heygen'&&<label>HeyGen render<select value={render} onChange={e=>setRender(e.target.value)} required><option value="">Choose render</option>{renders.filter(r=>!entries.some(e=>e.render_id===r.id)).map(r=><option key={r.id} value={r.id}>{r.snapshot.scope??'test'} · {r.status} · {r.provider_video_id??r.id}</option>)}</select></label>}
     <label>{kind==='heygen'?'Credits consumed':'Support minutes'}<input type="number" min="0" max="1000000" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>
     <label>{kind==='heygen'?'USD per credit (monthly price ÷ credits)':'Support hourly rate, USD'}<input type="number" min="0" max="100000" step="any" value={rate} onChange={e=>setRate(e.target.value)} required/></label>
     <label>Evidence / note<input value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label>
     <button className="button" disabled={busy||preview}>Save manual entry</button>
    </form>
   </details>
   <ul>{entries.map(e=><li key={e.id}>{e.kind==='heygen'?'HeyGen credits':'Support minutes'}: {e.quantity} · {money(Number(e.quantity)*Number(e.unit_rate_usd))} · manually reported {e.note}</li>)}</ul>
  </>}
 </section>;
}
