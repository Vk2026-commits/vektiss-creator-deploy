import {useRef,useState} from 'react';
import {contentInputSchema,emptyContent,explainError,type ContentInput} from '../domain/strategy';
import {applyProfileProposal} from '../domain/profile-edit';
import {ProfileChat} from './ProfileChat';

const questions=[
 {key:'name',title:'What should we call this audience profile?',examples:['Credit education for first-time buyers','Money confidence for families','Safety with Steve']},
 {key:'primary_audience',title:'Who are you speaking to?',examples:['First-time homebuyers learning about credit','Families who want to manage everyday spending','Women who want to feel safer in everyday situations']},
 {key:'content_pillars',title:'What subjects do you want to be known for?',examples:['Understanding credit reports','Budgeting basics','Situational awareness']},
 {key:'audience_problems',title:'What does your audience need help with?',examples:['Understanding unfamiliar terms','Knowing which questions to ask','Spotting misleading claims']},
 {key:'source_topics',title:'What should Discover look for?',examples:['Consumer protection news','Credit reporting updates','Real-life teachable moments']},
 {key:'reaction_angles',title:'What perspective do you bring?',examples:['Explain what this means in everyday life','Challenge a common misconception','Give one practical next step']},
 {key:'tone',title:'How should your content sound?',examples:['Calm and direct','Warm and encouraging','Clear and educational']},
 {key:'things_to_avoid',title:'What should we avoid saying?',examples:['Guaranteed results','Fear-based messaging','Unsupported claims']},
 {key:'desired_outcomes',title:'What should viewers walk away with?',examples:['A clearer understanding','One useful action','Questions to ask a professional']},
 {key:'cta',title:'What would you like viewers to do next?',examples:['Comment GUIDE to receive my free guide','Book a consultation through my profile','Follow for more practical tips']},
] as const;
type Key=typeof questions[number]['key'];
export function ContentForm({initial=emptyContent,profileId,preview=false,onSave,onClose}:{initial?:ContentInput;profileId?:string;preview?:boolean;onSave:(value:ContentInput)=>Promise<void>;onClose:()=>void}){
 const [draft,setDraft]=useState<ContentInput>(()=>({name:initial.name,primary_audience:initial.primary_audience,strategy:{...initial.strategy},cta_default:initial.cta_default,cta_campaign:initial.cta_campaign}));
 const [step,setStep]=useState(profileId?questions.length:0);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
 const question=questions[step];
 function value(key:Key){if(key==='cta')return draft.cta_default?.text??draft.strategy.preferred_ctas.join('\n');if(key==='name'||key==='primary_audience')return draft[key];return draft.strategy[key].join('\n');}
 function change(key:Key,text:string){setDraft(old=>key==='cta'?{...old,cta_default:{text,keyword:old.cta_default?.keyword??'',offer:old.cta_default?.offer??'',delivery:old.cta_default?.delivery??''}}:key==='name'||key==='primary_audience'?{...old,[key]:text}:{...old,strategy:{...old.strategy,[key]:text.split('\n')}});}
 async function save(next=draft){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const cleaned={...next,strategy:Object.fromEntries(Object.entries(next.strategy).map(([k,v])=>[k,Array.isArray(v)?v.map(x=>x.trim()).filter(Boolean):v]))};
  if(cleaned.cta_default&&!cleaned.cta_default.text.trim())cleaned.cta_default=null;
  if(cleaned.cta_default?.keyword&&(!cleaned.cta_default.offer.trim()||!cleaned.cta_default.delivery.trim()))throw Error('Add the offer and how viewers will receive it.');
  await onSave(contentInputSchema.parse(cleaned));onClose();
 }catch(e){setError(e instanceof Error&&!(e instanceof SyntaxError)?e.message:explainError(e));}finally{setBusy(false);lock.current=false;}}
 return <div className="form-body guided-profile">
  {question?<>
   <p className="muted">Question {step+1} of {questions.length} · Your own words are welcome</p>
   <progress value={step+1} max={questions.length} aria-label="Profile setup progress" />
   <h3>{question.title}</h3>
   {question.key==='cta'&&<p>This becomes the audience’s default CTA. After saving, use chat to set a temporary CTA for your next posts.</p>}
   <label className="field"><span>{question.key==='name'||question.key==='primary_audience'?'Your answer':'Your answer (optional)'}</span><textarea key={question.key} autoFocus rows={3} value={value(question.key)} maxLength={question.key==='name'?100:question.key==='primary_audience'?1000:question.key==='cta'?500:3220} onChange={e=>change(question.key,e.target.value)} placeholder="Type your answer or choose an example below…" /></label>
   <div className="profile-examples" aria-label="Examples you can edit">{question.examples.map(example=><button type="button" key={example} onClick={()=>change(question.key,['name','primary_audience','cta'].includes(question.key)?example:[value(question.key),example].filter(Boolean).join('\n'))}>{example}</button>)}</div>
   {question.key==='cta'&&<><p>For a comment-to-receive invitation, tell us the keyword, offer, and delivery method. Vektiss does not send DMs or fulfill offers.</p>{(['keyword','offer','delivery'] as const).map(key=><label className="field" key={key}><span>{key==='keyword'?'Comment keyword':key==='offer'?'What will they receive?':'How will you deliver it?'}</span><input value={draft.cta_default?.[key]??''} maxLength={key==='keyword'?60:key==='offer'?200:300} onChange={e=>setDraft(old=>({...old,cta_default:{text:old.cta_default?.text??'',keyword:old.cta_default?.keyword??'',offer:old.cta_default?.offer??'',delivery:old.cta_default?.delivery??'',[key]:e.target.value}}))} /></label>)}</>}
   <div className="profile-actions"><button type="button" className="button secondary" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Back</button><button type="button" className="button primary" disabled={['name','primary_audience'].includes(question.key)&&!value(question.key).trim()} onClick={()=>setStep(s=>s+1)}>{step===questions.length-1?'Review profile':'Next'} →</button></div>
  </>:<>
   <h3>Review your audience profile</h3>
   {questions.map((q,index)=><div className="profile-answer" key={q.key}><div><strong>{q.title}</strong><p>{value(q.key)||'Not specified'}</p></div><button type="button" className="button secondary" onClick={()=>setStep(index)} aria-label={`Edit: ${q.title}`}>Edit</button></div>)}
   {draft.cta_campaign&&<p>Temporary CTA: “{draft.cta_campaign.cta.text}” · Up to {draft.cta_campaign.limit} approved scripts in this campaign.</p>}
   <details><summary>Additional context and existing preferences</summary>{(['secondary_audience','audience_interests','preferred_ctas','additional_context'] as const).map(key=><label className="field" key={key}><span>{key.replaceAll('_',' ')}</span><textarea value={Array.isArray(draft.strategy[key])?(draft.strategy[key] as string[]).join('\n'):draft.strategy[key] as string} onChange={e=>setDraft(old=>({...old,strategy:{...old.strategy,[key]:Array.isArray(old.strategy[key])?e.target.value.split('\n'):e.target.value}}))} maxLength={key==='additional_context'?5000:key==='secondary_audience'?500:3220} /></label>)}</details>
   <div className="profile-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="button primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save audience profile'}</button></div>
   {profileId&&!preview&&<ProfileChat profileId={profileId} onApply={async proposal=>{await onSave(applyProfileProposal(draft,proposal));onClose();}} />}
  </>}
  {error&&<p className="error-message" role="alert">{error}</p>}
 </div>;
}
