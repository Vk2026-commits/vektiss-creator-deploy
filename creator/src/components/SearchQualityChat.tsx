import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {searchSettingLabels,type SearchChatProposal} from '../domain/search-chat';
import type {SearchQualitySettings} from '../domain/search-quality';

type ChatRequest={id:string;message:string;scope:'profile'|'creator';status:'pending'|'ready'|'error'|'applied'|'undone';proposal:SearchChatProposal|null;before_settings:SearchQualitySettings;after_settings:SearchQualitySettings|null;created_at:string};
async function invoke<T>(body:unknown):Promise<T>{
 if(!supabase)throw Error('Sign in to continue.');
 const {data,error}=await supabase.functions.invoke('search-quality-admin',{body:body as Record<string,unknown>,signal:AbortSignal.timeout(65000)});
 if(error||data?.code){
  const failure=data?.code?data:await error?.context?.json?.().catch(()=>null);
  throw Error(failure?.code==='VERSION_CONFLICT'?'These rules changed since this preview. Refresh and prepare a new proposal; nothing was overwritten.':'Could not complete this step. Check status before trying a new request. Your saved rules are unchanged.');
 }
 return data as T;
}
const display=(value:unknown)=>Array.isArray(value)?value.join('\n'):String(value||'Not set');
export function SearchQualityChat({profileId,creatorName,profileName,disabled,onApplied,scope,setScope}:{profileId:string;creatorName:string;profileName:string;disabled:boolean;onApplied:()=>void;scope:'profile'|'creator';setScope:(scope:'profile'|'creator')=>void}){
 const [message,setMessage]=useState('');
 const [requests,setRequests]=useState<ChatRequest[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const lock=useRef(false);
 const pending=useRef<{id:string;message:string;scope:string}|null>(null);
 const [tick,setTick]=useState(0);
 useEffect(()=>{
  let active=true; setRequests([]); setError('');
  void invoke<{requests:ChatRequest[]}>({action:'chat_history',profileId,scope}).then(result=>{if(active)setRequests(result.requests);}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[profileId,scope,tick]);
 async function propose(){
  if(lock.current||disabled||!message.trim())return;
  lock.current=true;setBusy(true);setError('');
  try{
   if(!pending.current||pending.current.message!==message.trim()||pending.current.scope!==scope)pending.current={id:crypto.randomUUID(),message:message.trim(),scope};
   const {request}=await invoke<{request:ChatRequest}>({action:'chat_prepare',requestId:pending.current.id,profileId,scope,message:message.trim()});
   setRequests(old=>[request,...old.filter(item=>item.id!==request.id)]);
  }catch(e){setError(e instanceof Error?e.message:'Could not prepare changes.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function apply(request:ChatRequest,undo=false){
  if(lock.current||disabled)return;
  lock.current=true;setBusy(true);setError('');
  try{
   await invoke({action:undo?'chat_undo':'chat_apply',requestId:request.id});
   setMessage('');pending.current=null;onApplied();
  }catch(e){setError(e instanceof Error?e.message:'Could not save.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="quality-card quality-chat" aria-label="Change search with chat">
  <span className="eyebrow">TELL VEKTISS WHAT TO CHANGE</span><h2>Fix the search in your own words.</h2>
  <p>Describe the clips you want—or what keeps going wrong. Review the proposed instructions, then approve. No container changes needed.</p>
  <label>Apply changes to<select value={scope} disabled={busy||disabled} onChange={e=>{setScope(e.target.value as typeof scope);pending.current=null;setMessage('');}}><option value="profile">Only {profileName}</option><option value="creator">{creatorName} — creator-wide defaults</option></select></label>
  <p>{scope==='creator'?'Defaults apply to this creator’s current and future Content Profiles unless a profile has its own saved search rules. Other creators are untouched.':`Only “${profileName}” will change. Other Content Profiles stay unchanged.`}</p>
  <label>Your message<textarea rows={4} maxLength={5000} value={message} disabled={busy||disabled} onChange={e=>setMessage(e.target.value)} placeholder="Find real safety situations caught on camera. Stop showing staged videos and news reports. Prefer Instagram, but keep the other platforms too." /></label>
  <p className="muted">Preview uses AI and may incur a small text-processing cost. It does not run a paid search, make videos, or change settings until you approve. These controls tune Discover video searches.</p>
  {disabled&&<p>Finish saving or discard your manual rule edits before using chat.</p>}
  <div className="profile-actions"><button className="button primary" disabled={busy||disabled||!message.trim()} onClick={()=>void propose()}>{busy?'Working…':'Preview changes →'}</button><button className="button secondary" disabled={busy} onClick={()=>setTick(value=>value+1)}>Check status / history</button></div>
  {error&&<p role="alert" className="error-message">{error}</p>}
  <div aria-live="polite">{requests.map((request,index)=><details key={request.id} open={index===0} className="quality-chat-result"><summary>{request.status==='applied'?'Saved':request.status==='undone'?'Undone':request.status==='pending'?'Preparing proposal':request.status==='error'?'Proposal failed':'Review proposal'} · {new Date(request.created_at).toLocaleString()}</summary>
   <blockquote>{request.message}</blockquote>
   {request.status==='pending'&&<p>This request may still be processing. Use Check status; repeated clicks do not create another AI request.</p>}
   {request.status==='error'&&<p>No settings changed. Edit your message to prepare a new proposal, or keep your existing rules. No automatic paid retry was made.</p>}
   {request.proposal&&<><p>{request.proposal.summary}</p>{request.proposal.question?<><p><strong>{request.proposal.question}</strong></p><button className="button secondary" disabled={busy||disabled} onClick={()=>{setMessage(`${request.message}\nClarification: ${request.proposal!.question}\nMy answer: `);pending.current=null;}}>Answer / refine</button></>:<>
    {(Object.keys(request.proposal.changes) as Array<keyof SearchQualitySettings>).map(key=><div key={key} className="quality-chat-diff"><h4>{searchSettingLabels[key]}</h4><div><section><strong>Before</strong><pre>{display(request.before_settings[key])}</pre></section><section><strong>Proposed</strong><pre>{display(request.after_settings?.[key])}</pre></section></div></div>)}
    {request.status==='ready'&&<div className="profile-actions"><button className="button primary" disabled={busy||disabled} onClick={()=>void apply(request)}>Approve and save</button><button className="button secondary" disabled={busy||disabled} onClick={()=>{setMessage(`${request.message}\nRefinement: `);pending.current=null;}}>Refine request</button></div>}
    {request.status==='applied'&&<><p>Saved for future searches. Existing results and videos are unchanged.</p><button className="button secondary" disabled={busy||disabled} onClick={()=>void apply(request,true)}>Undo these changes</button></>}
   </>}</>}
  </details>)}</div>
 </section>;
}
