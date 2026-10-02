import type {DraftProgress} from './ScriptProgress';
import { SourceReport } from './SourceReport';
import { type ScriptBrief } from '../domain/script-brief';
import { VoiceNote } from './VoiceNote';
import { SourceVideo } from './SourceVideo';
import { ContentSearch } from './ContentSearch';
import { useId, useState } from 'react';
import {AdjustSourceCut} from './AdjustSourceCut';
import type {SourceCut} from '../domain/source-cut';
export function ScriptIntake({brief,onChange,profileId,busy,preview,onAI,onProcessing,onProgress}:{brief:ScriptBrief;onChange:(b:ScriptBrief)=>void;profileId:string;busy:boolean;preview:boolean;onAI:(action:'summarize'|'clarify'|'generate',brief?:ScriptBrief)=>Promise<void>;onProcessing?:(busy:boolean)=>void;onProgress?:(progress:DraftProgress)=>void}) {
 const [voice,setVoice]=useState(false);
 const [takeMode,setTakeMode]=useState<'voice'|'type'>('voice');
 const [editingSource,setEditingSource]=useState(false);
 const [videoInput,setVideoInput]=useState<'search'|'link'|'upload'>('search');
 const tabsId=useId();
 const pending=brief.questions.findIndex(q=>!q.answer.trim());
 const questionIndex=pending<0?brief.questions.length-1:pending;
 const question=brief.questions[questionIndex];
 const [answer,setAnswer]=useState('');
 const submit=()=>{const next={...brief,questions:brief.questions.map((q,i)=>i===questionIndex?{...q,answer:answer.trim()}:q).filter(q=>q.answer.trim())};onChange(next);onAI('clarify',next);setAnswer('');setVoice(false);};
 const update=(patch:Partial<ScriptBrief>)=>onChange({...brief,...patch,clarified:false,questions:[],summary:''});
 const updateSource=(patch:Partial<ScriptBrief>)=>update({...patch,...('url' in patch||'kind' in patch?{source:'',source_cut:undefined}:{}),source_summary:undefined,production:undefined});
 const completeSource=async(source:string,source_cut:SourceCut)=>{const next={...brief,source,source_cut,source_summary:undefined,production:undefined,questions:[],summary:'',clarified:false,stage:'source' as const};setEditingSource(false);onChange(next);await onAI('summarize',next);};
 const cutControls=brief.source_cut?<AdjustSourceCut key={brief.source_cut.selected_id} cut={brief.source_cut} profileId={profileId} disabled={busy||preview} onComplete={completeSource} onProcessing={onProcessing??(()=>{})} onProgress={onProgress}/>:null;
 const move=(stage:ScriptBrief['stage'])=>onChange({...brief,stage});
 if(brief.stage==='source'&&brief.source_summary&&!editingSource)return <div className="script-intake source-ready">
  <span className="eyebrow">SOURCE READY</span>
  <h2>Here’s the gist.</h2>
  <SourceReport text={brief.source_summary}/>
  {cutControls}
  <div className="source-ready-action"><button type="button" className="button" disabled={busy} onClick={()=>onAI('generate')}>Retry / create draft →</button></div>
  <details><summary>View full analysis</summary><SourceReport text={brief.source}/></details>
  <button type="button" disabled={busy} onClick={()=>{setVideoInput(brief.url?'link':'upload');setEditingSource(true);}}>Change source</button>
 </div>;
 return <div className="script-intake">
 {brief.stage==='source'&&editingSource&&brief.source_summary&&<button type="button" onClick={()=>setEditingSource(false)}>← Back to the gist</button>}
 {brief.stage==='source'&&<><div className="video-input-tabs" role="tablist" aria-label="Choose a source method">{(['search','link','upload'] as const).map((mode,index)=><button type="button" role="tab" key={mode} id={`${tabsId}-method-${mode}`} aria-controls={`${tabsId}-method-panel`} aria-selected={videoInput===mode} tabIndex={videoInput===mode?0:-1} onClick={()=>{setVideoInput(mode);if(mode==='upload'&&brief.kind!=='video')updateSource({kind:'video'});}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const modes=['search','link','upload'] as const;const next=modes[e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowLeft'?2:1))%3];setVideoInput(next);if(next==='upload'&&brief.kind!=='video')updateSource({kind:'video'});document.getElementById(`${tabsId}-method-${next}`)?.focus();}}}>{mode==='search'?'Find content':mode==='link'?'Paste link':'Upload file'}</button>)}</div>{videoInput==='search'&&<ContentSearch profileId={profileId} disabled={busy||preview} onSelect={(url,kind)=>{updateSource({url,kind});setVideoInput('link');}}/>}</>}
 <div id={`${tabsId}-method-panel`} hidden={brief.stage==='source'&&videoInput==='search'}>
 {brief.stage==='source'&&<><h2>First, let’s understand the source.</h2><p>Add your {brief.kind==='video'?'video':'article'}. AI will use it and your profile to write your script.</p><label>Source type<select disabled={busy} value={brief.kind} onChange={e=>updateSource({kind:e.target.value as 'article'|'video'})}><option value="article">Article</option><option value="video">Video</option></select></label>{brief.kind==='article'&&<label>Article link<input disabled={busy} type="url" maxLength={2000} value={brief.url} onChange={e=>updateSource({url:e.target.value})} placeholder="https://…"/></label>}
 {brief.kind==='video'?<>
 {videoInput!=='search'&&<SourceVideo key={`${videoInput}:${profileId}`} onProgress={onProgress} mode={videoInput} url={brief.url} profileId={profileId} disabled={busy||preview} onUrl={url=>updateSource({url})} onProcessing={onProcessing??(()=>{})} onComplete={completeSource}/>}
 {brief.source&&<details><summary>Review video analysis</summary><SourceReport text={brief.source}/></details>}{brief.source&&brief.source.trim().length<40&&<p role="alert">This earlier import contains too little speech. Select Create my script to include visuals and on-screen text.</p>}</>:<details><summary>Paste article text instead</summary><label>Article text / relevant excerpt<textarea disabled={busy} maxLength={40000} rows={5} value={brief.source} onChange={e=>updateSource({source:e.target.value})} placeholder="Paste the article here if the website blocks access."/></label></details>}
 {brief.kind==='article'&&(brief.source_summary?<section className="script-direction" aria-label="Source summary"><span className="eyebrow">WHAT THE SOURCE SAYS</span><h2>Here’s the summary.</h2><SourceReport text={brief.source_summary}/><button type="button" className="button" disabled={busy} onClick={()=>onAI('generate')}>Create my draft →</button></section>:<button type="button" className="button" disabled={busy||preview||!profileId||(brief.source.trim().length<40&&!(brief.kind==='article'&&brief.url.trim()))} onClick={()=>{setEditingSource(false);onAI('summarize');}}>{busy?'Reading and summarizing…':'Create my script →'}</button>)}
 {brief.kind==='article'&&<p><small>AI uses your source and profile. You review the script and angle next.</small></p>}</>}
 {brief.stage==='perspective'&&<section className="perspective-focus"><h2>Add an angle (optional)</h2><p>AI uses your profile and source. Add a point you want it to emphasize—or continue without one.</p><div className="take-modes" aria-label="How to share your take"><button type="button" aria-pressed={takeMode==='voice'} onClick={()=>setTakeMode('voice')}>Record or upload</button><button type="button" aria-pressed={takeMode==='type'} onClick={()=>setTakeMode('type')}>Type instead</button></div><div hidden={takeMode!=='voice'} className="take-recorder"><VoiceNote profileId={profileId} disabled={busy||preview} onText={text=>update({notes:[brief.notes,text].filter(Boolean).join('\n\n')})}/></div>{takeMode==='type'?<label>Your take<textarea rows={4} maxLength={10000} value={brief.notes} onChange={e=>update({notes:e.target.value})} placeholder="I think the important thing here is…"/></label>:brief.notes&&<details><summary>Review or edit your words</summary><label>Your take<textarea rows={4} maxLength={10000} value={brief.notes} onChange={e=>update({notes:e.target.value})}/></label></details>}<div className="take-actions"><button type="button" className="button" disabled={busy||preview||!profileId||!brief.source_summary} onClick={()=>onAI(brief.notes.trim()?'clarify':'generate')}>{busy?'Writing your script…':brief.notes.trim()?'Apply angle & write script →':'Create my draft →'}</button><button type="button" disabled={busy} onClick={()=>move('source')}>← Back to source</button></div></section>}
 {brief.stage==='clarify'&&<div className="clarify-card"><span className="eyebrow">ONLY IF YOUR ANGLE NEEDS CLARITY</span>{question&&pending>=0?<><h2>{question.question}</h2><p>Just your point of view. No need to summarize the source again.</p><div className="answer-mode"><button type="button" aria-pressed={!voice} onClick={()=>setVoice(false)}>Type an answer</button><button type="button" aria-pressed={voice} onClick={()=>setVoice(true)}>Use my voice</button></div>{voice&&<VoiceNote key={questionIndex} label="Your answer" profileId={profileId} disabled={busy||preview} onText={text=>setAnswer(a=>[a,text].filter(Boolean).join(' '))}/>}<label>Your answer<textarea rows={3} maxLength={5000} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Here’s what I mean…" /></label><button type="button" className="button" disabled={busy||!answer.trim()} onClick={submit}>Continue →</button></>:<><h2>Your perspective is ready.</h2><p>We’ll use your source, voice notes, and answers to write the script.</p><button type="button" className="button" disabled={busy||preview} onClick={()=>onAI('clarify')}>Write my script →</button></>}<button type="button" disabled={busy||preview} onClick={()=>{const next={...brief,questions:brief.questions.filter(q=>q.answer.trim()),clarified:true};onChange(next);onAI('generate',next);}}>Skip unanswered questions</button><details><summary>Review AI’s understanding</summary><p>{brief.summary}</p></details><button type="button" onClick={()=>move('perspective')}>Edit my perspective</button></div>}
 {brief.stage==='review'&&<><h2>Your script, ready for review.</h2><p>Based on your profile and source. Review, then approve.</p>{brief.review&&<details><summary>Accuracy & source notes</summary><SourceReport text={brief.review}/></details>}<button type="button" onClick={()=>move('source')}>Review source and notes</button></>}
 {brief.stage==='review'&&cutControls}
 {preview&&<p>Local preview: you can save a brief, but AI and transcription require a signed-in account.</p>}
 </div>
 </div>;
}
