import {useEffect,useState} from 'react';
import {catalogAvatarSchema} from '../../supabase/functions/_shared/avatar-contract';
import {avatarRepository} from '../lib/avatar-repository';
import type {VideoPlan} from '../domain/video-plan';
const options=[['avatar_iii','Avatar III — Makes your avatar speak',.60],['avatar_iv','Avatar IV — Expressive face and natural gestures',4.83],['avatar_v','Avatar V — More lifelike movement as it speaks',7.20]] as const;
export function AvatarEnginePicker({plan,onChange,disabled,seconds,onValidity}:{plan:VideoPlan;onChange:(p:VideoPlan)=>void;disabled:boolean;seconds:number;onValidity:(valid:boolean)=>void}){
 const [look,setLook]=useState<ReturnType<typeof catalogAvatarSchema.parse>|null>(null);
 const [error,setError]=useState('');const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;setLook(null);setError('');if(plan.avatar_id)void avatarRepository.renderTest({action:'engine_capabilities',avatar_id:plan.avatar_id}).then(v=>{if(live)setLook(catalogAvatarSchema.parse(v));}).catch(()=>{if(live)setError('Could not verify engines. Refresh to try again.');});return()=>{live=false;};},[plan.avatar_id,refresh]);
 useEffect(()=>{if(plan.avatar_engine===null&&look?.engines.includes('avatar_iii'))onChange({...plan,avatar_engine:'avatar_iii'});},[look,plan,onChange]);
 useEffect(()=>{onValidity(plan.avatar_engine===undefined||Boolean(look?.engines.includes(plan.avatar_engine??'')));},[look,plan.avatar_engine,onValidity]);
 const selected=options.find(o=>o[0]===(plan.avatar_engine??'avatar_iv'));
 return <section aria-label="Avatar engine" className="engine-choice"><label>Avatar engine<select disabled={disabled||!look} value={plan.avatar_engine===null?'':plan.avatar_engine??'avatar_iv'} onChange={e=>onChange({...plan,avatar_engine:e.target.value as VideoPlan['avatar_engine']})}><option value="" disabled>Choose an engine</option>{options.map(([id,label])=><option key={id} value={id} disabled={!look?.engines.includes(id)}>{label}{look&&!look.engines.includes(id)?' — unavailable':''}</option>)}</select></label>
 {selected&&plan.avatar_engine!==null&&<p className="engine-price-inline"><strong>${selected[2].toFixed(2)}/min</strong> · Digital Twin reference rate{look?.avatar_type==='digital_twin'?<small>About ${(seconds/60*selected[2]).toFixed(2)} for {seconds}s of speech. Estimate, not a guaranteed charge.</small>:<small>Exact cost unverified for this avatar. Check HeyGen pricing.</small>}</p>}
 {error&&<p role="alert">{error} <button type="button" disabled={disabled} onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>}{!look&&!error&&<p role="status">Checking engine support…</p>}
 <details><summary>Engine options</summary><p>Unavailable engines cannot be used with this avatar. Voice is selected separately. See Avatar costs in the navigation for the full comparison.</p><button type="button" disabled={disabled} onClick={()=>setRefresh(n=>n+1)}>Refresh engine options</button></details></section>;
}
