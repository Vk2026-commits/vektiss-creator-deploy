import { PresenterPlacement } from './PresenterPlacement';
import {STEPHEN_AVATAR} from '../domain/avatar-framing';
import {AvatarEnginePicker} from './AvatarEnginePicker';
import {VoicePicker} from './VoicePicker';
import { useEffect, useRef, useState } from 'react';
import { AvatarPicture } from './AvatarPicture';
import { ArticleLayout } from './ArticleLayout';
import { avatarRepository } from '../lib/avatar-repository';
import { subscribeAvatarLibrary } from '../lib/avatar-library-events';
import { usableAvatar, type Avatar } from '../../supabase/functions/_shared/avatar-contract';
import { planReady, type VideoPlan as Plan } from '../domain/video-plan';
import { scriptText, type ScriptInput } from '../domain/scripts';

export function VideoPlan({script,plan,preview,busy,onChange,onSave,onEdit}:{script:ScriptInput;plan:Plan;preview:boolean;busy:boolean;onChange:(p:Plan)=>void;onSave:()=>void;onEdit:()=>void}) {
 const [engineValid,setEngineValid]=useState(plan.avatar_engine===undefined);
 const [avatars,setAvatars]=useState<Avatar[]>([]);
 const [loading,setLoading]=useState(!preview);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  const refresh=()=>setRetry(value=>value+1);
  const unsubscribe=subscribeAvatarLibrary(refresh);
  window.addEventListener('focus',refresh);
  return()=>{unsubscribe();window.removeEventListener('focus',refresh);};
 },[]);
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start'});},[plan.step]);
 useEffect(()=>{if(preview)return;let active=true;setLoading(true);setError('');avatarRepository.library().then(lib=>{if(active)setAvatars(lib.avatars.filter(a=>usableAvatar(a,lib.connections)));}).catch(()=>{if(active)setError('Could not load your avatar library.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[preview,retry]);
 const update=(patch:Partial<Plan>)=>onChange({...plan,...patch,...(patch.avatar_id&&patch.avatar_id!==plan.avatar_id?{avatar_engine:null,voice_engine:patch.avatar_id===STEPHEN_AVATAR?'fish' as const:'auto' as const}:{})});
 const words=scriptText(script).split(/\s+/).filter(Boolean).length;
	 const selectedAvatar=avatars.find(a=>a.id===plan.avatar_id);
	 const presenterReady=plan.presenter==='avatar'&&Boolean(selectedAvatar)&&plan.avatar_engine!==null&&engineValid;
	 const choosing=plan.step==='presenter'||plan.step==='visuals';
	 const videoSource=script.brief.kind==='video';
	 const graphicSource=script.brief.kind==='graphic';
	 const backgroundReady=Boolean(plan.article_capture&&plan.article_capture.source_url===script.brief.url);
 if(plan.step==='saved'&&plan.presenter==='avatar'&&!preview)return null;
 return <section className="video-plan"><h2 ref={heading} tabIndex={-1}>{plan.step==='saved'||plan.step==='review'?'Create & download':'Choose the look'}</h2>
 
 {(plan.step==='review'||(plan.step==='saved'&&plan.presenter!=='avatar'))&&<p>Presenter position: {plan.presenter_position.replace('-',' ')}</p>}
 {plan.step==='approve'&&<><h2>Approve your script</h2><p>Check the facts and your wording before choosing how it will look.</p><h3>{script.title}</h3><div className="plan-script">{scriptText(script)}</div><p>{words} words · approximately {Math.ceil(words/150*60)} seconds. Actual speech timing may vary.</p><button className="button" disabled={busy||!script.body.trim()} onClick={()=>update({approved_at:new Date().toISOString(),step:'presenter'})}>Approve & choose presenter →</button><button disabled={busy} onClick={onEdit}>Edit script</button></>}
 {choosing&&<><div className="presenter-picker"><h3>Pick your presenter</h3>{plan.presenter!=='avatar'&&<button type="button" className="button" onClick={()=>update({presenter:'avatar'})}>Choose an avatar</button>}
 {plan.presenter==='avatar'&&<>{loading?<p>Loading presenters…</p>:error?<p role="alert">{error} <button onClick={()=>setRetry(r=>r+1)}>Retry</button></p>:avatars.length?<div className="avatar-picture-grid" aria-label="Choose a presenter">{avatars.map(a=><button type="button" key={a.id} disabled={busy} aria-pressed={plan.avatar_id===a.id} onClick={()=>update({avatar_id:a.id,avatar_name:a.name,voice:undefined})}><AvatarPicture url={a.thumbnail_url} name={a.name}/><strong>{a.name}</strong>{a.voice_name&&<small>{a.voice_name}</small>}</button>)}</div>:<p>No connected presenters yet. Connect and import one in Avatar library, then return here. Your choices stay in this workspace.</p>}</>}
 {plan.presenter==='avatar'&&<button type="button" disabled={loading||busy||preview} onClick={()=>setRetry(value=>value+1)}>Refresh presenters</button>}
 {selectedAvatar&&<AvatarEnginePicker key={`engine:${selectedAvatar.id}`} onValidity={setEngineValid} plan={plan} onChange={onChange} disabled={busy||preview} seconds={Math.ceil(words/2.5)}/>}
 {selectedAvatar&&<VoicePicker key={selectedAvatar.id} avatar={selectedAvatar} plan={plan} onChange={onChange} disabled={busy||preview}/>}
 </div></>}
	 {choosing&&<><details><summary>Video shape · {plan.format}</summary><label>Video shape<select value={plan.format} onChange={e=>update({format:e.target.value as Plan['format']})}><option value="portrait">Tall · phone video</option><option value="landscape">Wide · landscape</option><option value="square">Square</option></select></label></details>{videoSource?<PresenterPlacement plan={plan} onChange={onChange}/>:<ArticleLayout plan={plan} graphic={graphicSource} sourceUrl={script.brief.url} onChange={onChange}/>}<div className="layout-next">{!presenterReady&&<p role="status">Choose a connected presenter to continue.</p>}{graphicSource&&!backgroundReady&&<p role="status">Choose your graphic to continue.</p>}{!videoSource&&!graphicSource&&!backgroundReady&&<p role="status">A source screenshot is optional. Continue to create a presenter-only video.</p>}<button className="button" disabled={busy||loading||!presenterReady||(graphicSource&&!backgroundReady)} onClick={onSave}>{busy?'Saving…':videoSource?'Save plan & review →':'Next: create & download →'}</button><button disabled={busy} onClick={onEdit}>Back to your script</button></div></>}
	 {(plan.step==='review'||(plan.step==='saved'&&plan.presenter!=='avatar'))&&<><h2>{script.title}</h2><details><summary>Video settings & script</summary><dl className="plan-summary"><dt>Presenter</dt><dd>{plan.presenter==='self'?'You · record yourself':plan.avatar_name}</dd><dt>Format</dt><dd>{plan.format}</dd><dt>Presenter size</dt><dd>{plan.presenter_size}%</dd><dt>Background</dt><dd>{videoSource?'Source video':plan.article_capture?'Saved article screenshot':'Presenter-only'}</dd><dt>Captions</dt><dd>Not available in this export yet</dd><dt>Estimated duration</dt><dd>~{Math.ceil(words/150*60)} seconds</dd></dl>{plan.visual_notes&&<p>{plan.visual_notes}</p>}<div className="plan-script">{scriptText(script)}</div></details><button disabled={busy} onClick={()=>update({step:'visuals'})}>Edit layout</button>{plan.step!=='saved'&&<button className="button" disabled={busy||!planReady(plan)||!presenterReady} onClick={onSave}>{busy?'Saving…':'Save layout & continue'}</button>}<button disabled={busy} onClick={onEdit}>Edit script (requires reapproval)</button><small>Saving does not start a paid render.</small></>}
 {plan.step==='saved'&&plan.presenter==='avatar'&&<button type="button" disabled={busy} onClick={()=>update({step:'visuals'})}>Edit placement</button>}
 </section>;
}
