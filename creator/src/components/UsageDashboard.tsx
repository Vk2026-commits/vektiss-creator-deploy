import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {allocatedShared,costTotals,groupedCosts,priceForMargin,type DashboardData,type CostEvent} from '../domain/usage-dashboard';
import {ProjectCosts} from './ProjectCosts';
import './project-costs.css';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(n);
const day=(date:Date)=>date.toISOString().slice(0,10);
export function UsageDashboard(){
 const [from,setFrom]=useState(day(new Date(Date.now()-30*86400000))),[to,setTo]=useState(day(new Date()));
 const [creator,setCreator]=useState(''),[data,setData]=useState<DashboardData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [margin,setMargin]=useState(70),[units,setUnits]=useState(10),[extra,setExtra]=useState(0);
 const [provider,setProvider]=useState('Bunny'),[amount,setAmount]=useState(''),[basis,setBasis]=useState<'invoice'|'estimate'>('invoice'),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
 const request=useRef(0),pending=useRef<{key:string;id:string}|null>(null);
 const start=from+'T00:00:00Z',end=new Date(Date.parse(to+'T00:00:00Z')+86400000).toISOString();
 const load=useCallback(async()=>{
  const seq=++request.current;setBusy(true);
  try{const {data:result,error:failure}=await supabase!.rpc('creator_usage_dashboard',{p_from:start,p_to:end});if(failure)throw failure;if(seq===request.current){setData(result as DashboardData);setError('');}}
  catch{if(seq===request.current)setError('Could not refresh costs. Check owner access and choose a range of 366 days or less. Previously loaded figures may be stale.');}
  finally{if(seq===request.current)setBusy(false);}
 },[start,end]);
 useEffect(()=>{setData(null);void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);return()=>{clearInterval(timer);request.current++;};},[load]);
 const events=data?.events.filter(e=>!creator||e.user_id===creator)??[],total=costTotals(events);
 const global=costTotals(data?.events??[]),shared=(data?.shared??[]).reduce((sum,s)=>sum+allocatedShared(s,start,end),0);
 const full=events.filter(e=>e.provider==='HeyGen'&&e.operation==='full'&&['completed','ready'].includes(e.status)).length;
 const working=total.reported+total.estimated,average=full?working/full:null;
 const price=average===null?null:priceForMargin(average*units+extra,margin);
 const name=(id:string)=>data?.creators.find(c=>c.id===id)?.name??'Unattributed creator';
 async function saveShared(event:React.FormEvent){event.preventDefault();if(saving)return;const value=Number(amount);if(!amount||!Number.isFinite(value)||value<0)return;setSaving(true);
  const key=JSON.stringify([provider,value,from,to,basis,note]);if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
  try{const {error:failure}=await supabase!.from('creator_shared_costs').insert({id:pending.current.id,provider,amount_usd:value,period_start:from,period_end:to,basis,note});if(failure&&failure.code!=='23505')throw failure;pending.current=null;setAmount('');setNote('');await load();}
  catch{setError('Shared cost could not be saved. Retry uses the same entry ID to prevent duplicates.');}finally{setSaving(false);}
 }
 function table(rows:ReturnType<typeof groupedCosts>,label:string){return <div className="cost-table-wrap"><table><caption>{label}</caption><thead><tr><th>Category</th><th>Attempts</th><th>Reported / logged</th><th>Estimated only</th><th>Unpriced</th><th>Failed / uncertain</th></tr></thead><tbody>{rows.map(r=><tr key={r.name}><th>{r.name}</th><td>{r.attempts}</td><td>{money(r.reported)}</td><td>{money(r.estimated)}</td><td>{r.unknown}</td><td>{r.failed}</td></tr>)}</tbody></table></div>;}
 return <section className="project-costs usage-dashboard"><header><div><small>OWNER · LIVE USAGE</small><h1>System costs & pricing</h1></div><button onClick={()=>void load()} disabled={busy}>{busy?'Refreshing…':'Refresh now'}</button></header>
 <p>Updates every 30 seconds while open. {data&&<>Last successful update: {new Date(data.asOf).toLocaleString()}.</>}</p>
 <div className="cost-filters"><label>From<input type="date" value={from} max={to} onChange={e=>e.target.value&&setFrom(e.target.value)}/></label><label>Through<input type="date" value={to} min={from} onChange={e=>e.target.value&&setTo(e.target.value)}/></label><label>Creator<select value={creator} onChange={e=>setCreator(e.target.value)}><option value="">All creators</option>{data?.creators.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
 {error&&<p role="alert">{error}</p>}{data?.truncated&&<p role="alert">This range exceeds 50,000 events. Select a shorter range before using these partial totals for pricing.</p>}
 {data&&<><dl className="cost-metrics"><div><dt>Global reported / logged costs</dt><dd>{money(global.reported)}</dd></div><div><dt>Global estimates without a reported charge</dt><dd>{money(global.estimated)}</dd></div><div><dt>Shared overhead · selected dates</dt><dd>{money(shared)}</dd></div><div><dt>{creator?name(creator):'All creators'} · working subtotal</dt><dd>{money(working)}</dd></div><div><dt>Completed full avatar renders</dt><dd>{full}</dd></div><div><dt>Cost per completed full render</dt><dd>{average===null?'—':money(average)}</dd></div><div><dt>Unpriced operations</dt><dd>{total.unknown}</dd></div><div><dt>Discover ideas delivered</dt><dd>{data.researchJobs.filter(j=>!creator||j.user_id===creator).reduce((s,j)=>s+j.delivered,0)}</dd></div></dl>
 <p>Working subtotals combine reported or manually logged amounts with estimates where no charge is recorded. Cost per full render includes tests, research, failures and revisions in this date range. Shared overhead is separate. Missing charges are not zero.</p>
 {table(groupedCosts(events,e=>e.provider),'Costs by system component')}
 {table(groupedCosts(data.events,e=>name(e.user_id)),'Global creator comparison')}
 {table(groupedCosts(events.filter(e=>e.provider==='HeyGen'&&e.avatar),e=>`${e.avatar} · ${e.engine??'engine unrecorded'} · ${e.voice??'voice unrecorded'} · ${e.operation}`),'Avatar and voice engine comparison')}
 <h2>Pricing worksheet</h2><p>Scenario only. Uses the selected creator/date range’s working cost per completed full render. Enter allocated hosting, support, payment fees and other missing costs below. This is a partial cost floor until unpriced usage is reconciled.</p>
 <div className="cost-filters"><label>Videos per plan<input type="number" min="1" max="10000" value={units} onChange={e=>setUnits(Math.max(1,Number(e.target.value)))}/></label><label>Extra cost per plan · USD<input type="number" min="0" step="0.01" value={extra} onChange={e=>setExtra(Math.max(0,Number(e.target.value)))}/></label><label>Target gross margin · %<input type="number" min="0" max="99" value={margin} onChange={e=>setMargin(Math.min(99,Math.max(0,Number(e.target.value))))}/></label></div>
 <p className="cost-price">{price===null?'Complete a full render to calculate an observed pricing scenario.':`Scenario price: ${money(price)} per plan at ${margin}% gross margin.`}</p>
 <details><summary>Shared bills and overhead</summary><p>Enter only costs not already counted in the usage rows, such as Supabase, Vercel, Bunny hosting or additional support. Date ranges allocate each entry proportionally. Provider invoices may include usage already reported above; enter the remaining overhead, not the same charges twice.</p>
 <form onSubmit={saveShared}><div className="cost-filters"><label>Provider<input value={provider} maxLength={80} required onChange={e=>setProvider(e.target.value)}/></label><label>Total for selected dates · USD<input type="number" min="0" max="1000000" step="0.0001" value={amount} required onChange={e=>setAmount(e.target.value)}/></label><label>Basis<select value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="invoice">Invoice / actual</option><option value="estimate">Planning estimate</option></select></label></div><label>What this covers / invoice reference<input value={note} required maxLength={1000} onChange={e=>setNote(e.target.value)}/></label><button disabled={saving}>Save overhead entry</button></form>
 <ul>{data.shared.map(s=><li key={s.id}>{s.provider} · {money(Number(s.amount_usd))} · {s.basis} · {s.period_start} through {s.period_end} · {s.note}</li>)}</ul></details>
 <details><summary>Coverage and missing costs</summary><p>OpenAI uses saved rate estimates. HeyGen uses render estimates or manually recorded credits; unsupported avatar types and audio previews remain unpriced. Apify run charges are collected for new search polling after this release. Earlier Apify runs, cancelled runs not polled again, provider usage outside Vektiss, infrastructure subscriptions, storage, bandwidth and payment fees may be missing. Research AI shows recorded provider cost when available. Bunny timing is wall time, not billable CPU time.</p></details>
 <details><summary>Recent usage · latest 100 selected events</summary><div className="cost-table-wrap"><table><thead><tr><th>Time / creator</th><th>Component / operation</th><th>Status</th><th>Cost</th></tr></thead><tbody>{events.slice(0,100).map((e:CostEvent)=><tr key={e.id}><td>{new Date(e.at).toLocaleString()}<small>{name(e.user_id)}</small></td><td>{e.provider} · {e.operation}<small>{e.model??e.engine}</small></td><td>{e.status}</td><td>{e.reported!=null?`${money(Number(e.reported))} reported/logged`:e.estimate!=null?`${money(Number(e.estimate))} estimate`:'Unknown'}</td></tr>)}</tbody></table></div></details>
 <details><summary>Log project-specific credits and support for your own projects</summary><ProjectCosts/></details></>}
 </section>;
}
