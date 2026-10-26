import {useEffect,useRef,useState} from 'react';
import {editTemplates,type EditProposal, type editStoryboard} from '../domain/edit-templates';
import {mediaFetch} from '../lib/media-fetch';
import './edit-studio.css';

type Plan={id:string;version:number;savedAt:string;proposal:EditProposal;storyboard:ReturnType<typeof editStoryboard>};
export function EditStudio({profileId,preview=false}:{profileId:string|null;preview?:boolean}){
 const [exports,setExports]=useState<{id:string;created_at:string}[]>([]);
 const [file,setFile]=useState<File|null>(null),[exportId,setExportId]=useState('');
 const [template,setTemplate]=useState('recommend'),[plan,setPlan]=useState<Plan|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [dirty,setDirty]=useState(false);
 const [rendered,setRendered]=useState<{url:string;mode:string;version:number}|null>(null);
 const [approved,setApproved]=useState(false);
 const pending=useRef(false);
 useEffect(()=>{setRendered(null);setApproved(false);},[plan?.id,plan?.version]);
 useEffect(()=>()=>{if(rendered)URL.revokeObjectURL(rendered.url);},[rendered]);
 useEffect(()=>{if(preview)return;let live=true;void mediaFetch('/api/local-capture/exports').then(async r=>{if(!r.ok)throw Error('Completed videos could not load.');const data=await r.json();if(live)setExports(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[preview]);
 async function generate(){
  if(preview||pending.current||!profileId||(!file&&!exportId))return;
  pending.current=true;setBusy(true);setError('');setPlan(null);
  try{
   const headers:Record<string,string>=file?{'Content-Type':file.type,'X-Edit-Template':template,'X-Profile-Id':profileId}:{'Content-Type':'application/json'};
   // Byte identity prevents a different upload with the same filename from resuming an old job.
   const identity=file?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join(''):exportId;
   const r=await mediaFetch('/api/local-capture/template-edit',{method:'POST',headers,body:file??JSON.stringify({profileId,template,exportId})},`edit:v2:${profileId}:${identity}:${template}`);
   const result=await r.json();if(!r.ok)throw Error(result.error??'The edit plan could not finish.');setPlan(result);setDirty(false);
  }catch(e){setError(e instanceof Error?e.message:'The edit plan could not finish.');}
  finally{pending.current=false;setBusy(false);}
 }
 async function save(){
  if(!plan||pending.current)return;
  pending.current=true;setBusy(true);setError('');
  try{
   const body=JSON.stringify({id:plan.id,baseVersion:plan.version??1,proposal:plan.proposal});
   const r=await mediaFetch('/api/local-capture/template-plan-save',{method:'POST',headers:{'Content-Type':'application/json'},body},body);
   const result=await r.json();if(!r.ok)throw Error(result.error??'Could not save the edit plan.');setPlan(result);setDirty(false);
  }catch(e){setError(e instanceof Error?e.message:'Could not save the edit plan.');}
  finally{pending.current=false;setBusy(false);}
 }
 function editLabel(index:number,node:number,value:string){
  setPlan(previous=>previous?{...previous,proposal:{...previous.proposal,beats:previous.proposal.beats.map((b,i)=>i===index&&b.graphics?{...b,graphics:{...b.graphics,nodes:b.graphics.nodes.map((n,j)=>j===node?{...n,label:value}:n)}}:b)}}:null);setDirty(true);setApproved(false);
 }
 async function render(mode:'preview'|'final'){
  if(!plan||dirty||pending.current)return;
  pending.current=true;setBusy(true);setError('');
  try{
   const body=JSON.stringify({id:plan.id,version:plan.version,mode,...(mode==='final'?{approvePreview:approved}:{})});
   const r=await mediaFetch('/api/local-capture/template-render',{method:'POST',headers:{'Content-Type':'application/json'},body},body);
   const result=await r.json();if(!r.ok)throw Error(result.error??'Could not render this edit.');
   const video=await mediaFetch(`/api/local-capture/${mode==='preview'?'template-previews':'exports'}/${result.id}`);if(!video.ok)throw Error('The render is saved, but its download could not load. Try again.');
   setRendered({url:URL.createObjectURL(await video.blob()),mode,version:plan.version});setApproved(false);
  }catch(e){setError(e instanceof Error?e.message:'Could not render this edit.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <section className="edit-studio">
  <span className="eyebrow">EDIT STUDIO · PREVIEW</span><h1>Choose the style. Let the story guide the visuals.</h1>
  <p>Use an uploaded recording or a completed Creator video. Your original speech stays unchanged.</p>
  {!profileId&&<p role="alert">Select a Content Profile first.</p>}
  <fieldset disabled={busy}><legend>1. Choose your source</legend>
   <label>Upload a video (MP4 or WebM, up to 3 minutes and 500 MB)<input type="file" accept="video/mp4,video/webm" onChange={e=>{const next=e.target.files?.[0]??null;if(next&&next.size>500*1024*1024){setError('Choose a video smaller than 500 MB.');e.target.value='';return;}setFile(next);setExportId('');setPlan(null);}}/></label>
   <label>Or choose a completed Creator video<select value={exportId} onChange={e=>{setExportId(e.target.value);setFile(null);setPlan(null);}}><option value="">Choose a completed video</option>{exports.map(x=><option key={x.id} value={x.id}>{new Date(x.created_at).toLocaleString()} · {x.id.slice(0,8)}</option>)}</select></label>
  </fieldset>
  <fieldset disabled={busy}><legend>2. Choose your direction</legend>
   <label><input type="radio" name="edit-style" checked={template==='recommend'} onChange={()=>{setTemplate('recommend');setPlan(null);}}/> Recommend a style from my video</label>
   {editTemplates.map(t=><label key={t.id} style={{display:'block',padding:'12px 0'}}><input type="radio" name="edit-style" checked={template===t.id} onChange={()=>{setTemplate(t.id);setPlan(null);}}/> <strong>{t.name}</strong> — {t.description}</label>)}
  </fieldset>
  <p>Generating a plan sends speech to the AI provider for transcription and planning and may incur a processing charge. It does not render a video or generate an avatar.</p>
  {preview&&<p>Local sample mode: planning and rendering are disabled. No charges will be made.</p>}
  <button className="button primary" disabled={preview||busy||!profileId||(!file&&!exportId)} onClick={()=>void generate()}>{busy?'Preparing your edit plan…':'Generate edit plan'}</button>
  {error&&<p role="alert">{error}</p>}
  {plan&&<section aria-label="Saved edit plan"><p role="status">{dirty?'Unsaved changes':`Edit plan saved${plan.savedAt?' at '+new Date(plan.savedAt).toLocaleString():''}`} · {editTemplates.find(t=>t.id===plan.proposal.templateId)?.name}. This is a storyboard, not a rendered video.</p>
   {plan.storyboard.map((b,i)=><article key={i} style={{padding:'16px 0',borderBottom:'1px solid #dce5ef'}}><h3>{b.start.toFixed(1)}–{b.end.toFixed(1)}s · {b.headline||`Scene ${i+1}`}</h3><blockquote>{b.spokenText}</blockquote><p><strong>Visual direction:</strong> {b.illustration}</p><p><strong>Why:</strong> {b.purpose}</p><p><strong>Motion:</strong> {b.motion}</p>{plan.proposal.beats[i].graphics?.nodes.map((n,j)=><label key={j}>Graphic label {j+1}<input disabled={busy} minLength={1} maxLength={45} value={n.label} onChange={e=>editLabel(i,j,e.target.value)}/></label>)}</article>)}
   <button className="button primary" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Working…':'Save edit plan'}</button><p>Saving makes no AI call and does not start a render.</p>
   <button className="button primary" disabled={busy||dirty} onClick={()=>void render('preview')}>Render 8-second preview</button>
   <p>Uses your original recording. Server processing uses resources, but no new avatar or AI generation is requested.</p>
   {rendered&&<><video controls src={rendered.url} style={{maxWidth:360,width:'100%'}}/><p>{rendered.mode==='preview'?'Draft preview — first 8 seconds':'Finished 1080 × 1920 MP4'}</p>{rendered.mode==='preview'&&rendered.version===plan.version&&<><label><input type="checkbox" checked={approved} disabled={busy||dirty} onChange={e=>setApproved(e.target.checked)}/> I approve this preview and the full storyboard for a final MP4 export.</label><button className="button primary" disabled={!approved||busy||dirty} onClick={()=>void render('final')}>Export full video</button></>}{rendered.mode==='final'&&<a className="button primary" href={rendered.url} download="vektiss-edited-video.mp4">Download edited video</a>}</>}
  </section>}
 </section>;
}
