import {useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {profileProposalSchema,type ProfileProposal} from '../domain/profile-edit';
import {CtaWording} from './CtaWording';

export function ProfileChat({profileId,allowVideo=false,onApply}:{profileId:string;allowVideo?:boolean;onApply:(proposal:ProfileProposal)=>Promise<void>}) {
 const [message,setMessage]=useState('');
 const [conversation,setConversation]=useState('');
 const [proposal,setProposal]=useState<ProfileProposal|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const lock=useRef(false);
 async function propose(){
  if(lock.current||!message.trim())return;
  lock.current=true;setBusy(true);setError('');
  try{
   if(!supabase)throw Error('Sign in to edit your profile with chat.');
   const request=[conversation,message.trim()].filter(Boolean).join('\n');
   if(request.length>5000)throw Error('Please shorten your request.');
   const {data,error}=await supabase.functions.invoke('profile-assistant',{body:{profileId,message:request,allowVideo},signal:AbortSignal.timeout(65000)});
   if(error)throw Error('Could not prepare changes. Your request is still here; please retry.');
   const result=profileProposalSchema.parse(data.proposal);
   setProposal(result);
   if(result.question){setConversation(`${request}\nClarification: ${result.question}\nAnswer:`);setMessage('');}
  }catch(e){setError(e instanceof Error?e.message:'Could not prepare changes.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function confirm(){
  if(lock.current||!proposal||proposal.question)return;
  lock.current=true;setBusy(true);setError('');
  try{await onApply(proposal);setProposal(null);setMessage('');setConversation('');}
  catch(e){setError(e instanceof Error?e.message:'Could not save changes.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="profile-chat" aria-label="Edit audience with chat">
  <h3>Tell Vektiss what to change</h3>
  <p>For example: “For my next 5 posts, ask viewers to comment GUIDE for my checklist. I’ll send it by DM.”</p>
  {proposal?.question&&<p role="status">{proposal.question}</p>}
  <label className="field"><span>{proposal?.question?'Your answer':'What would you like to change?'}</span>
   <textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={4500} rows={3} disabled={busy} placeholder="Change my audience, topics, tone, or call to action…" />
  </label>
  <button type="button" className="button secondary" disabled={busy||!message.trim()} onClick={()=>void propose()}>{busy?'Working…':'Preview changes →'}</button>
  {proposal&&!proposal.question&&<div className="profile-change-preview">
   <h4>Review before saving</h4><p>{proposal.summary}</p>
   {proposal.changes.map((change,i)=><p key={`${change.field}-${i}`}><strong>{change.field.replaceAll('_',' ')}:</strong> {change.value}</p>)}
   {proposal.cta&&<><p><strong>Script CTA:</strong> {proposal.cta.text}</p><p><strong>Delivery:</strong> {proposal.cta.delivery||'Not specified'}</p></>}
   {proposal.cta&&<CtaWording value={proposal.cta.wording} onChange={wording=>setProposal(old=>old?.cta?{...old,cta:{...old.cta,wording}}:old)}/>}
   <p>{proposal.scope==='next'?`Applies to the next ${proposal.count} distinct approved scripts for this audience. Your default stays unchanged.`:proposal.scope==='default'?'Becomes this audience’s default and ends its temporary CTA.':proposal.scope==='video'?'Applies only to this video; its script will need to be regenerated.':proposal.scope==='cancel'?'Stops this audience’s temporary CTA.':'Updates this audience profile.'}</p>
   <p className="muted">Vektiss writes the invitation. You or your existing delivery tool must send the offer.</p>
   <div className="profile-actions"><button type="button" className="button primary" disabled={busy} onClick={()=>void confirm()}>Confirm changes</button><button type="button" className="button secondary" disabled={busy} onClick={()=>{setProposal(null);setConversation('');}}>Discard</button></div>
  </div>}
  {error&&<p className="error-message" role="alert">{error}</p>}
 </section>;
}
