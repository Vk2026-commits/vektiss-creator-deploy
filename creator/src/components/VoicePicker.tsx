import {useEffect,useRef,useState} from 'react';
import {avatarRepository} from '../lib/avatar-repository';
import type {Avatar,ProviderVoice,VoiceCatalog} from '../../supabase/functions/_shared/avatar-contract';
import type {VideoPlan} from '../domain/video-plan';
import {audioTestEngine,voiceEngineNames,voiceTestText,type VoiceEngine} from '../domain/voice-settings';
import './voice-picker.css';
export function VoicePicker({avatar,plan,onChange,disabled}:{avatar:Avatar;plan:VideoPlan;onChange:(p:VideoPlan)=>void;disabled:boolean}){
 const [kind,setKind]=useState<'private'|'public'>('private');
 const [catalog,setCatalog]=useState<VoiceCatalog>({items:[],next_token:null});
 const [refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [voice,setVoice]=useState<ProviderVoice|null>(null),[detailError,setDetailError]=useState('');
 const engine=plan.voice_engine??'auto',speed=plan.voice_speed??1;
 useEffect(()=>{let live=true;setVoice(null);setDetailError('');avatarRepository.voiceDetails(avatar.id,plan.voice?.id).then(v=>{if(live)setVoice(v);}).catch(()=>{if(live)setDetailError('Could not load voice samples or engine availability. Refresh voices to retry.');});return()=>{live=false;};},[avatar.id,plan.voice?.id,refresh]);
 useEffect(()=>{let live=true;setBusy(true);setError('');setCatalog({items:[],next_token:null});
  avatarRepository.voices(avatar.connection_id,kind).then(data=>{if(live)setCatalog(data);}).catch(e=>{if(live)setError(String(e));}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};
 },[avatar.connection_id,kind,refresh]);
 async function more(){if(!catalog.next_token||busy)return;setBusy(true);try{const next=await avatarRepository.voices(avatar.connection_id,kind,catalog.next_token);setCatalog(old=>({items:[...old.items,...next.items.filter(v=>!old.items.some(a=>a.provider_voice_id===v.provider_voice_id))],next_token:next.next_token}));}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <section className="voice-picker" aria-label="HeyGen voice"><div className="voice-controls"><label>Voice engine<select disabled={disabled} value={engine} onChange={e=>onChange({...plan,voice_engine:e.target.value as VoiceEngine})}>{Object.entries(voiceEngineNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}<option disabled value="panda">Panda · not available through HeyGen’s API</option></select></label><label>Speaking speed <strong>{speed.toFixed(2)}×</strong><input aria-label="Speaking speed" type="range" min="0.5" max="1.5" step="0.05" value={speed} disabled={disabled} onChange={e=>onChange({...plan,voice_speed:Number(e.target.value)})}/><span className="speed-labels"><span>Slower</span><span>Normal 1×</span><span>Faster</span></span></label></div><small>Saved for this video. HeyGen Studio changes do not overwrite these settings. Engines must support the selected voice; we never substitute another engine.</small>
 <label>Speaking voice<select disabled={busy||disabled} value={plan.voice?.id??''} onChange={e=>{const voice=catalog.items.find(v=>v.provider_voice_id===e.target.value);onChange({...plan,voice:voice?{id:voice.provider_voice_id,name:voice.name}:undefined});}}><option value="">Avatar default · {avatar.voice_name??'Default voice'}</option>{plan.voice&&!catalog.items.some(v=>v.provider_voice_id===plan.voice!.id)&&<option value={plan.voice.id}>{plan.voice.name}</option>}{catalog.items.map(v=><option key={v.provider_voice_id} value={v.provider_voice_id}>{v.name}{v.language?` · ${v.language}`:''} · {v.provider_voice_id.slice(-6)}</option>)}</select></label>
 {detailError&&<p role="alert">{detailError}</p>}{voice&&<VoiceListening key={`${avatar.id}:${voice.provider_voice_id}:${engine}:${speed}:${refresh}`} avatar={avatar} voice={voice} engine={engine} speed={speed} disabled={disabled}/>}
 <button type="button" disabled={busy||disabled} onClick={()=>setRefresh(n=>n+1)}>{busy?'Loading voices…':'Refresh HeyGen voices'}</button><details><summary>More voice options</summary><label>Voice library<select disabled={busy||disabled} value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="private">My HeyGen voices</option><option value="public">Public voices</option></select></label>{catalog.next_token&&<button type="button" disabled={busy||disabled} onClick={()=>void more()}>More voices</button>}</details>{!busy&&!catalog.items.length&&!error&&<small>No voices returned in this library. Try Public voices or refresh.</small>}{error&&<p role="alert">{error}</p>}</section>;
}

function VoiceListening({avatar,voice,engine,speed,disabled}:{avatar:Avatar;voice:ProviderVoice;engine:VoiceEngine;speed:number;disabled:boolean}){
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [audio,setAudio]=useState<{url:string;generated:boolean}|null>(null);
 const audioRef=useRef<HTMLAudioElement>(null),locked=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const canTest=Boolean(audioTestEngine(engine,voice.available_engines));
 async function generate(){
  if(disabled||locked.current||!consent||!canTest)return;
  locked.current=true;setBusy(true);setError('');audioRef.current?.pause();setAudio(null);
  try{const result=await avatarRepository.previewVoice(avatar.id,voice.provider_voice_id,engine,speed);if(alive.current)setAudio({url:result.audio_url,generated:true});}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not prepare the audio test.');}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 return <div className="voice-listening"><strong>Hear it first</strong>
 {voice.preview_audio_url?<><button type="button" disabled={disabled||busy} onClick={()=>{setError('');audioRef.current?.pause();setAudio({url:voice.preview_audio_url!,generated:false});}}>Listen to saved sample · no generation</button><small>Saved sample, not an engine comparison. Speed here is a playback approximation.</small></>:<small>HeyGen has no saved audio sample for this voice.</small>}
 {audio&&<><audio key={`${audio.url}:${audio.generated}`} ref={audioRef} controls preload="none" aria-label={audio.generated?'Selected engine audio test':'Saved voice sample'} src={audio.url} onPlay={e=>{e.currentTarget.playbackRate=audio.generated?1:speed;}} onError={()=>setError('Audio could not load. Try Play again or refresh voices; no new test is generated automatically.')}/><small>{audio.generated?`${voiceEngineNames[engine]} · generated at ${speed.toFixed(2)}× · press Play`:'Press Play to listen to the saved sample.'}</small></>}
 {canTest?<details><summary>Compare with an audio-only test</summary><p className="voice-test-script">{voiceTestText}</p><p>Uses {voiceEngineNames[engine]} at {speed.toFixed(2)}×. No avatar video is generated.</p><small>May use HeyGen credits. Exact audio-test cost is unknown. Repeating identical settings reuses the saved test.</small><label className="voice-consent"><input type="checkbox" checked={consent} disabled={disabled||busy} onChange={e=>setConsent(e.target.checked)}/>I approve one potentially paid audio test.</label><button type="button" className="button" disabled={disabled||busy||!consent} onClick={()=>void generate()}>{busy?'Preparing audio…':'Generate audio test'}</button></details>:<small>Audio-only engine comparison is available for compatible ElevenLabs and Starfish voices. Fish and Panda are not supported by HeyGen’s audio-test endpoint. Choose an explicit supported engine to test it.</small>}
 {busy&&<p role="status">Preparing your audio test… You can leave this screen; the request may still use credits.</p>}{error&&<p role="alert">{error}</p>}
 </div>;
}
