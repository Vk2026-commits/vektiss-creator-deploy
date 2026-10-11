import type {SupabaseClient} from '@supabase/supabase-js';
import {PublicError,type ProviderVoice} from './avatar-contract.ts';
import type {AvatarCatalogProvider} from './heygen.ts';
import {audioTestEngine,voiceTestText,type VoiceEngine} from '../../../src/domain/voice-settings.ts';

export function speechTestPayload(voice:ProviderVoice,engine:VoiceEngine,speed:number){
 const resolved=audioTestEngine(engine,voice.available_engines);
 if(!resolved)throw new PublicError('VOICE_TEST_UNSUPPORTED','Audio-only testing is not available for this engine and voice. Choose an available ElevenLabs or Starfish engine, or listen to the saved voice sample. No credits were used.',400);
 return {voice_id:voice.provider_voice_id,text:voiceTestText,engine:resolved,speed,...(engine==='elevenlabs_v3'?{settings:{model_id:'eleven_v3'}}:{})};
}
export async function previewVoice(db:SupabaseClient,user:string,connection:string,provider:AvatarCatalogProvider,voice:ProviderVoice,engine:VoiceEngine,speed:number){
 const settings=speechTestPayload(voice,engine,speed);
 if(!provider.previewSpeech)throw new PublicError('UNAVAILABLE','Audio testing is unavailable.',503);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(settings)));
 const revision=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const prior=await db.from('creator_voice_previews').select('status,result').eq('user_id',user).eq('connection_id',connection).eq('revision',revision).maybeSingle();
 if(prior.error)throw new PublicError('STORAGE','Audio tests are unavailable. No test was started.',503);
 if(prior.data){
  if(prior.data.status==='completed')return prior.data.result;
  throw new PublicError('VOICE_TEST_PENDING','This audio test was already submitted. Wait and check again. If it stays unavailable, contact support before another paid attempt.',409);
 }
 const id=crypto.randomUUID();
 const reserved=await db.from('creator_voice_previews').insert({id,user_id:user,connection_id:connection,revision,settings});
 if(reserved.error)throw new PublicError('VOICE_TEST_PENDING','An audio test may already be starting. Wait and check again; no duplicate was submitted.',409);
 try{
  const result=await provider.previewSpeech(settings);
  if(result.engine!==settings.engine&&!(settings.engine==='elevenlabs'&&result.engine==='elevenlabs_v3'))throw Error('Engine mismatch');
  const saved=await db.from('creator_voice_previews').update({status:'completed',result}).eq('id',id).eq('user_id',user);
  if(saved.error)throw Error('Could not save audio result');
  return result;
 }catch{
  await db.from('creator_voice_previews').update({status:'uncertain'}).eq('id',id).eq('user_id',user);
  throw new PublicError('VOICE_TEST_UNCERTAIN','The audio test could not be confirmed. It may have used HeyGen credits. No automatic retry was made; check HeyGen or contact support before trying again.',502);
 }
}
