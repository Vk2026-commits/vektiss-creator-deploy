import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {isAllowedAppOrigin} from '../_shared/app-origins.ts';
import {validateDeliveryWav,deliveryAnalysisPrompt,parseDeliveryAnalysis} from '../_shared/delivery-analysis.ts';
declare const Deno:{env:{get(k:string):string|undefined};serve(h:(r:Request)=>Promise<Response>):void};
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
Deno.serve(async request=>{
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-request-id,x-analysis-consent','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 const origin=request.headers.get('origin');if(origin&&!isAllowedAppOrigin(origin,Deno.env.get('APP_ORIGIN'),Deno.env.get('CREATOR_ADDITIONAL_ORIGINS')))return respond({error:'Origin not allowed.'},403);
 if(origin)headers['Access-Control-Allow-Origin']=origin;
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return respond({error:'Method not allowed.'},405);
 let id:string|undefined,user:string|undefined,reserved=false,submitted=false;
 let bytes:Uint8Array|undefined;
 try{
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token)return respond({error:'Sign in to analyze your delivery.'},401);
  const auth=await db.auth.getUser(token);if(auth.error||!auth.data.user)return respond({error:'Sign in again.'},401);user=auth.data.user.id;
  if(request.headers.get('x-analysis-consent')!=='true')return respond({error:'Approve reference processing first.'},400);
  id=z.string().uuid().parse(request.headers.get('x-request-id'));
  const key=Deno.env.get('CREATOR_OPENAI_API_KEY');if(!key)return respond({error:'Reference analysis is not configured. You can enter preferences manually.'},503);
  // Read at most 90s of PCM. Nothing is uploaded to durable storage.
  const reader=request.body?.getReader();if(!reader)return respond({error:'Choose a recording.'},400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2880044){await reader.cancel();return respond({error:'Recording is too large.'},413);}chunks.push(part.value);}
  bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;chunk.fill(0);}
  const duration=validateDeliveryWav(bytes);
  const rate=await db.rpc('creator_ai_allow',{p_user:user});if(rate.error)throw Error('Analysis unavailable. Try later.');if(!rate.data)return respond({error:'Analysis limit reached. Please try later.'},429);
  const model=Deno.env.get('CREATOR_DELIVERY_MODEL')??'gpt-audio-1.5';
  const record=await db.from('creator_delivery_analyses').insert({id,user_id:user,model,duration_seconds:duration});
  if(record.error)return respond({error:'This analysis was already submitted or cannot be reserved. No duplicate was started. Review its status before another attempt.'},409);
  reserved=true;
  let encoded='';for(let start=0;start<bytes.length;start+=8192)encoded+=String.fromCharCode(...bytes.subarray(start,start+8192));
  const body=JSON.stringify({model,store:false,modalities:['text'],max_tokens:1400,messages:[{role:'system',content:deliveryAnalysisPrompt},{role:'user',content:[{type:'input_audio',input_audio:{data:btoa(encoded),format:'wav'}}]}]});encoded='';
  submitted=true;
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error('Audio analysis could not complete. No automatic retry was made; you can enter preferences manually.');
  const result=await response.json();
  const usage=await db.from('creator_delivery_analyses').update({usage:result.usage??null,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user);
  if(usage.error)throw Error('Could not confirm analysis status. No automatic retry was made.');
  if(result.choices?.[0]?.finish_reason!=='stop')throw Error('Analysis was incomplete. Please enter preferences manually or try a clearer clip.');
  const suggestions=parseDeliveryAnalysis(result.choices[0].message.content);
  const saved=await db.from('creator_delivery_analyses').update({status:'complete',updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user);
  if(saved.error)throw Error('Could not confirm analysis status.');
  return respond({suggestions,id});
 }catch(error){
  if(reserved&&id&&user)await db.from('creator_delivery_analyses').update({status:submitted?'uncertain':'failed',updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user);
  return respond({error:error instanceof Error&&!('issues' in error)?error.message:'Could not analyze this recording.'},400);
 }finally{bytes?.fill(0);}
});
