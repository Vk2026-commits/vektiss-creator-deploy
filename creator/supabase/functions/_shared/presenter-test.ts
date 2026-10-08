import {z} from 'zod';
import {PublicError} from './avatar-contract.ts';
export const testCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('prepare_test'),script_id:z.string().uuid(),scope:z.enum(['test','full']).optional()}).strict(),
 z.object({action:z.literal('start_test'),script_id:z.string().uuid(),revision:z.string().min(1).max(100),paid_consent:z.literal(true),scope:z.enum(['test','full']).optional(),retry_of:z.string().uuid().optional()}).strict(),
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
export function testPayload(snapshot:{avatar_id:string;voice_id:string;script:string;aspect_ratio:string;scope?:string;voice_engine?:string;avatar_engine?:string}){
 return {type:'avatar',engine:{type:snapshot.avatar_engine??'avatar_iv'},avatar_id:snapshot.avatar_id,voice_id:snapshot.voice_id,...(snapshot.voice_engine==='fish'?{voice_settings:{engine_settings:{engine_type:'fish'}}}:{}),script:snapshot.script,aspect_ratio:snapshot.aspect_ratio,resolution:'720p',output_format:'webm',title:snapshot.scope==='full'?'Vektiss Creator · full script':'Vektiss Creator · presenter cutout test'};
}
export async function providerVideo(key:string,path:string,body?:unknown,request:typeof fetch=fetch){
 const result=await request(`https://api.heygen.com/v3/videos${path}`,{method:body?'POST':'GET',headers:{'X-Api-Key':key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000),redirect:'error'});
 if(!result.ok){
  const text=await result.text();
  if(result.status===402||isCreditError(text))throw new PublicError('RENDER_REJECTED',creditErrorMessage,result.status);
  if(result.status===400||result.status===422){
   throw new PublicError('RENDER_REJECTED',/matting|webm/i.test(text)?'This avatar does not support transparent output. Choose a matting-enabled avatar.':'HeyGen rejected the test settings. Check your avatar and voice.',400);
  }
  if([401,402,403,429].includes(result.status))throw new PublicError('RENDER_REJECTED',result.status===402?'HeyGen reports insufficient API credits.':result.status===429?'HeyGen is rate limited. No automatic retry was made.':'HeyGen did not authorize video creation. Check the connected key permissions.',result.status);
  throw Error('UNKNOWN_SUBMISSION');
 }
 return z.object({data:z.record(z.unknown())}).parse(await result.json()).data;
}
