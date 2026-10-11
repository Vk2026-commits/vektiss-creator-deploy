import {describe,it,expect,vi} from 'vitest';
import {voiceEngineSchema,voiceSpeedSchema,audioTestEngine,videoVoiceSettings} from '../src/domain/voice-settings';
import {videoPlanSchema,newVideoPlan} from '../src/domain/video-plan';
import {avatarCommandSchema} from '../supabase/functions/_shared/avatar-contract';
import {HeyGenCatalog} from '../supabase/functions/_shared/heygen';
import {speechTestPayload,previewVoice} from '../supabase/functions/_shared/voice-preview';
import {testPayload} from '../supabase/functions/_shared/presenter-test';
const voice={provider_voice_id:'voice',name:'Rose',language:'English',available_engines:['starfish','elevenlabs']};
describe('voice controls',()=>{
 it('preserves legacy rendering at normal speed',()=>{expect(videoVoiceSettings()).toEqual({});expect(videoVoiceSettings('fish')).toEqual({engine_settings:{engine_type:'fish'}});expect(videoPlanSchema.parse(newVideoPlan())).not.toHaveProperty('voice_speed');});
 it.each(['panda','orca','unknown'])('does not pretend %s is a supported video override',e=>expect(voiceEngineSchema.safeParse(e).success).toBe(false));
 it.each([0,.49,1.51,Infinity,NaN])('rejects unsafe speed %s',s=>expect(voiceSpeedSchema.safeParse(s).success).toBe(false));
 it('maps ElevenLabs v3 consistently for speech and video',()=>{
  expect(speechTestPayload(voice,'elevenlabs_v3',1.15)).toMatchObject({engine:'elevenlabs',speed:1.15,settings:{model_id:'eleven_v3'}});
  expect(testPayload({avatar_id:'a',voice_id:'v',script:'hello',aspect_ratio:'9:16',voice_engine:'elevenlabs_v3',voice_speed:1.15})).toMatchObject({voice_settings:{speed:1.15,engine_settings:{engine_type:'elevenlabs',model:'eleven_v3'}}});
 });
 it('does not substitute engines in unsupported audio tests',()=>{expect(audioTestEngine('fish',voice.available_engines)).toBeNull();expect(()=>speechTestPayload(voice,'auto',1)).toThrow();expect(()=>speechTestPayload({...voice,available_engines:[]},'starfish',1)).toThrow();});
 it('requires consent and a bounded speed before the service runs',()=>{const cmd={action:'preview_voice',avatar_id:'11111111-1111-4111-8111-111111111111',engine:'starfish',speed:1};expect(avatarCommandSchema.safeParse(cmd).success).toBe(false);expect(avatarCommandSchema.safeParse({...cmd,paid_consent:true}).success).toBe(true);});
 it('retains preview and supported engines, removing unsafe sample URLs',async()=>{
  const p=new HeyGenCatalog('secret',vi.fn(async()=>new Response(JSON.stringify({data:{voice_id:'v',name:'Rose',language:'English',preview_audio_url:'https://evil.test/sample.mp3',available_engines:['starfish'],default_engine:'starfish'}}))));
  expect(await p.getVoice('v')).toMatchObject({preview_audio_url:null,available_engines:['starfish'],default_engine:'starfish'});
 });
});

function database(){
 const rows=new Map<string,any>();
 const db={from:()=>{
  let mode='select',payload:any,filters:Record<string,string>={};
  const q:any={select:()=>q,eq:(k:string,v:string)=>{filters[k]=v;return q;},maybeSingle:async()=>({data:[...rows.values()].find(r=>Object.entries(filters).every(([k,v])=>r[k]===v))??null,error:null}),insert:(p:any)=>{mode='insert';payload=p;return q;},update:(p:any)=>{mode='update';payload=p;return q;},then:(resolve:any)=>{
   if(mode==='insert'){const duplicate=[...rows.values()].some(r=>r.user_id===payload.user_id&&r.connection_id===payload.connection_id&&r.revision===payload.revision);if(duplicate)return Promise.resolve({error:{code:'23505'}}).then(resolve);rows.set(payload.id,{...payload,status:'pending'});}
   if(mode==='update')for(const r of rows.values())if(Object.entries(filters).every(([k,v])=>r[k]===v))Object.assign(r,payload);
   return Promise.resolve({error:null}).then(resolve);
  }};return q;
 }};return {db:db as any,rows};
}
describe('audio-test durable reservations',()=>{
 it('deduplicates repeated calls and isolates users',async()=>{
  const {db}=database();const p:any={previewSpeech:vi.fn(async()=>({audio_url:'https://files.heygen.ai/test.mp3',engine:'starfish',duration:9}))};
  await previewVoice(db,'one','connection',p,voice,'starfish',1);
  await previewVoice(db,'one','connection',p,voice,'starfish',1);
  expect(p.previewSpeech).toHaveBeenCalledTimes(1);
  await previewVoice(db,'two','connection',p,voice,'starfish',1);
  await previewVoice(db,'one','connection',p,voice,'starfish',1.1);
  expect(p.previewSpeech).toHaveBeenCalledTimes(3);
 });
 it('does not resubmit after an uncertain failure',async()=>{
  const {db}=database();const p:any={previewSpeech:vi.fn(async()=>{throw Error('timeout');})};
  await expect(previewVoice(db,'one','c',p,voice,'starfish',1)).rejects.toThrow('could not be confirmed');
  await expect(previewVoice(db,'one','c',p,voice,'starfish',1)).rejects.toThrow('already submitted');
  expect(p.previewSpeech).toHaveBeenCalledTimes(1);
 });
 it('rejects a mismatched engine and never labels it as the requested one',async()=>{
  const {db}=database();const p:any={previewSpeech:vi.fn(async()=>({audio_url:'https://files.heygen.ai/test.mp3',engine:'orca',duration:9}))};
  await expect(previewVoice(db,'one','c',p,voice,'starfish',1)).rejects.toThrow('could not be confirmed');
 });
});
