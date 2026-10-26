import {useEffect,useRef,useState} from 'react';
import type {VideoPlan} from '../domain/video-plan';
import {graphicCaptureSchema} from '../domain/video-plan';
import {mediaFetch} from '../lib/media-fetch';
import {FreePresenter} from './FreePresenter';
import {GraphicImage} from './GraphicPreview';
import {BackgroundControls} from './BackgroundControls';

export function StudioSetting({plan,onChange,disabled,preview}:{plan:VideoPlan;onChange:(p:VideoPlan)=>void;disabled:boolean;preview:boolean}){
 const [saved,setSaved]=useState<{version:number;background:VideoPlan['studio_background']|null}>({version:0,background:null});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const latest=useRef(plan);latest.current=plan;
 useEffect(()=>{if(preview)return;let live=true;void mediaFetch('/api/local-capture/template-studio').then(async r=>{if(!r.ok)throw Error('Saved studio could not load.');const data=await r.json();if(live)setSaved(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[preview]);
 async function upload(file:File){
  if(busy||disabled||preview)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('Choose a PNG, JPEG or WebP under 10 MB.');return;}
  setBusy(true);setError('');setMessage('');
  try{const r=await mediaFetch('/api/local-capture/graphic-source',{method:'POST',headers:{'Content-Type':file.type},body:file});const value=await r.json();if(!r.ok)throw Error(value.error??'Studio upload failed.');const background={...graphicCaptureSchema.parse(value),title:file.name.slice(0,2000)};onChange({...latest.current,studio_background:background});setMessage('Studio image uploaded. Save as your default to reuse it in future projects.');}
  catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setBusy(false);}
 }
 async function save(){if(!plan.studio_background||busy||disabled||preview)return;setBusy(true);setError('');try{const r=await mediaFetch('/api/local-capture/template-studio',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseVersion:saved.version,background:plan.studio_background})});const data=await r.json();if(!r.ok)throw Error(data.error??'Could not save studio.');setSaved(data);setMessage('Studio default saved for your account.');}catch(e){setError(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}}
 const shown={...plan,article_capture:plan.studio_background,screenshot_story:undefined};
 return <section className="article-layout" aria-label="Avatar setting"><h3>Choose the setting</h3><fieldset disabled={disabled||busy}><label><input type="radio" name="avatar-setting" checked={plan.setting==='original'} onChange={()=>onChange({...plan,setting:'original'})}/> Keep this avatar look’s original setting</label><label><input type="radio" name="avatar-setting" checked={plan.setting==='studio'} onChange={()=>onChange({...plan,setting:'studio'})}/> Use my studio background</label>
 {plan.setting==='original'?<p>The selected avatar look keeps its setting. No room will be generated or substituted. The template adds graphics over this footage.</p>:<><label>Upload a studio image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={preview} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/></label>{saved.background&&<button type="button" onClick={()=>onChange({...plan,studio_background:saved.background!})}>Use saved studio · {saved.background.title}</button>}{plan.studio_background&&<><FreePresenter plan={shown} onChange={p=>onChange({...p,article_capture:plan.article_capture,screenshot_story:plan.screenshot_story,studio_background:plan.studio_background})}><GraphicImage id={plan.studio_background.id} framing={plan.background_framing}/></FreePresenter><BackgroundControls plan={shown} onChange={p=>onChange({...p,article_capture:plan.article_capture,screenshot_story:plan.screenshot_story})}/><button type="button" disabled={preview} onClick={()=>void save()}>Save studio as my default</button></>}<p>Placement preview only—not a guarantee of final lighting or motion. Choose a room with a similar camera angle and lighting to the avatar. Replacement requires a clean cutout; if unavailable, your paid footage is preserved without an automatic retry.</p></>}
 </fieldset>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
