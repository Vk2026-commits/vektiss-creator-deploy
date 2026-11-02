import {z} from 'zod';
import {PublicError} from './avatar-contract.ts';
import {videoVoiceSettings,voiceEngineSchema} from '../../../src/domain/voice-settings.ts';
export const testCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('prepare_test'),script_id:z.string().uuid(),scope:z.enum(['test','full']).optional()}).strict(),
 z.object({action:z.literal('start_test'),script_id:z.string().uuid(),revision:z.string().min(1).max(100),paid_consent:z.literal(true),scope:z.enum(['test','full']).optional(),unverified_background_acknowledged:z.literal(true).optional(),retry_of:z.string().uuid().optional()}).strict(),
 z.object({action:z.literal('test_status'),test_id:z.string().uuid()}).strict(),
 z.object({action:z.literal('download_test'),test_id:z.string().uuid()}).strict(),
]);
export type TestCommand=z.infer<typeof testCommand>;
export const isCreditError=(value:unknown)=>/insufficient.{0,30}(credit|balance|quota)|out of credits|not enough.{0,20}credits|credit[s_ -]*(exhausted|insufficient)|quota.{0,20}(exceeded|exhausted)/i.test(typeof value==='string'?value:JSON.stringify(value)??'');
export const creditErrorMessage='HeyGen has insufficient API credits for this render. Add credits to the connected HeyGen account. Your script and source are saved; no automatic paid retry will be made.';
export function testExcerpt(script:{hook:string;body:string;cta:string}) {
 return [script.hook,script.body,script.cta].filter(Boolean).join(' ').trim().split(/\s+/).slice(0,30).join(' ').slice(0,500);
}
export function fullScript(script:{hook:string;body:string;cta:string}){
 const text=[script.hook,script.body,script.cta].filter(Boolean).join('\n\n').trim();
 if(text.length>15000)throw new PublicError('SCRIPT_LENGTH','Full-script videos currently support up to 15,000 characters. Shorten the script before rendering.');
 return text;
}
export function testPayload(snapshot:{avatar_id:string;voice_id:string;script:string;aspect_ratio:string;scope?:string;voice_engine?:string;voice_speed?:number;avatar_engine?:string;background_mode?:string}){
 const settings=videoVoiceSettings(voiceEngineSchema.parse(snapshot.voice_engine??'auto'),snapshot.voice_speed??1);
 return {type:'avatar',engine:{type:snapshot.avatar_engine??'avatar_iv'},avatar_id:snapshot.avatar_id,voice_id:snapshot.voice_id,...(Object.keys(settings).length?{voice_settings:settings}:{}),script:snapshot.script,aspect_ratio:snapshot.aspect_ratio,resolution:'720p',output_format:snapshot.background_mode==='original'?'mp4':'webm',...(snapshot.background_mode==='original'?{remove_background:false}:{}),title:snapshot.scope==='full'?'Vektiss Creator · full script':'Vektiss Creator · presenter cutout test'};
}
// Only retain provider diagnostic fields, never echoed request bodies or credentials.
export function videoRejection(text:string,key=''){
 let detail='';
 try{
  const value=JSON.parse(text);
  const error=value.error;
  const candidate=error?.message??value.message??value.detail;
  if(typeof candidate==='string')detail=candidate;
  else if(Array.isArray(candidate))detail=candidate.map(item=>typeof item?.msg==='string'?item.msg:'').filter(Boolean).join('; ');
 }catch{/* Unstructured responses may contain request dumps; do not expose them. */}
 if(key)detail=detail.split(key).join('[redacted]');
 detail=detail.replace(/(?:sk_|Bearer\s+)[A-Za-z0-9_.-]+/gi,'[redacted]').replace(/https?:\/\/\S+/gi,'[link omitted]').replace(/[\r\n\t]+/g,' ').slice(0,400);
 if(/matting|webm/i.test(detail||text))return 'This avatar does not support the requested transparent output. Choose an avatar with background removal or keep its original setting.';
 return detail?`HeyGen rejected the video settings: ${detail}`:'HeyGen rejected the video settings. Check the selected avatar, voice engine, and background setting. No automatic retry was made.';
}
export function validateVoiceEngine(engine:string,available:string[]|undefined){
 const requested=engine==='elevenlabs_v3'?'elevenlabs':engine;
 if(requested!=='auto'&&available?.length&&!available.some(value=>(value==='elevenlabs_v3'?'elevenlabs':value)===requested))
  throw new PublicError('VOICE_ENGINE','This voice does not support the selected voice engine. Choose “HeyGen default” in the voice settings before generating.',400);
}
export async function providerVideo(key:string,path:string,body?:unknown,request:typeof fetch=fetch){
 const result=await request(`https://api.heygen.com/v3/videos${path}`,{method:body?'POST':'GET',headers:{'X-Api-Key':key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000),redirect:'error'});
 if(!result.ok){
  const text=await result.text();
  if(result.status===402||isCreditError(text))throw new PublicError('RENDER_REJECTED',creditErrorMessage,result.status);
  if(result.status===400||result.status===422){
   throw new PublicError('RENDER_REJECTED',videoRejection(text,key),400);
  }
  if([401,402,403,429].includes(result.status))throw new PublicError('RENDER_REJECTED',result.status===402?'HeyGen reports insufficient API credits.':result.status===429?'HeyGen is rate limited. No automatic retry was made.':'HeyGen did not authorize video creation. Check the connected key permissions.',result.status);
  throw Error('UNKNOWN_SUBMISSION');
 }
 return z.object({data:z.record(z.unknown())}).parse(await result.json()).data;
}
