import {ScriptProgress,type DraftProgress} from './ScriptProgress';
import { useEffect, useMemo, useRef, useState } from 'react';
import { scriptSchema,scriptText, type Script, type ScriptInput } from '../domain/scripts';
import { emptyBrief, briefSchema, type ScriptBrief } from '../domain/script-brief';
import { ScriptIntake } from './ScriptIntake';
import { scriptAI } from '../lib/script-ai';
import { VideoPlan } from './VideoPlan';
import { newVideoPlan, type VideoPlan as Plan } from '../domain/video-plan';
import { PresenterTest } from './PresenterTest';
import { FullScriptRender } from './FullScriptRender';
import { explainError, type ContentProfile } from '../domain/strategy';
import { scriptRepository } from '../lib/script-repository';
import './scripts.css';
import './video-workspace.css';
import {videoStep,videoSteps} from '../domain/video-workflow';
import {suggestedVideoTitle} from '../domain/video-title';

export function Scripts({ profiles, selectedId, userId, preview }: { profiles: ContentProfile[]; selectedId: string | null; userId: string; preview: boolean }) {
  const repo = useMemo(() => scriptRepository(userId, preview), [userId, preview]);
  const empty = (): ScriptInput => ({ content_profile_id: selectedId ?? profiles.find(p => !p.archived_at)?.id ?? '', title: '', hook: '', body: '', cta: '', brief:emptyBrief() });
  const [draft, setDraft] = useState<ScriptInput>(empty);
  const [current, setCurrent] = useState<Script | null>(null);
  const [saved, setSaved] = useState<Script[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const generating = useRef(false);
  const [draftProgress,setDraftProgress]=useState<DraftProgress|null>(null);
  const [sourceProcessing,setSourceProcessing]=useState(false);
  const editorRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(draft.brief.stage==='review'){editorRef.current?.scrollIntoView({block:'start',behavior:'smooth'});editorRef.current?.focus({preventScroll:true});}},[draft.brief.stage]);
  const [editingScript,setEditingScript]=useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [planning,setPlanning]=useState(false);
  const latest=useRef(draft);latest.current=draft;
  const lastAutoAttempt=useRef<ScriptInput|null>(null);
  useEffect(()=>{
    if(!dirty||busy||!draft.content_profile_id||lastAutoAttempt.current===draft||!scriptSchema.safeParse({...draft,title:draft.title.trim()||'Untitled video'}).success)return;
    const timer=setTimeout(()=>{
      const snapshot=draft;lastAutoAttempt.current=snapshot;setBusy(true);
      const input={...snapshot,title:snapshot.title.trim()||'Untitled video'};
      void repo.save(input,current).then(item=>{
        setCurrent(item);setSaved(items=>[item,...items.filter(s=>s.id!==item.id)]);
        if(latest.current===snapshot){setDraft(item);setDirty(false);setMessage('');}
      }).catch(e=>setError(`Could not save progress: ${explainError(e)}`)).finally(()=>setBusy(false));
    },1200);
    return()=>clearTimeout(timer);
  },[draft,current,dirty,busy,repo]);
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
    repo.list().then(items => { if (active) setSaved(items); }).catch(e => { if (active) setError(explainError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repo]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const profile = profiles.find(p => p.id === draft.content_profile_id);
  const words = scriptText(draft).trim().split(/\s+/).filter(Boolean).length;
  function change(field: keyof ScriptInput, value: string) { setDraft(d => ({ ...d, [field]: value, ...(field==='content_profile_id'?{brief:{...d.brief,clarified:false,questions:[],summary:'',stage:'source' as const}}:{}) })); setDirty(true); setMessage(''); }
  function open(item: Script | null) {
    if(busy||sourceProcessing||generating.current)return;
    setEditingScript(false);
    if (dirty && !window.confirm('Some changes have not saved yet. Leave this video anyway?')) return;
    const parsed = briefSchema.safeParse(item?.brief);
    setDraftProgress(null);setCurrent(item); setDraft(item ? {...item,brief:parsed.success ? parsed.data : {...emptyBrief(),stage:'review'}} : empty()); setPlanning(Boolean(parsed.success&&parsed.data.production)); setDirty(false); setMessage(''); setError('');
  }
  function updateBrief(brief:ScriptBrief){setDraft(d=>({...d,brief}));setDirty(true);setMessage('');}
  async function runAI(action:'summarize'|'clarify'|'generate', override?:ScriptBrief) {
    if(busy||generating.current)return;
    generating.current=true;setDraftProgress({percent:70,label:action==='summarize'?'Understanding your source…':'Writing your script…'});
    setBusy(true);setError('');setMessage('');
    try {
      const input={...draft,brief:override??draft.brief,title:draft.title.trim() || 'Untitled video'};
      let snapshot=await repo.save(input,current);setCurrent(snapshot);setSaved(items=>[snapshot,...items.filter(s=>s.id!==snapshot.id)]);
      let result=await scriptAI(action,draft.content_profile_id,{...input.brief,questions:input.brief.questions.filter(q=>q.answer.trim())});
      let next:ScriptInput;
      if(action==='summarize') {
        next={...input,title:suggestedVideoTitle(input.title,result.title),brief:{...input.brief,source:result.source,source_summary:result.summary,stage:'source',clarified:false,questions:[],summary:'',production:undefined}};
        snapshot=await repo.save(next,snapshot);
        setCurrent(snapshot);setDraft(snapshot);setDirty(false);setSaved(items=>[snapshot,...items.filter(s=>s.id!==snapshot.id)]);
        setMessage('');setDraftProgress({percent:85,label:'Writing your script and angle…'});
        result=await scriptAI('generate',draft.content_profile_id,next.brief);
        next={...next,hook:result.hook,body:result.body,cta:result.cta,brief:{...next.brief,review:result.review,stage:'review'}};
      } else if(action==='clarify') {
        const brief={...input.brief,summary:result.summary,questions:[...input.brief.questions.filter(q=>q.answer.trim()).slice(-4),...result.questions.slice(0,1).map((question:string)=>({question,answer:''}))],clarified:true,stage:'clarify' as const};
        next={...input,brief};
        if(result.questions.length===0){
          setMessage('Your point of view is clear. Writing your script…');
          result=await scriptAI('generate',draft.content_profile_id,brief);
          next={...next,hook:result.hook,body:result.body,cta:result.cta,brief:{...brief,production:undefined,review:result.review,stage:'review'}};
        }
      } else next={...input,hook:result.hook,body:result.body,cta:result.cta,brief:{...input.brief,production:undefined,review:result.review,stage:'review'}};
      setDraftProgress({percent:95,label:'Saving your draft…'});setDraft(next);setDirty(true);
      const item=await repo.save(next,snapshot);setCurrent(item);setDraft(item);setDirty(false);setSaved(items=>[item,...items.filter(s=>s.id!==item.id)]);setEditingScript(false);setDraftProgress({percent:100,label:'Your draft is ready'});setMessage(next.brief.stage==='review'?'AI script saved. Review facts before publishing.':'One detail about your perspective needs clarification.');
    }catch(e){setDraftProgress(p=>({...p,percent:p?.percent??0,label:'Could not finish. Please retry.',failed:true}));setError(e instanceof Error?e.message:explainError(e));}finally{generating.current=false;setBusy(false);}
  }
  async function save(production?:Plan) {
    setBusy(true); setError(''); setMessage('');
    try {
      const next={...draft,title:draft.title.trim()||'Untitled video',brief:{...draft.brief,...(production?{production}:draft.brief.stage==='review'?{production:{...(draft.brief.production??newVideoPlan()),presenter:'avatar' as const,approved_at:new Date().toISOString(),step:'presenter' as const}}:{})}};
      const item = await repo.save(next, current);
      setCurrent(item); setDraft(item); setDirty(false);
      setSaved(items => [item, ...items.filter(s => s.id !== item.id)]);
      setMessage(preview ? 'Saved in this browser only.' : production?.step==='saved'?'Video plan saved to your account.':'Script saved to your account.');
      if(item.brief.stage==='review')setPlanning(true);
    } catch (e) { setError(explainError(e)); } finally { setBusy(false); }
  }
  return <div className="scripts-workspace">
    <div className="page-heading"><h1>Your video workspace</h1></div>
    <label className="mobile-project-picker">My videos<select disabled={busy||loading} value={current?.id??''} onChange={e=>open(saved.find(item=>item.id===e.target.value)??null)}><option value="">+ New video</option>{saved.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <div className="scripts-grid">
      <aside className="scripts-list"><button className="button" disabled={busy} onClick={() => open(null)}>+ New video</button><h2>My videos</h2>
        {loading ? <p>Loading videos…</p> : saved.length === 0 ? <p>Your videos will appear here.</p> : saved.map(item => <button disabled={busy} className={current?.id === item.id ? 'script-selected' : ''} key={item.id} onClick={() => open(item)}><strong>{item.title}</strong><small>Step {videoStep(item.brief,Boolean(item.brief.production))} of 4 · {new Date(item.updated_at).toLocaleDateString()}</small></button>)}
      </aside>
      <section ref={editorRef} tabIndex={-1} className="script-editor" aria-label="Script editor">
        <nav className="video-progress" aria-label="Video progress"><div className="video-step-heading"><span className="video-step-number" aria-hidden="true">{step}</span><div><p>Step {step} of 4</p><h2>{videoSteps[step-1]}</h2></div></div><ol>{videoSteps.map((label,i)=><li key={label} className={step>i+1?'complete':''} aria-current={step===i+1?'step':undefined}><span aria-hidden="true">{step>i+1?'✓':i+1}</span>{label}</li>)}</ol></nav>
        <p className="save-status" role="status">{dirty?(busy?'Saving your progress…':'Saving shortly…'):current?(preview?'Saved on this device':'All changes saved'):'Your progress saves as you go.'}</p>
        {error && <p role="alert">{error}{dirty&&<button disabled={busy} onClick={()=>{lastAutoAttempt.current=null;setError('');setDraft(d=>({...d}));}}>Retry saving</button>}</p>}{message && <p role="status">{message}</p>}
        {!planning&&draftProgress&&<ScriptProgress progress={draftProgress}/>}
        {planning&&draft.brief.production?<VideoPlan script={draft} plan={draft.brief.production} preview={preview} busy={busy} onChange={production=>{setDraft(d=>({...d,brief:{...d.brief,production}}));setDirty(true);setMessage('');}} onSave={()=>void save({...draft.brief.production!,step:'saved'})} onEdit={()=>{setPlanning(false);setDraft(d=>({...d,brief:{...d.brief,production:{...d.brief.production!,approved_at:null,step:'approve'}}}));setDirty(true);}}/>:<>
        <fieldset disabled={busy||sourceProcessing}>
          <details className="script-context" open={!profile}><summary><span className="context-caption">Your audience</span><strong>{profile?.name || 'Choose who this video is for'}</strong><span className="context-action">Change settings</span></summary>
          <label>Content profile<select value={draft.content_profile_id} onChange={e => change('content_profile_id', e.target.value)}><option value="">Choose an audience</option>{profiles.filter(p => !p.archived_at || p.id === draft.content_profile_id).map(p => <option value={p.id} key={p.id}>{p.name}{p.archived_at ? ' (archived)' : ''}</option>)}</select></label>
          {profile && <details><summary>Audience and voice details</summary><div className="script-direction"><p>{profile.primary_audience}</p><small>Tone: {profile.strategy.tone.join(' · ') || 'Your natural voice'}</small>{profile.strategy.things_to_avoid.length > 0 && <p>Avoid: {profile.strategy.things_to_avoid.join(' · ')}</p>}</div></details>}
          <details><summary>{draft.title&&!draft.title.startsWith('Untitled')?'Edit video title':'AI will name your video after reading the source'}</summary><label>Video title (optional)<input maxLength={200} value={draft.title.startsWith('Untitled')?'':draft.title} onChange={e => change('title', e.target.value)} placeholder="Leave blank for an AI title" /></label></details>
          </details>
          <ScriptIntake brief={draft.brief} onChange={updateBrief} profileId={draft.content_profile_id} busy={busy} preview={preview} onProcessing={setSourceProcessing} onProgress={setDraftProgress} onAI={runAI}/>
          {draft.body.trim()&&['perspective','clarify'].includes(draft.brief.stage)&&<button type="button" disabled={busy} onClick={()=>updateBrief({...draft.brief,stage:'review'})}>Back to existing draft</button>}
          {draft.brief.stage==='review' && <>
          {!editingScript&&<div className="ai-script-preview"><p>{draft.hook}</p><p>{draft.body}</p><p>{draft.cta}</p></div>}
          <button type="button" onClick={()=>setEditingScript(v=>!v)}>{editingScript?'Done editing':'Edit script'}</button>
          <button type="button" onClick={()=>updateBrief({...draft.brief,stage:'perspective'})}>Add an angle</button>
          {editingScript&&<><label>Hook<textarea rows={3} maxLength={2000} value={draft.hook} onChange={e => change('hook', e.target.value)} placeholder="Give someone a reason to keep watching." /></label>
          <label>Main message<textarea rows={10} maxLength={15000} value={draft.body} onChange={e => change('body', e.target.value)} placeholder="Share your idea, example, and practical takeaway." /></label>
          <label>Call to action<textarea rows={3} maxLength={2000} value={draft.cta} onChange={e => change('cta', e.target.value)} placeholder="What should the viewer do next?" /></label></>}
          </>}
        </fieldset>
        {draft.brief.stage==='review'&&<div className="script-actions"><small>{words} words · about {Math.ceil(words/150*60)} seconds</small><button className="button" disabled={busy||!draft.content_profile_id||!draft.body.trim()} onClick={()=>void save()}>Approve angle & continue →</button></div>}
        </>}
        {planning&&current&&draft.brief.production?.step==='saved'&&draft.brief.production.presenter==='avatar'&&!preview&&<><FullScriptRender sourceUrl={draft.brief.url} onPlanChange={production=>{setDraft(d=>({...d,brief:{...d.brief,production:{...(d.brief.production??production),video_background:production.video_background}}}));setDirty(true);}} sourceKind={draft.brief.kind} key={current.id} scriptId={current.id} revision={current.updated_at} disabled={dirty||busy} plan={draft.brief.production} onEditLayout={()=>{setDraft(d=>({...d,brief:{...d.brief,production:{...d.brief.production!,step:'visuals'}}}));setDirty(true);}}/><details><summary>Optional short presenter test</summary><PresenterTest key={`${current.id}:${current.updated_at}`} scriptId={current.id} revision={current.updated_at} disabled={dirty||busy}/></details></>}
      </section>
    </div>
  </div>;
}
