import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { scriptAI } from '../lib/script-ai';
import { analyzeVideo } from '../lib/video-analysis';
import './voice-note.css';

export function VoiceNote({ projectId, profileId, onText, disabled = false, label = 'Voice note', uploadOnly = false }: {projectId?:string;profileId:string;onText:(text:string)=>void;disabled?:boolean;label?:string;uploadOnly?:boolean}) {
 const recorder=useRef<MediaRecorder|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const ticker=useRef<ReturnType<typeof setInterval>|undefined>(undefined);
 const animation=useRef(0);
 const context=useRef<AudioContext|null>(null);
 const waveform=useRef<HTMLDivElement>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 const alive=useRef(true);
 const callback=useRef(onText);
 callback.current=onText;
 const [recording,setRecording]=useState(false);
 const [starting,setStarting]=useState(false);
 const [seconds,setSeconds]=useState(0);
 const [clip,setClip]=useState<Blob|null>(null);
 const [url,setUrl]=useState('');
 const [busy,setBusy]=useState(false);
 const [added,setAdded]=useState(false);
 const [error,setError]=useState('');
 function releaseAudio(){
  clearTimeout(timer.current);clearInterval(ticker.current);cancelAnimationFrame(animation.current);
  recorder.current?.stream.getTracks().forEach(t=>t.stop());
  if(context.current){void context.current.close().catch(()=>{});context.current=null;}
  waveform.current?.querySelectorAll<HTMLElement>('span').forEach(bar=>bar.style.height='4px');
 }
 useEffect(()=>{
  if(!recording&&!clip&&!busy)return;
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[recording,clip,busy]);
 useEffect(()=>{if(!clip){setUrl('');return;}const value=URL.createObjectURL(clip);setUrl(value);return()=>URL.revokeObjectURL(value);},[clip]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(recorder.current){recorder.current.onstop=null;if(recorder.current.state==='recording')recorder.current.stop();}releaseAudio();};},[]);
 async function transcribe(audio:Blob){
  if(!audio.size){setError('No audio was captured. Please try again.');return;}
  if(audio.size>(uploadOnly?500:10)*1024*1024){setError(uploadOnly?'Choose a source video up to 500 MB.':'Recording exceeds 10 MB. Upload a shorter clip.');return;}
  setBusy(true);setError('');
  try{
   const data=await (uploadOnly?analyzeVideo(audio,profileId):scriptAI('transcribe',profileId,undefined,audio,projectId));
   if(!alive.current)return;
   if(typeof data.text!=='string'||!data.text.trim())throw Error('No speech was detected. Try a clearer recording.');
   callback.current(data.text);setClip(null);setAdded(true);
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Transcription failed. Your recording is still here.');}
  finally{if(alive.current)setBusy(false);}
 }
 async function record(){
  if(starting||recording||busy)return;
  if(clip&&!window.confirm('Replace the untranscribed recording? Download it first if you want to keep it.'))return;
  setStarting(true);setError('');setAdded(false);
  try{
   if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia)throw Error('Unsupported');
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!alive.current){stream.getTracks().forEach(t=>t.stop());return;}
   let r:MediaRecorder;
   try{
    const mimeType=['audio/webm;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
    r=new MediaRecorder(stream,mimeType?{mimeType}:{});
   }catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
   recorder.current=r;
   const chunks:Blob[]=[];
   r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   r.onstop=()=>{
    releaseAudio();if(!alive.current)return;
    const audio=new Blob(chunks,{type:r.mimeType});setClip(audio);setRecording(false);
    void transcribe(audio);
   };
   r.onerror=()=>{r.onstop=null;if(r.state==='recording')r.stop();releaseAudio();setRecording(false);setError('Recording was interrupted. Please try again or upload audio.');};
   r.start();setClip(null);setSeconds(0);setRecording(true);
   const started=performance.now();
   ticker.current=setInterval(()=>setSeconds(Math.min(180,Math.floor((performance.now()-started)/1000))),250);
   timer.current=setTimeout(()=>{if(r.state==='recording')r.stop();},180000);
   // Visualization uses actual microphone samples; failure never interrupts capture.
   try{
    const ac=new AudioContext();context.current=ac;void ac.resume().catch(()=>{});
    const analyser=ac.createAnalyser();analyser.fftSize=256;
    ac.createMediaStreamSource(stream).connect(analyser);
    const samples=new Uint8Array(analyser.frequencyBinCount);
    const draw=()=>{
     if(!alive.current||r.state!=='recording')return;
     analyser.getByteFrequencyData(samples);
     const bars=waveform.current?.querySelectorAll<HTMLElement>('span');
     bars?.forEach((bar,i)=>{const value=samples[Math.floor(i*samples.length/bars.length)]/255;bar.style.height=`${4+value*48}px`;});
     animation.current=requestAnimationFrame(draw);
    };draw();
   }catch{ /* Timer and audio recording continue without visualizer support. */ }
  }catch{releaseAudio();setError('Microphone unavailable. Allow microphone access, upload a recording, or type your notes.');}
  finally{if(alive.current)setStarting(false);}
 }
 const clock=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 return <section className={`voice-note voice-recorder ${recording?'is-recording':''}`} aria-label={label}>
  <div className="voice-heading"><span className="voice-eyebrow">{uploadOnly?'YOUR SOURCE VIDEO':'YOUR VOICE, YOUR PERSPECTIVE'}</span><span className="voice-limit">{uploadOnly?'3 min · 500 MB max':'3 min max'}</span></div>
  <h3>{label}</h3>
  <p className="voice-help">{uploadOnly?'Choose an MP4 or WebM video, then analyze its visuals, on-screen text, and audio. Your perspective comes next.':'Tap the mic and talk naturally. Stop when you’re done—we’ll turn your words into editable notes.'}</p>
  {!uploadOnly&&<div className="voice-capture">
   <button className="voice-mic" type="button" disabled={!recording&&(busy||starting||disabled||!profileId)} aria-label={recording?'Stop recording and transcribe':'Record voice note'} onClick={()=>recording?recorder.current?.stop():void record()}>
    {busy||starting?<LoaderCircle className="voice-spinner" size={25}/>:recording?<Square fill="currentColor" size={22}/>:<Mic size={28}/>}
   </button>
   <div className="voice-meter"><div ref={waveform} className="voice-waveform" aria-hidden="true">{Array.from({length:40},(_,i)=><span key={i}/>)}</div><div className="voice-meter-caption"><span role="status">{busy?'Turning your voice into words…':starting?'Waiting for microphone…':recording?'Recording · tap stop to transcribe':added?'Transcript added to your notes':'Ready when you are'}</span><time>{clock} / 3:00</time></div></div>
  </div>}
  {added&&<p className="voice-success" role="status"><CheckCircle2 size={16}/> {uploadOnly?'Video analysis added below. Select Summarize source to continue.':'Transcript added below. Review it, then continue.'}</p>}
  {clip&&<div className="voice-playback"><audio controls src={url}/><div><a href={url} download="creator-note">Download recording</a><button type="button" disabled={busy||disabled||!profileId} onClick={()=>void transcribe(clip)}>{busy?(uploadOnly?'Analyzing video…':'Transcribing…'):(uploadOnly?'Analyze video':'Transcribe recording')}</button></div><small>The recording stays in this tab. Download a copy before leaving.</small></div>}
  {clip instanceof File&&<p role="status">Selected: {clip.name}</p>}
  <div className="voice-upload">{!uploadOnly&&<span>Already recorded it?</span>}<button className={uploadOnly?'button':undefined} type="button" disabled={busy||recording||starting||disabled} onClick={()=>fileInput.current?.click()}><Upload size={20}/> {uploadOnly?'Upload video':'Upload audio or video'}</button><input ref={fileInput} className="voice-file-input" type="file" aria-label={uploadOnly?'Upload source video':'Upload recording'} accept={uploadOnly?'video/mp4,video/webm':'audio/*,video/mp4,video/webm'} disabled={busy||recording||starting||disabled} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>(uploadOnly?500:10)*1024*1024){setError(uploadOnly?'Choose a source video up to 500 MB.':'Choose a recording under 10 MB.');return;}if(clip&&!window.confirm('Replace your untranscribed recording?'))return;setClip(f);setError('');setAdded(false);}}/></div>
  <small className="voice-privacy">{uploadOnly?'Analyze video sends audio and eight sampled frames to OpenAI. Sampling may miss details.':'Recordings are sent to OpenAI for speech-to-text when you stop. Uploads are sent when you select Transcribe. Up to 10 MB.'}</small>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
