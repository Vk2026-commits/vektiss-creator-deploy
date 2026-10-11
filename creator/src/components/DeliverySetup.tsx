import {useEffect,useRef,useState} from 'react';
import {deliveryFields,deliverySuggestionsSchema,emptyDelivery,type DeliveryProfile,type DeliverySuggestions} from '../domain/delivery';
import {deliveryAudio} from '../lib/delivery-audio';
import {supabase} from '../lib/supabase';
import './delivery-setup.css';

export function DeliverySetup({value,onChange,onBusy}:{value?:DeliveryProfile;onChange:(value:DeliveryProfile|undefined,skipped?:boolean)=>void;onBusy:(busy:boolean)=>void}){
 const [suggestions,setSuggestions]=useState<DeliverySuggestions>(value??emptyDelivery);
 const [clip,setClip]=useState<Blob|null>(null),[url,setUrl]=useState('');
 const [busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[starting,setStarting]=useState(false);
 const [consent,setConsent]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState(false);
 const recorder=useRef<MediaRecorder|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const alive=useRef(true),lock=useRef(false),controller=useRef<AbortController|null>(null);
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  let active=true;
  if(!supabase||value)return;
  void supabase.from('creator_delivery_analyses').select('status,created_at').order('created_at',{ascending:false}).limit(1).then(({data})=>{
   if(!active||!data?.[0])return;
   if(['processing','uncertain'].includes(data[0].status))setNotice('A previous analysis may have used processing credits. Its recording was not retained. You can enter preferences manually; nothing will retry automatically.');
   else if(data[0].status==='complete')setNotice('A previous reference was analyzed and discarded. If its preferences were not saved, enter them manually or approve a new analysis.');
  });
  return()=>{active=false;};
 },[]);
 useEffect(()=>{onBusy(busy||recording||starting);},[busy,recording,starting,onBusy]);
 useEffect(()=>{if(!clip){setUrl('');return;}const next=URL.createObjectURL(clip);setUrl(next);return()=>URL.revokeObjectURL(next);},[clip]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();clearTimeout(timer.current);if(recorder.current){recorder.current.onstop=null;if(recorder.current.state!=='inactive')recorder.current.stop();recorder.current.stream.getTracks().forEach(t=>t.stop());}};},[]);
 async function record(){
  if(lock.current||starting||recording)return;lock.current=true;setStarting(true);setError('');
  try{
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Recording is unavailable here. Upload a clip instead.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!alive.current){stream.getTracks().forEach(t=>t.stop());return;}
   const mimeType=['audio/webm;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
   let r:MediaRecorder;try{r=new MediaRecorder(stream,mimeType?{mimeType}:{});}catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
   recorder.current=r;const chunks:Blob[]=[];
   r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   r.onstop=()=>{clearTimeout(timer.current);stream.getTracks().forEach(t=>t.stop());if(alive.current){setClip(new Blob(chunks,{type:r.mimeType}));setRecording(false);setConsent(false);}chunks.length=0;};
   r.onerror=()=>{r.onstop=null;clearTimeout(timer.current);stream.getTracks().forEach(t=>t.stop());if(alive.current){setRecording(false);setError('Recording was interrupted. Upload or record again.');}};
   r.start();setClip(null);setRecording(true);timer.current=setTimeout(()=>{if(r.state==='recording')r.stop();},60000);
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Allow microphone access or upload a recording.');}
  finally{lock.current=false;if(alive.current)setStarting(false);}
 }
 async function analyze(){
  if(!clip||!consent||lock.current||!supabase)return;
  lock.current=true;setBusy(true);setError('');setNotice('');
  const abort=new AbortController();controller.current=abort;
  const timeout=setTimeout(()=>abort.abort(),120000);
  try{
   const audio=await deliveryAudio(clip);if(!alive.current||abort.signal.aborted)return;
   const {data,error:failure}=await supabase.functions.invoke('delivery-analysis',{body:audio,signal:abort.signal,headers:{'Content-Type':'audio/wav','x-request-id':crypto.randomUUID(),'x-analysis-consent':'true'}});
   if(failure){let message='Analysis could not complete. The reference was discarded; no automatic retry was made.';if(failure.context instanceof Response){const body=await failure.context.json().catch(()=>null);if(typeof body?.error==='string')message=body.error;}throw Error(message);}
   if(alive.current){setSuggestions(deliverySuggestionsSchema.parse(data.suggestions));setEditing(true);setNotice('Reference discarded. Review these suggestions; nothing changes until you approve and save your profile.');}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Analysis failed. No automatic retry was made.');}
  finally{clearTimeout(timeout);controller.current=null;lock.current=false;if(alive.current){setClip(null);if(input.current)input.current.value='';setConsent(false);setBusy(false);}}
 }
 return <section className="delivery-setup" aria-label="Personal delivery setup">
  <h3>Show us how you speak <small>Optional</small></h3>
  <p>Share a 30–60 second clip with a hook, an explanation, and a clear ending. Or enter your preferences yourself.</p>
  <p className="delivery-privacy">Analyze sends audio to OpenAI to suggest pacing, pauses and expression. Vektiss discards the reference after the attempt and saves only preferences you approve. Provider retention policies apply. This does not clone your voice or generate an avatar.</p>
  {value&&!editing&&<p role="status">Approved delivery preferences are included when you request new script drafts.</p>}
  <div className="delivery-actions"><button type="button" disabled={busy||starting} onClick={()=>recording?recorder.current?.stop():void record()}>{recording?'Stop recording':starting?'Waiting for microphone…':'Record up to 60 seconds'}</button><label className="delivery-upload">Upload audio or video<input ref={input} type="file" accept="audio/*,video/mp4,video/webm,.m4a,.MP4" disabled={busy||recording||starting} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>100*1024*1024){setError('Choose a recording under 100 MB.');return;}setClip(file);setConsent(false);setError('');}}/></label></div>
  {recording&&<p role="status">Recording. Automatically stops after 60 seconds.</p>}
  {clip&&<><audio controls src={url} aria-label="Your delivery reference"/><p>10–90 seconds · 100 MB maximum. Listen before sending.</p><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>This is my voice or I have permission. I approve one AI analysis, which may incur processing costs; the exact cost is not yet available.</label><div className="delivery-actions"><button type="button" disabled={!consent||busy} onClick={()=>void analyze()}>{busy?'Analyzing delivery…':'Analyze this recording'}</button><button type="button" disabled={busy} onClick={()=>setClip(null)}>Discard recording</button></div></>}
  <button type="button" disabled={busy||recording||starting} onClick={()=>setEditing(!editing)}>{editing?'Hide preferences':value?'Edit delivery preferences':'Enter preferences manually'}</button>
  {editing&&<div className="delivery-fields">{deliveryFields.map(field=><label key={field}>{field==='closing'?'Closing style':field[0].toUpperCase()+field.slice(1)}<textarea aria-label={field==='closing'?'Closing style':field[0].toUpperCase()+field.slice(1)} maxLength={400} value={suggestions[field]} onChange={e=>setSuggestions(s=>({...s,[field]:e.target.value}))}/></label>)}<label>Uncertainty / limitations<textarea aria-label="Uncertainty / limitations" maxLength={800} value={suggestions.uncertainty} onChange={e=>setSuggestions(s=>({...s,uncertainty:e.target.value}))}/></label><button type="button" disabled={busy} onClick={()=>{const safe=deliverySuggestionsSchema.parse(Object.fromEntries([...deliveryFields,'uncertainty'].map(k=>[k,suggestions[k as keyof DeliverySuggestions]])));onChange({...safe,version:1,approved_at:new Date().toISOString()});setEditing(false);setNotice('Preferences approved. Save creator profile to keep them. Existing videos are unchanged.');}}>Approve preferences</button></div>}
  <button type="button" disabled={busy||recording||starting} onClick={()=>{setClip(null);setEditing(false);if(!value)onChange(undefined,true);setNotice(value?'Your approved preferences are unchanged.': 'Skipped. You can add a reference later in Creator profile.');}}>Skip reference setup</button>
  {value&&<button type="button" disabled={busy} onClick={()=>{onChange(undefined,true);setSuggestions(emptyDelivery);setNotice('Save creator profile to remove delivery preferences.');}}>Remove delivery preferences</button>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
