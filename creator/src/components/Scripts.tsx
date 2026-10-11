import {ScriptProgress,type DraftProgress} from './ScriptProgress';
import {VideoLibraryPicker} from './VideoLibraryPicker';
import {StoryScriptReview} from './StoryScriptReview';
import { useEffect, useMemo, useRef, useState } from 'react';
import { scriptSchema,scriptText, type Script, type ScriptInput } from '../domain/scripts';
import { emptyBrief, briefSchema, type ScriptBrief } from '../domain/script-brief';
import { ScriptIntake } from './ScriptIntake';
import { scriptAI } from '../lib/script-ai';
import { VideoPlan } from './VideoPlan';
import { mergeRenderPlan, newVideoPlan, type VideoPlan as Plan } from '../domain/video-plan';
import { FullScriptRender } from './FullScriptRender';
import { explainError, type ContentProfile } from '../domain/strategy';
import { scriptRepository } from '../lib/script-repository';
import './scripts.css';
import './video-workspace.css';
import './mobile-workflow.css';
import {videoStep,videoSteps} from '../domain/video-workflow';
import {suggestedVideoTitle} from '../domain/video-title';
import {recoveryRead,recoveryWrite} from '../lib/recovery-storage';
import {mediaFetch} from '../lib/media-fetch';
import {researchFeedback,type ResearchOpportunity} from '../lib/research-client';
import {DiscoverySourceRepair} from './DiscoverySourceRepair';
import {ProfileChat} from './ProfileChat';
import {applyProfileProposal} from '../domain/profile-edit';
import {createSupabaseRepository} from '../lib/repository';
import {supabase} from '../lib/supabase';

export function Scripts({ profiles, selectedId, userId, preview, onAddAudience, audienceChoice, researchIntent, onResearchIntentHandled, onProfileUpdated }: { profiles: ContentProfile[]; selectedId: string | null; userId: string; preview: boolean; onAddAudience?:()=>void; audienceChoice?:{id:string;version:number}|null; researchIntent?:ResearchOpportunity|null; onResearchIntentHandled?:()=>void; onProfileUpdated?:(profile:ContentProfile)=>void }) {
  const repo = useMemo(() => scriptRepository(userId, preview), [userId, preview]);
  const recoveryKey=`vektiss:active-video:v1:${preview?'preview':'account'}:${userId}`;
  const [workspaceId,setWorkspaceId]=useState(()=>recoveryRead(`${recoveryKey}:workspace`)??crypto.randomUUID());
  useEffect(()=>recoveryWrite(`${recoveryKey}:workspace`,workspaceId),[recoveryKey,workspaceId]);
  const pendingDraftKey=`vektiss:pending-draft:v1:${userId}`;
  const draftController=useRef<AbortController|null>(null);
  useEffect(()=>()=>draftController.current?.abort(),[]);
  const empty = (): ScriptInput => ({ content_profile_id: selectedId ?? profiles.find(p => !p.archived_at)?.id ?? '', title: '', hook: '', body: '', cta: '', brief:{...emptyBrief(),cost_project_id:workspaceId} });
  const [draft, setDraft] = useState<ScriptInput>(empty);
  const [current, setCurrent] = useState<Script | null>(null);
  const [saved, setSaved] = useState<Script[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const generating = useRef(false);
  const [draftProgress,setDraftProgress]=useState<DraftProgress|null>(null);
  const [sourceProcessing,setSourceProcessing]=useState(false);
  const editorRef=useRef<HTMLElement>(null);
  const [editingScript,setEditingScript]=useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [planning,setPlanning]=useState(false);
  const savingPlan=useRef(false);
  const screenStep=videoStep(draft.brief,planning);
  useEffect(()=>{if(loading)return;const frame=requestAnimationFrame(()=>{editorRef.current?.focus({preventScroll:true});editorRef.current?.scrollIntoView({block:'start',behavior:'instant'});});return()=>cancelAnimationFrame(frame);},[screenStep,loading]);
  const latest=useRef(draft);latest.current=draft;
  const appliedAudience=useRef<number|null>(null);
  const appliedResearchIntent=useRef<string|null>(null);
  useEffect(()=>{
    if(!audienceChoice||appliedAudience.current===audienceChoice.version||loading||busy||sourceProcessing)return;
    appliedAudience.current=audienceChoice.version;
    if(latest.current.content_profile_id===audienceChoice.id)return;
    setDraft(d=>({...d,content_profile_id:audienceChoice.id,brief:{...d.brief,clarified:false,questions:[],summary:'',production:undefined,stage:'source'}}));
    setPlanning(false);setDirty(true);setMessage('Audience selected. Your source is still here.');
  },[audienceChoice,loading,busy,sourceProcessing]);
  useEffect(()=>{
    if(!researchIntent||appliedResearchIntent.current===researchIntent.id||busy||sourceProcessing)return;
    const targetProfileId=profiles.some(profile=>profile.id===researchIntent.content_profile_id&&!profile.archived_at)
      ?researchIntent.content_profile_id
      :selectedId??profiles.find(profile=>!profile.archived_at)?.id??'';
    if(!targetProfileId)return;
    appliedResearchIntent.current=researchIntent.id;
    const sources=researchIntent.source_snapshot;
    const next:ScriptInput={content_profile_id:targetProfileId,title:researchIntent.title,hook:'',body:'',cta:'',brief:{
      ...emptyBrief(),url:sources[0]?.url??'',
      notes:researchIntent.recommended_angle,research_opportunity_id:researchIntent.id,research_sources:sources,stage:'source',cost_project_id:crypto.randomUUID(),
    }};
    setWorkspaceId(crypto.randomUUID());setCurrent(null);setPlanning(false);setDraft(next);setDirty(true);setMessage('Your Discover link is ready. Continue to prepare the actual video, graphic or article before creating your script.');setError('');
    onResearchIntentHandled?.();
  },[researchIntent,profiles,selectedId,busy,sourceProcessing,onResearchIntentHandled]);
  const lastAutoAttempt=useRef<ScriptInput|null>(null);
  useEffect(()=>{
    // Source preparation owns the next save; avoid racing its revision-checked handoff.
    if(!dirty||busy||sourceProcessing||!draft.content_profile_id||lastAutoAttempt.current===draft||!scriptSchema.safeParse({...draft,title:draft.title.trim()||'Untitled video'}).success)return;
    const timer=setTimeout(()=>{
      const snapshot=draft;lastAutoAttempt.current=snapshot;setBusy(true);
      const input={...snapshot,title:snapshot.title.trim()||'Untitled video'};
      void repo.save(input,current).then(item=>{
        setCurrent(item);setSaved(items=>[item,...items.filter(s=>s.id!==item.id)]);
        if(latest.current===snapshot){setDraft(item);setDirty(false);setMessage('');}
      }).catch(e=>setError(`Could not save progress: ${explainError(e)}`)).finally(()=>setBusy(false));
    },1200);
    return()=>clearTimeout(timer);
  },[draft,current,dirty,busy,sourceProcessing,repo]);
  const step=videoStep(draft.brief,planning);
  useEffect(()=>{
    const create=()=>{if(busy){setMessage('Please wait for saving to finish, then choose New video.');return;}open(null);};
    window.addEventListener('creator:new-video',create);
    return()=>window.removeEventListener('creator:new-video',create);
  },[busy,sourceProcessing,dirty,selectedId,profiles]);
  useEffect(() => {
    if (selectedId && !dirty && !current) setDraft(d => ({ ...d, content_profile_id: selectedId }));
  }, [selectedId, dirty, current]);
  useEffect(() => {
    let active = true;
    repo.list().then(items => { if (active) {
      setSaved(items);
      const restored=items.find(item=>item.id===recoveryRead(recoveryKey));
      if(restored){setCurrent(restored);setDraft({...restored,brief:{...restored.brief,cost_project_id:restored.brief.cost_project_id??restored.id}});setPlanning(Boolean(restored.brief.production));}
      const pending=recoveryRead(pendingDraftKey);
      if(!preview&&import.meta.env.PROD&&pending){
        try{
          const command=JSON.parse(pending);
          const item=items.find(item=>item.id===command.script_id);
          if(item&&typeof command.revision==='string'&&['summarize','summary_only','clarify','generate'].includes(command.action)){
            setCurrent(item);setDraft(item);setPlanning(false);void recoverDraft(pending,true);
          }else recoveryWrite(pendingDraftKey,null);
        }catch{recoveryWrite(pendingDraftKey,null);}
      }
    } }).catch(e => { if (active) setError(explainError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repo,recoveryKey,pendingDraftKey,preview]);
  useEffect(()=>{if(!loading)recoveryWrite(recoveryKey,current?.id??null);},[current?.id,loading,recoveryKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const profile = profiles.find(p => p.id === draft.content_profile_id);
  const words = scriptText(draft).trim().split(/\s+/).filter(Boolean).length;
  function change(field: keyof ScriptInput, value: string) { setDraft(d => ({ ...d, [field]: value, ...(field==='content_profile_id'?{brief:{...d.brief,clarified:false,questions:[],summary:'',stage:'source' as const}}:['hook','body','cta'].includes(field)&&d.brief.production?{brief:{...d.brief,production:{...d.brief.production,approved_at:null,step:'approve' as const}}}:{}) })); setDirty(true); setMessage(''); }
  function open(item: Script | null) {
    if(busy||sourceProcessing||generating.current)return;
    setEditingScript(false);
    if (dirty && !window.confirm('Some changes have not saved yet. Leave this video anyway?')) return;
    const nextWorkspace=item?.id??crypto.randomUUID();setWorkspaceId(nextWorkspace);
    const parsed = briefSchema.safeParse(item?.brief);
    setDraftProgress(null);setCurrent(item); setDraft(item ? {...item,brief:{...(parsed.success ? parsed.data : {...emptyBrief(),stage:'review' as const}),cost_project_id:parsed.success?parsed.data.cost_project_id??item.id:item.id}} : {...empty(),brief:{...emptyBrief(),cost_project_id:nextWorkspace}}); setPlanning(Boolean(parsed.success&&parsed.data.production)); setDirty(false); setMessage(''); setError('');
  }
  function updateBrief(brief:ScriptBrief){setDraft(d=>({...d,brief}));setDirty(true);setMessage('');}
  function updateRenderPlan(production:Plan){
    const currentPlan=latest.current.brief.production;
    if(!currentPlan)return;
    const nextPlan=mergeRenderPlan(currentPlan,production);
    if(nextPlan===currentPlan)return;
    const nextDraft={...latest.current,brief:{...latest.current.brief,production:nextPlan}};
    latest.current=nextDraft;
    setDraft(nextDraft);setDirty(true);setMessage('');
  }
  function viewStep(index:number){
    if(index===1){setPlanning(false);setEditingScript(false);}
    else if(draft.brief.production){setPlanning(true);updateBrief({...draft.brief,production:{...draft.brief.production,step:'visuals'}});}
    setMessage('');
  }
  async function recoverDraft(body:string,resume=false){
    const controller=new AbortController();draftController.current?.abort();draftController.current=controller;
    generating.current=true;setBusy(true);setDirty(false);setError('');
    const summaryOnly=JSON.parse(body).action==='summary_only';
    setDraftProgress({percent:0,label:summaryOnly?'Reading your source…':'Writing your saved script…',indeterminate:true});
    try{
      const response=await mediaFetch('/api/local-capture/script-draft',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal},undefined,resume);
      const result=await response.json();
      if(!response.ok){recoveryWrite(pendingDraftKey,null);throw Error(result.error??'Could not finish your saved draft.');}
      // Read the latest row rather than overwriting newer edits with a job result.
      const items=await repo.list();if(controller.signal.aborted)return;
      const item=items.find(item=>item.id===result.id);if(!item)throw Error('Saved draft is unavailable. Reopen My videos.');
      recoveryWrite(pendingDraftKey,null);setSaved(items);setCurrent(item);setDraft(item);setDirty(false);setEditingScript(false);
      setDraftProgress({percent:100,label:summaryOnly?'Your summary is ready':'Your draft is ready'});
    }catch(e){if(!controller.signal.aborted){
      // A summary may have saved before the writing stage failed. Restore its
      // latest revision so retrying does not conflict with that checkpoint.
      try{const items=await repo.list();const id=JSON.parse(body).script_id;const item=items.find(item=>item.id===id);if(!controller.signal.aborted&&item){setSaved(items);setCurrent(item);setDraft(item);setDirty(false);}}catch{/* Preserve current inputs if offline. */}
      if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Could not reconnect to the saved draft.');setDraftProgress({percent:85,label:'Draft interrupted. Your saved source is preserved.',failed:true});}
    }}
    finally{if(!controller.signal.aborted){generating.current=false;setBusy(false);}}
  }
  async function runAI(action:'summarize'|'summary_only'|'clarify'|'generate', override?:ScriptBrief) {
    if(busy||generating.current)return;
    if(action==='summary_only'&&draft.brief.source_summary)return;
    if(action!=='summary_only'&&draft.body.trim()&&!window.confirm('Rewrite your script? This replaces the current wording after the new script is ready and requires approval again.'))return;
    generating.current=true;setDraftProgress({percent:0,label:action==='summary_only'?'Reading your source…':action==='summarize'?'Understanding your source…':'Writing your script…',indeterminate:true});
    setBusy(true);setError('');setMessage('');
    try {
      const input={...draft,brief:override?{...override,...(draft.body.trim()?{stage:draft.brief.stage,production:draft.brief.production}:{})}:draft.brief,title:draft.title.trim() || 'Untitled video'};
      let snapshot=await repo.save(input,current);setCurrent(snapshot);setSaved(items=>[snapshot,...items.filter(s=>s.id!==snapshot.id)]);
      if(!preview&&import.meta.env.PROD){
        setDraft(snapshot);setDirty(false);
        const body=JSON.stringify({script_id:snapshot.id,revision:snapshot.updated_at,action});
        recoveryWrite(recoveryKey,snapshot.id);recoveryWrite(pendingDraftKey,body);
        await recoverDraft(body);return;
      }
      let result=await scriptAI(action==='summary_only'?'summarize':action,draft.content_profile_id,{...snapshot.brief,questions:snapshot.brief.questions.filter(q=>q.answer.trim())});
      let next:ScriptInput;
      if(action==='summary_only') {
        next={...input,brief:{...input.brief,source_summary:result.summary}};
      } else if(action==='summarize') {
        next={...input,title:suggestedVideoTitle(input.title,result.title),brief:{...input.brief,source:result.source,source_summary:result.summary,stage:'source',clarified:false,questions:[],summary:'',production:undefined}};
        if(!input.body.trim()){snapshot=await repo.save(next,snapshot);setCurrent(snapshot);setDraft(snapshot);setDirty(false);setSaved(items=>[snapshot,...items.filter(s=>s.id!==snapshot.id)]);}
        setMessage('');setDraftProgress({percent:85,label:'Writing your script and angle…'});
        result=await scriptAI('generate',draft.content_profile_id,next.brief);
        next={...next,hook:result.hook,body:result.body,cta:result.cta,brief:{...next.brief,delivery_preferences:result.delivery_preferences,review:result.review,stage:'review'}};
      } else if(action==='clarify') {
        const brief={...input.brief,summary:result.summary,questions:[...input.brief.questions.filter(q=>q.answer.trim()).slice(-4),...result.questions.slice(0,1).map((question:string)=>({question,answer:''}))],clarified:true,stage:'clarify' as const};
        next={...input,brief};
        if(result.questions.length===0){
          setMessage('Your point of view is clear. Writing your script…');
          result=await scriptAI('generate',draft.content_profile_id,brief);
          next={...next,hook:result.hook,body:result.body,cta:result.cta,brief:{...brief,production:undefined,delivery_preferences:result.delivery_preferences,review:result.review,stage:'review'}};
        }
      } else next={...input,hook:result.hook,body:result.body,cta:result.cta,brief:{...input.brief,production:undefined,delivery_preferences:result.delivery_preferences,review:result.review,stage:'review'}};
      if(result.screenshot_story&&next.brief.stage==='review')next={...next,brief:{...next.brief,screenshot_story:result.screenshot_story}}; setDraftProgress({percent:95,label:'Saving your draft…'});
      const item=await repo.save(next,snapshot);setCurrent(item);setDraft(item);setDirty(false);setSaved(items=>[item,...items.filter(s=>s.id!==item.id)]);setEditingScript(false);setDraftProgress({percent:100,label:'Your draft is ready'});setMessage(next.brief.stage==='review'?'AI script saved. Review facts before publishing.':'One detail about your perspective needs clarification.');
      if(action==='generate'&&next.brief.research_opportunity_id&&!preview)void researchFeedback(next.brief.research_opportunity_id,'script_created').catch(()=>{/* Conversion tracking must not interrupt a completed draft. */});
    }catch(e){setDraftProgress(p=>({...p,percent:p?.percent??0,label:'Could not finish. Please retry.',failed:true}));setError(e instanceof Error?e.message:explainError(e));}finally{generating.current=false;setBusy(false);}
  }
  async function save(production?:Plan) {
    if(savingPlan.current||busy||sourceProcessing)return;
    savingPlan.current=true;
    setBusy(true); setError(''); setMessage('');
    try {
      const next={...draft,title:draft.title.trim()||'Untitled video',brief:{...draft.brief,...(production?{production}:draft.brief.stage==='review'?{production:{...(draft.brief.production??newVideoPlan()),...(draft.brief.source_cut?{video_background:{id:draft.brief.source_cut.selected_id,source_url:draft.brief.url}}:{}),...(draft.brief.screenshot_story?{screenshot_story:draft.brief.screenshot_story,article_capture:draft.brief.screenshot_story.images[0]}:{}),...(draft.brief.kind==='graphic'&&draft.brief.graphic_capture?{article_capture:draft.brief.graphic_capture}:{}),presenter:'avatar' as const,approved_at:new Date().toISOString(),step:'presenter' as const}}:{})}};
      const item = await repo.save(next, current);
      setCurrent(item); setDraft(item); setDirty(false);
      setSaved(items => [item, ...items.filter(s => s.id !== item.id)]);
      setMessage('');
      if(item.brief.stage==='review')setPlanning(true);
    } catch (e) { setError(explainError(e)); } finally { savingPlan.current=false;setBusy(false); }
  }
  return <div className="scripts-workspace">
    <div className="page-heading"><h1>Create video</h1></div>
    <VideoLibraryPicker items={saved} current={current} disabled={busy||loading||sourceProcessing} onSelect={open}/>
    <div className="scripts-grid">
      <aside className="scripts-list"><button className="button" disabled={busy} onClick={() => open(null)}>+ New video</button><h2>My videos</h2>
        {loading ? <p>Loading videos…</p> : saved.length === 0 ? <p>Your videos will appear here.</p> : saved.map(item => <button disabled={busy} className={current?.id === item.id ? 'script-selected' : ''} key={item.id} onClick={() => open(item)}><strong>{item.title}</strong><small>Step {videoStep(item.brief,Boolean(item.brief.production))} of 4 · {new Date(item.updated_at).toLocaleDateString()}</small></button>)}
      </aside>
      <section ref={editorRef} tabIndex={-1} className="script-editor" aria-label="Script editor">
        <nav className="video-progress" aria-label="Video progress"><div className="video-step-heading"><span className="video-step-number" aria-hidden="true">{step}</span><div><p>Step {step} of 4</p><h2>{videoSteps[step-1]}</h2></div></div><ol>{videoSteps.map((label,i)=><li key={label} className={step>i+1?'complete':''} aria-current={step===i+1?'step':undefined}>{(i===1&&draft.body.trim()||i===2&&draft.brief.production)?<button type="button" disabled={busy||sourceProcessing} onClick={()=>viewStep(i)}><span aria-hidden="true">{step>i+1?'✓':i+1}</span>{label}</button>:<><span aria-hidden="true">{step>i+1?'✓':i+1}</span>{label}</>}</li>)}</ol></nav>
        <p className="save-status" role="status">{dirty?(busy?'Saving your progress…':'Saving shortly…'):current?(preview?'Saved on this device':'All changes saved'):'Your progress saves as you go.'}</p>
        {error && <p role="alert">{error}{dirty&&<button disabled={busy} onClick={()=>{lastAutoAttempt.current=null;setError('');setDraft(d=>({...d}));}}>Retry saving</button>}</p>}{message && <p role="status">{message}</p>}
        {!planning&&draftProgress&&!draftProgress.failed&&draftProgress.percent<100&&<ScriptProgress progress={draftProgress}/>}
        {planning&&draft.brief.production?<VideoPlan script={draft} plan={draft.brief.production} preview={preview} busy={busy} onChange={production=>{setDraft(d=>({...d,brief:{...d.brief,production}}));setDirty(true);setMessage('');}} onSave={()=>void save({...draft.brief.production!,step:'saved'})} onEdit={()=>{setPlanning(false);setDraft(d=>({...d,brief:{...d.brief,production:{...d.brief.production!,approved_at:null,step:'approve'}}}));setDirty(true);}}/>:<>
        <fieldset disabled={loading||busy||sourceProcessing}>
          {draft.brief.stage==='review'&&<section className="review-script-first" aria-label="Your script">
            {draft.brief.screenshot_story?.sections.length?<StoryScriptReview story={draft.brief.screenshot_story} editing={editingScript} onChange={screenshot_story=>{setDraft(d=>({...d,hook:'',body:screenshot_story.sections.map(s=>s.text).join('\n\n'),cta:'',brief:{...d.brief,screenshot_story,production:d.brief.production?{...d.brief.production,screenshot_story,approved_at:null,step:'approve'}:undefined}}));setDirty(true);}}/>:!editingScript?<div className="ai-script-preview"><p>{draft.hook}</p><p>{draft.body}</p><p>{draft.cta}</p></div>:<><label>Hook<textarea rows={3} maxLength={2000} value={draft.hook} onChange={e=>change('hook',e.target.value)}/></label><label>Main message<textarea rows={10} maxLength={15000} value={draft.body} onChange={e=>change('body',e.target.value)}/></label><label>Call to action<textarea rows={3} maxLength={2000} value={draft.cta} onChange={e=>change('cta',e.target.value)}/></label></>}
            <div className="review-secondary"><button type="button" onClick={()=>setEditingScript(v=>!v)}>{editingScript?'Done editing':'Edit script'}</button><button type="button" disabled={busy||preview} onClick={()=>void runAI('generate')}>Rewrite script</button><button type="button" onClick={()=>updateBrief({...draft.brief,stage:'perspective'})}>Add an angle</button></div>
          </section>}
          <details className="audience-options" open={!profile}><summary><span className="audience-summary"><strong>Audience & call to action</strong><span>{profile?.name||'Choose your audience'}</span></span></summary>
          {onAddAudience&&<div className="audience-shortcut"><span>{profile?'Need a different audience?':'Who are you talking to? Add an audience to get started.'}</span><button type="button" onClick={onAddAudience}>+ Add audience</button></div>}
          <details className="script-context" open={!profile}><summary><span className="context-caption">Your audience</span><strong>{profile?.name || 'Choose who this video is for'}</strong><span className="context-action">Change settings</span></summary>
          <label>Content profile<select value={draft.content_profile_id} onChange={e => change('content_profile_id', e.target.value)}><option value="">Choose an audience</option>{profiles.filter(p => !p.archived_at || p.id === draft.content_profile_id).map(p => <option value={p.id} key={p.id}>{p.name}{p.archived_at ? ' (archived)' : ''}</option>)}</select></label>
          {profile && <details><summary>Audience and voice details</summary><div className="script-direction"><p>{profile.primary_audience}</p><small>Tone: {profile.strategy.tone.join(' · ') || 'Your natural voice'}</small>{profile.strategy.things_to_avoid.length > 0 && <p>Avoid: {profile.strategy.things_to_avoid.join(' · ')}</p>}</div></details>}
          <details><summary>{draft.title&&!draft.title.startsWith('Untitled')?'Edit video title':'AI will name your video after reading the source'}</summary><label>Video title (optional)<input maxLength={200} value={draft.title.startsWith('Untitled')?'':draft.title} onChange={e => change('title', e.target.value)} placeholder="Leave blank for an AI title" /></label></details>
          </details>
          {profile&&!preview&&<details className="script-context"><summary>Ask for a change</summary><ProfileChat key={`${profile.id}:${current?.id??'new'}`} profileId={profile.id} allowVideo onApply={async proposal=>{
            if(!supabase)throw Error('Please sign in again.');
            if(proposal.scope==='video'){
              if(!proposal.cta)throw Error('Add a CTA first.');
              if(proposal.changes.length)throw Error('Please change the audience separately from this video’s CTA.');
              const next={...draft,brief:{...draft.brief,cta_override:proposal.cta,cta_selection:undefined,production:undefined,stage:'source' as const}};
              const item=await repo.save({...next,title:next.title.trim()||'Untitled video'},current);
              setCurrent(item);setDraft(item);setDirty(false);setSaved(items=>[item,...items.filter(s=>s.id!==item.id)]);
              setMessage('CTA saved for this video. Continue with your saved source to regenerate the script before approving.');
            }else{
              const updated=await createSupabaseRepository(supabase,userId).saveContent(applyProfileProposal(profile,proposal),profile.creator_profile_id,profile);
              onProfileUpdated?.(updated);setMessage('Audience updated. Changes apply to newly generated scripts; existing approved scripts are unchanged.');
            }
          }}/></details>}
          {draft.brief.cta_override&&<p>CTA for this video: {draft.brief.cta_override.text}</p>}
          </details>
          {!loading&&<ScriptIntake key={workspaceId} scope={`${userId}:${workspaceId}`} brief={draft.brief} onChange={updateBrief} profileId={draft.content_profile_id} busy={busy} preview={preview} onProcessing={setSourceProcessing} onProgress={setDraftProgress} onAI={runAI}/>}
          {draft.body.trim()&&['perspective','clarify'].includes(draft.brief.stage)&&<button type="button" disabled={busy} onClick={()=>updateBrief({...draft.brief,stage:'review'})}>Back to existing draft</button>}
        </fieldset>
	{draft.brief.stage==='review'&&<div className="script-actions workflow-action-bar"><small>About {Math.ceil(words/150*60)} seconds</small><button className="button" disabled={busy||!draft.content_profile_id||!draft.body.trim()||Boolean(draft.brief.screenshot_story?.sections.some(section=>!section.text.trim()))} onClick={()=>void save()}>Next: choose avatar →</button></div>}
        </>}
        {planning&&current&&draft.brief.production?.step==='saved'&&draft.brief.production.presenter==='avatar'&&!preview&&(draft.brief.research_opportunity_id&&!draft.brief.prepared_source&&!draft.brief.production.video_background&&!draft.brief.production.article_capture?<DiscoverySourceRepair brief={draft.brief} profileId={draft.content_profile_id} scope={current.id} onRepair={brief=>{setDraft(d=>({...d,brief}));setDirty(true);setMessage('Background restored. Your existing script and presenter settings are unchanged.');}}/>:<><FullScriptRender sourceUrl={draft.brief.url} onPlanChange={updateRenderPlan} sourceKind={draft.brief.kind} key={current.id} scriptId={current.id} revision={current.updated_at} disabled={dirty||busy} plan={draft.brief.production} onEditLayout={()=>{setDraft(d=>({...d,brief:{...d.brief,production:{...d.brief.production!,step:'visuals'}}}));setDirty(true);}}/></>)}
      </section>
    </div>
  </div>;
}
