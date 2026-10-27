import {useEffect,useRef,useState} from 'react';
import {TemplateChooser} from './TemplateChooser';
import {EditSceneControls} from './EditSceneControls';
import {editTemplates,type EditProposal, type editStoryboard} from '../domain/edit-templates';
import {mediaFetch} from '../lib/media-fetch';
import {editVideoUploadType} from '../domain/upload-type';
import './edit-studio.css';
import {defaultEditBrand,captionStyles,editBrandSchema,type EditBrand} from '../domain/edit-brand';
import {editDimensions,type EditAspectRatio} from '../domain/edit-format';
import {LogoReview,type LogoChoice} from './LogoReview';

type Plan={id:string;version:number;savedAt:string;brand?:EditBrand;logos?:LogoChoice[];proposal:EditProposal;storyboard:ReturnType<typeof editStoryboard>};
export function EditStudio({profileId,preview=false,initialExportId='',initialTemplate='recommend',initialBrand,onCreateAvatar}:{profileId:string|null;preview?:boolean;initialExportId?:string;initialTemplate?:string;initialBrand?:EditBrand;onCreateAvatar?:()=>void}){
 const [exports,setExports]=useState<{id:string;created_at:string}[]>([]);
 const [file,setFile]=useState<File|null>(null),[exportId,setExportId]=useState(initialExportId);
 const [template,setTemplate]=useState(initialTemplate),[plan,setPlan]=useState<Plan|null>(null);
 const [aspectRatio,setAspectRatio]=useState<EditAspectRatio>('9:16');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [dirty,setDirty]=useState(false);
 const [rendered,setRendered]=useState<{url:string;mode:string;version:number}|null>(null);
 const pending=useRef(false);
 const [savedEdits,setSavedEdits]=useState<{id:string;savedAt:string;templateId:string;title:string}[]>([]);
 const [savedError,setSavedError]=useState('');
 const [savedLoading,setSavedLoading]=useState(!preview);
 useEffect(()=>{if(preview)return;let live=true;setSavedLoading(true);void mediaFetch('/api/local-capture/template-plans').then(async r=>{if(!r.ok)throw Error('Saved edits could not load. Please reopen Edit Studio to retry.');const data=await r.json();if(live){setSavedEdits(data);setSavedError('');}}).catch(e=>{if(live)setSavedError(e.message);}).finally(()=>{if(live)setSavedLoading(false);});return()=>{live=false;};},[preview,plan?.id,plan?.version]);
 async function openSavedEdit(id:string){
  if(pending.current||dirty)return;
  pending.current=true;setBusy(true);setError('');
  try{const response=await mediaFetch(`/api/local-capture/template-plans/${id}`);if(!response.ok)throw Error('This saved edit could not open. Please try again.');const saved:Plan=await response.json();setPlan(saved);setTemplate(saved.proposal.templateId);setAspectRatio(saved.proposal.aspectRatio??'9:16');setDirty(false);}
  catch(e){setError(e instanceof Error?e.message:'Saved edit could not open.');}
  finally{pending.current=false;setBusy(false);}
 }
 const [brand,setBrand]=useState<EditBrand>(initialBrand??defaultEditBrand);
 const [brandRecord,setBrandRecord]=useState({version:0,savedAt:'',brand:defaultEditBrand});
 const [brandLoaded,setBrandLoaded]=useState(preview);
 const brandDirty=JSON.stringify(brand)!==JSON.stringify(brandRecord.brand);
 const brandValid=editBrandSchema.safeParse(brand).success;
 useEffect(()=>{if(preview)return;let live=true;void mediaFetch('/api/local-capture/template-brand').then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error??'Brand settings could not load.');if(live){setBrandRecord({...data,brand:initialBrand??data.brand});setBrand(initialBrand??data.brand);setBrandLoaded(true);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[preview]);
 async function saveBrand(){
  if(preview||pending.current||!brandLoaded||!brandValid)return;
  pending.current=true;setBusy(true);setError('');
  try{const r=await mediaFetch('/api/local-capture/template-brand',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseVersion:brandRecord.version,brand})});const data=await r.json();if(!r.ok)throw Error(data.error??'Brand settings could not save.');setBrandRecord(data);setBrand(data.brand);}
  catch(e){setError(e instanceof Error?e.message:'Brand settings could not save.');}finally{pending.current=false;setBusy(false);}
 }
 useEffect(()=>{setRendered(null);},[plan?.id,plan?.version]);
 useEffect(()=>()=>{if(rendered)URL.revokeObjectURL(rendered.url);},[rendered]);
 useEffect(()=>{if(preview)return;let live=true;void mediaFetch('/api/local-capture/exports').then(async r=>{if(!r.ok)throw Error('Completed videos could not load.');const data=await r.json();if(live)setExports(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[preview]);
 async function generate(){
  if(preview||pending.current||!profileId||(!file&&!exportId))return;
  pending.current=true;setBusy(true);setError('');setPlan(null);
  try{
   const headers:Record<string,string>=file?{'Content-Type':editVideoUploadType(file),'X-Edit-Template':template,'X-Edit-Aspect-Ratio':aspectRatio,'X-Edit-Brand':JSON.stringify(brand),'X-Profile-Id':profileId}:{'Content-Type':'application/json'};
   // Byte identity prevents a different upload with the same filename from resuming an old job.
   const identity=file?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join(''):exportId;
   const r=await mediaFetch('/api/local-capture/template-edit',{method:'POST',headers,body:file??JSON.stringify({profileId,template,exportId,brand,aspectRatio})},`edit:v5:${profileId}:${identity}:${template}:${aspectRatio}:${JSON.stringify(brand)}`);
   const result=await r.json();if(!r.ok)throw Error(result.error??'The edit plan could not finish.');
   const latest=await mediaFetch(`/api/local-capture/template-plans/${result.id}`);if(!latest.ok)throw Error('The plan is saved, but could not reload. Retry to recover it.');setPlan(await latest.json());setDirty(false);
  }catch(e){setError(e instanceof Error?e.message:'The edit plan could not finish.');}
  finally{pending.current=false;setBusy(false);}
 }
 async function save(){
  if(!plan||pending.current)return;
  if(plan.proposal.beats.some(b=>b.visual!=='presenter'&&!(b.visual==='typography'&&b.headline.trim())&&!b.graphics?.chart&&(!b.graphics?.nodes.length||b.graphics.nodes.some(n=>!n.label.trim())))){setError('Add text to each graphic, or choose Presenter only for sections without elements.');return;}
  pending.current=true;setBusy(true);setError('');
  try{
   const body=JSON.stringify({id:plan.id,baseVersion:plan.version??1,proposal:plan.proposal,brand:plan.brand??defaultEditBrand,...(plan.logos?{logos:plan.logos.map(({brandId,status,replacementId})=>({brandId,status,...(replacementId?{replacementId}:{})}))}:{})});
   const r=await mediaFetch('/api/local-capture/template-plan-save',{method:'POST',headers:{'Content-Type':'application/json'},body},body);
   const result=await r.json();if(!r.ok)throw Error(result.error??'Could not save the edit plan.');setPlan(result);setDirty(false);
  }catch(e){setError(e instanceof Error?e.message:'Could not save the edit plan.');}
  finally{pending.current=false;setBusy(false);}
 }
 function editBeat(index:number,beat:EditProposal['beats'][number]){
  setPlan(previous=>previous?{...previous,proposal:{...previous.proposal,rendererVersion:2,beats:previous.proposal.beats.map((b,i)=>i===index?beat:b)}}:null);setDirty(true);setRendered(null);
 }
 async function render(mode:'preview'|'final'){
  if(!plan||dirty||pending.current||plan.logos?.some(l=>l.status==='pending'))return;
  pending.current=true;setBusy(true);setError('');
  try{
   const body=JSON.stringify({id:plan.id,version:plan.version,mode});
   const r=await mediaFetch('/api/local-capture/template-render',{method:'POST',headers:{'Content-Type':'application/json'},body},body);
   const result=await r.json();if(!r.ok)throw Error(result.error??'Could not render this edit.');
   const video=await mediaFetch(`/api/local-capture/${mode==='preview'?'template-previews':'exports'}/${result.id}`);if(!video.ok)throw Error('The render is saved, but its download could not load. Try again.');
   setRendered({url:URL.createObjectURL(await video.blob()),mode,version:plan.version});
  }catch(e){setError(e instanceof Error?e.message:'Could not render this edit.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <section className="edit-studio">
  <span className="eyebrow">EDIT STUDIO</span><h1>Your talking-head video. Your visuals.</h1>
  <p>Use your own recording or an avatar video. The templates add graphics and captions while preserving the recorded speech and approved setting.</p>
  <section aria-label="Saved edits"><h2>Saved edits</h2><p>Reopen an edit from this account on any device. Opening it does not generate a plan or start a render.</p>
   {savedLoading&&<p role="status">Loading saved edits…</p>}
   {savedError&&<p role="alert">{savedError}</p>}
   {!savedLoading&&!savedError&&!savedEdits.length&&<p>No saved edits yet.</p>}
   {dirty&&<p>Save your current edit before opening another.</p>}
   {savedEdits.map(edit=><article key={edit.id}><h3>{edit.title}</h3><p>{editTemplates.find(t=>t.id===edit.templateId)?.name} · {edit.savedAt?new Date(edit.savedAt).toLocaleString():'Saved edit'}</p><button className="button" disabled={busy||dirty} onClick={()=>void openSavedEdit(edit.id)}>{plan?.id===edit.id?'Open edit shown below':'Open saved edit'}</button></article>)}
  </section>
  {onCreateAvatar&&<div><button type="button" className="button primary" onClick={onCreateAvatar}>Use my avatar · create a script →</button><p>Choose your Content Profile, topic or Discover source, approve your script, then choose the avatar and its setting. Or upload your own footage below.</p></div>}
  {!profileId&&<p role="alert">Select a Content Profile first.</p>}
  <fieldset disabled={busy}><legend>1. Choose your source</legend>
   <label>Upload a video (MP4 or WebM, up to 3 minutes and 500 MB)<input type="file" accept="video/mp4,video/webm" onChange={e=>{const next=e.target.files?.[0]??null;if(next&&next.size>500*1024*1024){setError('Choose a video smaller than 500 MB.');e.target.value='';return;}setFile(next);setExportId('');setPlan(null);}}/></label>
   <label>Or choose a completed Creator video<select value={exportId} onChange={e=>{setExportId(e.target.value);setFile(null);setPlan(null);}}><option value="">Choose a completed video</option>{exports.map(x=><option key={x.id} value={x.id}>{new Date(x.created_at).toLocaleString()} · {x.id.slice(0,8)}</option>)}</select></label>
  </fieldset>
  <fieldset disabled={busy||!brandLoaded}><legend>2. Brand colors & captions</legend>
   <p>Saved for your creator account. New plans use these defaults; existing edits keep their saved look.</p>
   <div className="edit-brand-colors">{([['primary','Brand accent'],['background','Background'],['text','Text']] as const).map(([key,label])=><div key={key}><label>{label}<input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(brand[key])?brand[key]:brandRecord.brand[key]} onChange={e=>setBrand({...brand,[key]:e.target.value.toUpperCase()})}/></label><label><span className="sr-only">{label} hex code</span><input type="text" aria-label={`${label} hex code`} aria-invalid={!/^#[0-9a-f]{6}$/i.test(brand[key])} aria-describedby="brand-hex-help" placeholder="#671816" value={brand[key]} spellCheck={false} autoComplete="off" onChange={e=>{const value=e.target.value.trim();setBrand({...brand,[key]:/^[0-9a-f]{6}$/i.test(value)?`#${value.toUpperCase()}`:value.toUpperCase()});}}/></label></div>)}</div>
   <p id="brand-hex-help">Type or paste a six-digit hex code, with or without # (for example, #671816).</p>
   {!brandValid&&<p role="alert">Complete each color with six hexadecimal digits (0–9 or A–F) before saving.</p>}
   <label>Caption style<select value={brand.captionStyle} onChange={e=>setBrand({...brand,captionStyle:e.target.value as EditBrand['captionStyle']})}>{captionStyles.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <p>{captionStyles.find(s=>s.id===brand.captionStyle)?.description}</p>
   <div className={`edit-caption-sample caption-${brand.captionStyle}`} style={{background:brand.background,color:brand.text,borderColor:brand.primary}} aria-label="Caption style sample">{brand.captionStyle==='none'?'Captions turned off':<>Create <span style={{color:brand.captionStyle==='highlight'?brand.primary:brand.text}}>real value</span> with your ideas.</>}</div>
   <button className="button primary" disabled={preview||!brandDirty||!brandValid} onClick={()=>void saveBrand()}>Save brand defaults</button>
   <p role="status">{brandDirty?'Unsaved brand changes':brandRecord.savedAt?`Brand defaults saved at ${new Date(brandRecord.savedAt).toLocaleString()}`:'Default colors — customize and save your brand.'} Saving does not make an AI call or start a render.</p>
   {plan&&<button className="button" disabled={!brandValid} onClick={()=>{setPlan({...plan,brand:{...brand}});setDirty(true);setRendered(null);}}>Apply these settings to this edit</button>}
  </fieldset>
  <fieldset disabled={busy}><legend>3. Choose your direction</legend>
   <label>Video format<select value={plan?.proposal.aspectRatio??aspectRatio} onChange={e=>{const ratio=e.target.value as EditAspectRatio;setAspectRatio(ratio);if(plan){setPlan({...plan,proposal:{...plan.proposal,rendererVersion:2,aspectRatio:ratio}});setDirty(true);setRendered(null);}}}><option value="9:16">Vertical · 9:16 · 1080 × 1920</option><option value="16:9">Widescreen · 16:9 · 1920 × 1080</option></select></label>
   <p>Changing format adapts the layout without a new AI or avatar call. Save your changes, then export. Previewing is optional.</p>
   <label><input type="radio" name="edit-style" checked={template==='recommend'} onChange={()=>{setTemplate('recommend');setPlan(null);}}/> Recommend a style from my video</label>
   <TemplateChooser file={file} aspectRatio={plan?.proposal.aspectRatio??aspectRatio} brand={brandValid?brand:brandRecord.brand} selected={template} onSelect={id=>{setTemplate(id);setPlan(null);}}/>
  </fieldset>
  <p>Generating a plan sends speech to the AI provider for transcription and planning and may incur a processing charge. It does not render a video or generate an avatar.</p>
  {preview&&<p>Local sample mode: planning and rendering are disabled. No charges will be made.</p>}
  {brandDirty&&<p>Save your brand defaults before generating a new plan.</p>}
  <button className="button primary" disabled={preview||busy||!brandLoaded||brandDirty||!brandValid||!profileId||(!file&&!exportId)} onClick={()=>void generate()}>{busy?'Working…':'Generate edit plan'}</button>
  {error&&<p role="alert">{error}</p>}
  {plan&&<section aria-label="Saved edit plan"><p role="status">{dirty?'Unsaved changes':`Edit plan saved${plan.savedAt?' at '+new Date(plan.savedAt).toLocaleString():''}`} · {editTemplates.find(t=>t.id===plan.proposal.templateId)?.name}. This is a storyboard, not a rendered video.</p>
   <p>This edit: {captionStyles.find(s=>s.id===(plan.brand??defaultEditBrand).captionStyle)?.name} · Accent {(plan.brand??defaultEditBrand).primary} · Background {(plan.brand??defaultEditBrand).background} · Text {(plan.brand??defaultEditBrand).text}</p>
   <p>AI suggests the first edit. Change the elements below, or choose presenter only for any section.</p>
   {plan.proposal.templateId==='clean-tech'&&<LogoReview logos={plan.logos??[]} busy={busy} onChange={logos=>{setPlan({...plan,logos});setDirty(true);setRendered(null);}}/>}
   {plan.logos?.some(l=>l.status==='pending')&&<p>Review each suggested logo and save before exporting.</p>}
   {plan.storyboard.map((b,i)=><article key={i} style={{padding:'16px 0',borderBottom:'1px solid #dce5ef'}}><h3>{b.start.toFixed(1)}–{b.end.toFixed(1)}s · {plan.proposal.beats[i].headline||`Scene ${i+1}`}</h3><blockquote>{b.spokenText}</blockquote><p><strong>Visual direction:</strong> {plan.proposal.beats[i].illustration}</p><p><strong>Why:</strong> {b.purpose}</p><EditSceneControls beat={plan.proposal.beats[i]} busy={busy} onChange={beat=>editBeat(i,beat)}/></article>)}
   <button className="button primary" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Working…':'Save edit plan'}</button><p>Saving makes no AI call and does not start a render.</p>
   <button className="button" disabled={busy||dirty||plan.logos?.some(l=>l.status==='pending')} onClick={()=>void render('preview')}>Preview full video · optional</button>
   <button className="button primary" disabled={busy||dirty||plan.logos?.some(l=>l.status==='pending')} onClick={()=>void render('final')}>Export full video</button>
   <p>Uses your original recording. Server processing uses resources, but no new avatar or AI generation is requested.</p>
   {rendered&&<><video controls src={rendered.url} style={{maxWidth:plan.proposal.aspectRatio==='16:9'?800:360,width:'100%'}}/><p>{rendered.mode==='preview'?'Full-video draft preview · reduced resolution':`Finished ${editDimensions(plan.proposal.aspectRatio).width} × ${editDimensions(plan.proposal.aspectRatio).height} MP4`}</p>{rendered.mode==='final'&&<a className="button primary" href={rendered.url} download="vektiss-edited-video.mp4">Download edited video</a>}</>}
  </section>}
 </section>;
}
