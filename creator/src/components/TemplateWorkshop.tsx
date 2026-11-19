import {useEffect,useRef,useState} from 'react';
import {mediaFetch} from '../lib/media-fetch';
import {type TemplateDesign} from '../domain/template-animation';
import {editTemplates} from '../domain/edit-templates';

export function TemplateWorkshop({onClose}:{onClose:()=>void}){
 const [designs,setDesigns]=useState<TemplateDesign[]>([]),[current,setCurrent]=useState<TemplateDesign|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [ratio,setRatio]=useState('9:16'),[html,setHtml]=useState(''),[time,setTime]=useState(1.5),[playing,setPlaying]=useState(false),[reviewed,setReviewed]=useState(false);
 const previewBox=useRef<HTMLDivElement>(null),[previewWidth,setPreviewWidth]=useState(280);
 useEffect(()=>{if(!previewBox.current)return;const observer=new ResizeObserver(entries=>setPreviewWidth(entries[0].contentRect.width));observer.observe(previewBox.current);return()=>observer.disconnect();},[current?.id,ratio]);
 const frame=useRef<HTMLIFrameElement>(null);
 const [initialId]=useState(()=>new URLSearchParams(location.search).get('templateDesign'));
 async function load(){setLoading(true);try{const r=await mediaFetch('/api/local-capture/template-designs');if(!r.ok)throw Error('Template designs could not load.');const all:TemplateDesign[]=await r.json();setDesigns(all);setCurrent(old=>all.find(d=>d.id===(old?.id??initialId))??null);if(initialId&&!all.some(d=>d.id===initialId))setError('This template design is not available in your account.');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{setHtml('');setReviewed(false);setPlaying(false);if(!current)return;const abort=new AbortController();void mediaFetch(`/api/local-capture/template-designs/${current.id}/preview?revision=${current.revision}&aspectRatio=${ratio}`,{signal:abort.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error??'Preview unavailable.');setHtml(data.html);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[current?.id,current?.revision,ratio]);
 useEffect(()=>{if(!playing)return;const start=performance.now()-time*1000;let id=0;const tick=()=>{setTime(((performance.now()-start)/1000)%5);id=requestAnimationFrame(tick);};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);},[playing]);
 const seek=()=>frame.current?.contentWindow?.postMessage({type:'vektiss-seek',time},'*');
 useEffect(seek,[time,html]);
 async function publish(enabled:boolean){if(!current||!reviewed||busy)return;setBusy(true);setError('');try{const r=await mediaFetch(`/api/local-capture/template-designs/${current.id}/publish`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:current.revision,reviewedPreview:true,publish:enabled})});const data=await r.json();if(!r.ok)throw Error(data.error??'Could not save template.');await load();setReviewed(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const width=ratio==='16:9'?1920:1080,height=ratio==='9:16'?1920:1080;
 return <section className="identity-card"><button className="button" onClick={onClose}>← Back to Studio</button><h1>Template workshop</h1><p>Work with Codex to refine animation, then review it here. Publishing updates this account’s future edit plans. Existing videos and plans keep their saved look.</p>
 <button className="button" disabled={busy||loading} onClick={()=>void load()}>Refresh designs</button>{loading&&<p role="status">Loading designs…</p>}{error&&<p role="alert">{error}</p>}
 {!loading&&!designs.length&&<p>Ask your connected assistant: “Create a Tier List animation variation with slower, cleaner item reveals. Preview it and save it for my review.”</p>}
 <label>Design<select value={current?.id??''} disabled={busy} onChange={e=>{setCurrent(designs.find(d=>d.id===e.target.value)??null);setError('');}}><option value="">Choose a design</option>{designs.map(d=><option key={d.id} value={d.id}>{d.design.name} · revision {d.revision}{d.published?' · published':''}</option>)}</select></label>
 {current&&<><h2>{current.design.name}</h2><p>{editTemplates.find(t=>t.id===current.design.template)?.name} · Draft revision {current.revision}{current.published?` · Published revision ${current.published.revision}`:' · Not published'}</p><p>{current.design.notes}</p>
 <label>Preview format<select value={ratio} onChange={e=>setRatio(e.target.value)}><option value="9:16">Portrait · 9:16</option><option value="16:9">Landscape · 16:9</option></select></label>
 <div ref={previewBox} style={{width:'100%',maxWidth:ratio==='16:9'?640:300,aspectRatio:`${width}/${height}`,position:'relative',overflow:'hidden',margin:'20px auto',background:'#10151d',borderRadius:12}}><iframe ref={frame} title="Animation design preview" sandbox="allow-scripts" srcDoc={html} onLoad={seek} style={{width,height,border:0,position:'absolute',transform:`scale(${previewWidth/width})`,transformOrigin:'top left',maxWidth:'none'}}/></div>
 <p>Five-second illustrative sample with a placeholder presenter. Final graphics follow the words in your recording.</p>
 <button className="button" disabled={!html} onClick={()=>setPlaying(p=>!p)}>{playing?'Pause':'Play animation'}</button><label>Preview time<input type="range" min="0" max="4.99" step=".01" value={time} onChange={e=>{setPlaying(false);setTime(Number(e.target.value));}}/></label>
 <details><summary>Motion settings</summary><dl>{Object.entries(current.design.animation).filter(([k])=>k!=='version').map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>
 <label><input type="checkbox" checked={reviewed} disabled={!html||busy} onChange={e=>setReviewed(e.target.checked)}/> I reviewed this revision’s animation and readability.</label>
 <button className="button primary" disabled={!reviewed||busy||!html} onClick={()=>void publish(true)}>Use this version for future videos</button>{current.published&&<button className="button" disabled={!reviewed||busy} onClick={()=>void publish(false)}>Restore built-in animation</button>}
 </>}
 </section>;
}
