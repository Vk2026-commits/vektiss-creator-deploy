import {useEffect,useState} from 'react';
import {avatarRepository} from '../lib/avatar-repository';
import type {Avatar,VoiceCatalog} from '../../supabase/functions/_shared/avatar-contract';
import type {VideoPlan} from '../domain/video-plan';
export function VoicePicker({avatar,plan,onChange,disabled}:{avatar:Avatar;plan:VideoPlan;onChange:(p:VideoPlan)=>void;disabled:boolean}){
 const [kind,setKind]=useState<'private'|'public'>('private');
 const [catalog,setCatalog]=useState<VoiceCatalog>({items:[],next_token:null});
 const [refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;setBusy(true);setError('');setCatalog({items:[],next_token:null});
  avatarRepository.voices(avatar.connection_id,kind).then(data=>{if(live)setCatalog(data);}).catch(e=>{if(live)setError(String(e));}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};
 },[avatar.connection_id,kind,refresh]);
 async function more(){if(!catalog.next_token||busy)return;setBusy(true);try{const next=await avatarRepository.voices(avatar.connection_id,kind,catalog.next_token);setCatalog(old=>({items:[...old.items,...next.items.filter(v=>!old.items.some(a=>a.provider_voice_id===v.provider_voice_id))],next_token:next.next_token}));}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <section aria-label="HeyGen voice"><label>Voice engine<select disabled={disabled} value={plan.voice_engine??'auto'} onChange={e=>onChange({...plan,voice_engine:e.target.value as 'auto'|'fish'})}><option value="auto">HeyGen default</option><option value="fish">Fish</option></select></label><small>Fish requires a compatible HeyGen voice. We will not switch engines automatically.</small>
 <label>Speaking voice<select disabled={busy||disabled} value={plan.voice?.id??''} onChange={e=>{const voice=catalog.items.find(v=>v.provider_voice_id===e.target.value);onChange({...plan,voice:voice?{id:voice.provider_voice_id,name:voice.name}:undefined});}}><option value="">Avatar default · {avatar.voice_name??'Default voice'}</option>{plan.voice&&!catalog.items.some(v=>v.provider_voice_id===plan.voice!.id)&&<option value={plan.voice.id}>{plan.voice.name}</option>}{catalog.items.map(v=><option key={v.provider_voice_id} value={v.provider_voice_id}>{v.name}{v.language?` · ${v.language}`:''} · {v.provider_voice_id.slice(-6)}</option>)}</select></label>
 <details><summary>More voice options</summary><label>Voice library<select disabled={busy||disabled} value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="private">My HeyGen voices</option><option value="public">Public voices</option></select></label><button type="button" disabled={busy||disabled} onClick={()=>setRefresh(n=>n+1)}>{busy?'Loading voices…':'Refresh HeyGen voices'}</button>{catalog.next_token&&<button type="button" disabled={busy||disabled} onClick={()=>void more()}>More voices</button>}</details>{!busy&&!catalog.items.length&&!error&&<small>No voices returned in this library. Try Public voices or refresh under More voice options.</small>}{error&&<p role="alert">{error}</p>}</section>;
}
