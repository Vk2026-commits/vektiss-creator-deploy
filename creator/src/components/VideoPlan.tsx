import { PresenterPlacement } from './PresenterPlacement';
import {sameAvatarPreview} from '../domain/render-preview-update';
import {PlacementShortcuts} from './FreePresenter';
import {STEPHEN_AVATAR} from '../domain/avatar-framing';
import {AvatarEnginePicker} from './AvatarEnginePicker';
import {VoicePicker} from './VoicePicker';
import {closingPreview} from '../domain/voice-excerpt';
import {voiceEngineNames} from '../domain/voice-settings';
import { useEffect, useRef, useState } from 'react';
import { AvatarPicture } from './AvatarPicture';
import { ArticleLayout } from './ArticleLayout';
import { avatarRepository } from '../lib/avatar-repository';
import { subscribeAvatarLibrary } from '../lib/avatar-library-events';
import { usableAvatar, type Avatar } from '../../supabase/functions/_shared/avatar-contract';
import { planReady, type VideoPlan as Plan } from '../domain/video-plan';
import { scriptText, type ScriptInput } from '../domain/scripts';
import {StudioSetting} from './StudioSetting';
import {TemplateChooser} from './TemplateChooser';
import {EditStudio} from './EditStudio';
import {defaultEditBrand,editBrandSchema} from '../domain/edit-brand';
import {mediaFetch} from '../lib/media-fetch';

export function VideoPlan({script,plan,preview,busy,onChange,onSave,onEdit,editFocus}:{script:ScriptInput;plan:Plan;preview:boolean;busy:boolean;onChange:(p:Plan)=>void;onSave:()=>void;onEdit:()=>void;editFocus?:'voice'|'avatar'|'framing'|null}) {
 const section=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!editFocus)return;
  const selector=editFocus==='framing'?'.avatar-framing-controls':editFocus==='avatar'?'.saved-choice':'.saved-choice:has(.voice-picker)';
  const details=section.current?.querySelector<HTMLDetailsElement>(selector);
  if(details){details.open=true;details.scrollIntoView({block:'center'});}
 },[editFocus]);
 const [engineValid,setEngineValid]=useState(plan.avatar_engine===undefined);
 const [avatars,setAvatars]=useState<Avatar[]>([]);
 const [loading,setLoading]=useState(!preview);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const refresh=()=>setRetry(value=>value+1);
  const unsubscribe=subscribeAvatarLibrary(refresh);
  window.addEventListener('focus',refresh);
  return()=>{unsubscribe();window.removeEventListener('focus',refresh);};
 },[]);
 useEffect(()=>{if(preview)return;let active=true;setLoading(true);setError('');avatarRepository.library().then(lib=>{if(active)setAvatars(lib.avatars.filter(a=>usableAvatar(a,lib.connections)));}).catch(()=>{if(active)setError('Could not load your avatar library.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[preview,retry]);
 const update=(patch:Partial<Plan>)=>onChange({...plan,...patch,...(patch.avatar_id&&patch.avatar_id!==plan.avatar_id?{avatar_engine:null,voice_engine:patch.avatar_id===STEPHEN_AVATAR?'fish' as const:'auto' as const}:{})});
 const latestPlan=useRef({plan,onChange});latestPlan.current={plan,onChange};
 useEffect(()=>{if(!plan.edit_template||plan.edit_brand||preview)return;let live=true;void mediaFetch('/api/local-capture/template-brand').then(async r=>{if(!r.ok)return;const data=await r.json();const parsed=editBrandSchema.safeParse(data.brand);if(live&&parsed.success&&!latestPlan.current.plan.edit_brand)latestPlan.current.onChange({...latestPlan.current.plan,edit_brand:parsed.data});}).catch(()=>{});return()=>{live=false;};},[plan.edit_template,plan.edit_brand,preview]);
 const words=scriptText(script).split(/\s+/).filter(Boolean).length;
	 const selectedAvatar=avatars.find(a=>a.id===plan.avatar_id);
	 const presenterReady=plan.presenter==='avatar'&&Boolean(selectedAvatar)&&plan.avatar_engine!==null&&engineValid;
	 const choosing=plan.step==='presenter'||plan.step==='visuals';
 useEffect(()=>{
  if(!choosing||busy||!selectedAvatar)return;
  const aspect=plan.format==='portrait'?'9:16':plan.format==='square'?'1:1':'16:9';
  const verified=selectedAvatar.verified_previews?.find(v=>v.engine===(plan.avatar_engine??'avatar_iv')&&v.aspect_ratio===aspect);
  if(!verified)return;
  const avatar_preview={avatar_id:selectedAvatar.id,engine:plan.avatar_engine??'avatar_iv',format:plan.format,aspect:verified.crop.width/verified.crop.height};
  if(!sameAvatarPreview(plan.avatar_preview,avatar_preview))onChange({...plan,avatar_preview});
 },[choosing,busy,selectedAvatar,plan,onChange]);
	 const videoSource=script.brief.kind==='video';
	 const graphicSource=script.brief.kind==='graphic';
	 const backgroundReady=Boolean(plan.article_capture&&plan.article_capture.source_url===script.brief.url);
 if(plan.step==='saved'&&plan.presenter==='avatar'&&!preview)return null;
 return <section ref={section} className="video-plan">
 {choosing&&import.meta.env.VITE_EDIT_STUDIO==='true'&&<section><h3>Who will present?</h3><button type="button" className="button" aria-pressed={plan.presenter==='self'} onClick={()=>update({presenter:'self'})}>Use my footage</button><button type="button" className="button" aria-pressed={plan.presenter==='avatar'} onClick={()=>update({presenter:'avatar'})}>Use my avatar</button></section>}
 {choosing&&plan.presenter==='self'&&<EditStudio profileId={script.content_profile_id} preview={preview} initialTemplate={plan.edit_template} initialBrand={plan.edit_brand}/>}
 {choosing&&plan.presenter==='avatar'&&import.meta.env.VITE_EDIT_STUDIO==='true'&&<section><label>Video treatment<select value={plan.setting?'explainer':'reaction'} onChange={e=>update(e.target.value==='explainer'?{setting:'original',edit_template:plan.edit_template??'recommend',format:'portrait'}:{setting:undefined,edit_template:undefined})}><option value="explainer">Presenter + template graphics · source is research only</option><option value="reaction">Reaction · show the source</option></select></label></section>}
 {choosing&&plan.presenter==='avatar'&&<div className="placement-first">{plan.setting?<StudioSetting plan={plan} onChange={onChange} disabled={busy} preview={preview}/>:videoSource?<PresenterPlacement plan={plan} onChange={onChange}/>:<ArticleLayout plan={plan} graphic={graphicSource} sourceUrl={script.brief.url} onChange={onChange}/>}</div>}
 
 {(plan.step==='review'||(plan.step==='saved'&&plan.presenter!=='avatar'))&&<p>Presenter position: {plan.presenter_position.replace('-',' ')}</p>}
 {plan.step==='approve'&&<><h2>Approve your script</h2><p>Check the facts and your wording before choosing how it will look.</p><h3>{script.title}</h3><div className="plan-script">{scriptText(script)}</div><p>{words} words · approximately {Math.ceil(words/150*60)} seconds. Actual speech timing may vary.</p><button className="button" disabled={busy||!script.body.trim()} onClick={()=>update({approved_at:new Date().toISOString(),step:'presenter'})}>Approve & choose presenter →</button><button disabled={busy} onClick={onEdit}>Edit script</button></>}
 {choosing&&plan.presenter==='avatar'&&<><div className="presenter-picker"><details className="saved-choice" open={!plan.avatar_id}><summary><span>Avatar<strong>{selectedAvatar?.name??plan.avatar_name??'Choose an avatar'}</strong></span><span className="change-choice">Change</span></summary>
 {plan.presenter==='avatar'&&<>{loading?<p>Loading presenters…</p>:error?<p role="alert">{error} <button onClick={()=>setRetry(r=>r+1)}>Retry</button></p>:avatars.length?<div className="avatar-picture-grid" aria-label="Choose a presenter">{avatars.map(a=><button type="button" key={a.id} disabled={busy} aria-pressed={plan.avatar_id===a.id} onClick={()=>update({avatar_id:a.id,avatar_name:a.name,voice:undefined})}><AvatarPicture url={a.thumbnail_url} name={a.name}/><strong>{a.name}</strong>{a.voice_name&&<small>{a.voice_name}</small>}</button>)}</div>:<p>No connected presenters yet. Connect and import one in Avatar library, then return here. Your choices stay in this workspace.</p>}</>}
 {plan.presenter==='avatar'&&<button type="button" disabled={loading||busy||preview} onClick={()=>setRetry(value=>value+1)}>Refresh presenters</button>}
 </details>
 {error&&<p role="alert">{error}</p>}
 {selectedAvatar&&<AvatarEnginePicker key={`engine:${selectedAvatar.id}`} onValidity={setEngineValid} plan={plan} onChange={onChange} disabled={busy||preview} seconds={Math.ceil(words/2.5)}/>}
 {selectedAvatar&&<details className="saved-choice" open={editFocus==='voice'||undefined}><summary><span>Voice<strong>{plan.voice?.name??selectedAvatar.voice_name??'Avatar default'} · {voiceEngineNames[plan.voice_engine??'auto']} · {(plan.voice_speed??1).toFixed(2)}×</strong></span><span className="change-choice">Change</span></summary><VoicePicker previewText={closingPreview(script)} key={selectedAvatar.id} avatar={selectedAvatar} plan={plan} onChange={onChange} disabled={busy||preview}/></details>}
 </div></>}
 {choosing&&plan.presenter==='avatar'&&plan.setting&&<section className="edit-studio">{plan.setting==='original'&&selectedAvatar&&<div><AvatarPicture url={selectedAvatar.thumbnail_url??null} name={selectedAvatar.name}/><p>Selected look reference, not a generated preview. Confirm the room and framing in the completed footage before adding graphics.</p></div>}<h3>Choose your template</h3><p>Your source informs the script; it will not play behind the presenter. Templates use portrait output and support videos up to three minutes. Keep your script under 400 words.</p><button type="button" aria-pressed={plan.edit_template==='recommend'} onClick={()=>update({edit_template:'recommend'})}>Recommend a style from my script</button><TemplateChooser brand={plan.edit_brand??defaultEditBrand} selected={plan.edit_template??'recommend'} onSelect={id=>update({edit_template:id as Plan['edit_template'],format:'portrait'})}/><p>After the avatar is ready, review the timed visual plan and an eight-second preview before exporting. Generating that plan may incur an AI processing charge.</p></section>}
	 {choosing&&plan.presenter==='avatar'&&<><details><summary>More options</summary><label>Video shape<select disabled={Boolean(plan.edit_template)} value={plan.format} onChange={e=>update({format:e.target.value as Plan['format']})}><option value="portrait">Tall · phone video</option><option value="landscape">Wide · landscape</option><option value="square">Square</option></select></label>{!plan.setting&&videoSource&&<PlacementShortcuts plan={plan} onChange={onChange}/>}</details><div className="layout-next workflow-action-bar">{!presenterReady&&<p role="status">Choose an available avatar and engine to continue.</p>}{!plan.setting&&graphicSource&&!backgroundReady&&<p role="status">Choose your graphic to continue.</p>}{!plan.setting&&!videoSource&&!graphicSource&&!backgroundReady&&<p role="status">No background selected. This will be an avatar-only video.</p>}<button className="button" disabled={busy||loading||!presenterReady||(plan.setting==='studio'?!plan.studio_background:!plan.setting&&graphicSource&&!backgroundReady)} onClick={onSave}>{busy?'Saving…':'Next: review video →'}</button></div></>}
	 {(plan.step==='review'||(plan.step==='saved'&&plan.presenter!=='avatar'))&&<><h2>{script.title}</h2><details><summary>Video settings & script</summary><dl className="plan-summary"><dt>Presenter</dt><dd>{plan.presenter==='self'?'You · record yourself':plan.avatar_name}</dd><dt>Format</dt><dd>{plan.format}</dd><dt>Presenter size</dt><dd>{plan.presenter_size}%</dd><dt>Background</dt><dd>{plan.setting==='original'?'Avatar original setting':plan.setting==='studio'?'Saved studio image':videoSource?'Source video':plan.article_capture?'Saved article screenshot':'Presenter-only'}</dd><dt>Captions</dt><dd>{plan.edit_template?'Applied in Edit Studio after avatar generation':'Not available in this export yet'}</dd><dt>Estimated duration</dt><dd>~{Math.ceil(words/150*60)} seconds</dd></dl>{plan.visual_notes&&<p>{plan.visual_notes}</p>}<div className="plan-script">{scriptText(script)}</div></details><button disabled={busy} onClick={()=>update({step:'visuals'})}>Edit layout</button>{plan.step!=='saved'&&<button className="button" disabled={busy||!planReady(plan)||!presenterReady} onClick={onSave}>{busy?'Saving…':'Save layout & continue'}</button>}<button disabled={busy} onClick={onEdit}>Edit script (requires reapproval)</button><small>Saving does not start a paid render.</small></>}
 {plan.step==='saved'&&plan.presenter==='avatar'&&<button type="button" disabled={busy} onClick={()=>update({step:'visuals'})}>Edit placement</button>}
 </section>;
}
