import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {isAllowedAppOrigin} from '../_shared/app-origins.ts';
declare const Deno:{env:{get(k:string):string|undefined};serve(h:(r:Request)=>Promise<Response>):void};
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const schema=z.object({query:z.string().trim().min(3).max(500),platform:z.enum(['all','youtube','instagram','tiktok']),profileId:z.string().uuid()});
Deno.serve(async request=>{
 const origin=request.headers.get('origin');
 const headers:Record<string,string>={'content-type':'application/json','cache-control':'no-store','vary':'Origin','access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!isAllowedAppOrigin(origin,Deno.env.get('APP_ORIGIN'),Deno.env.get('CREATOR_ADDITIONAL_ORIGINS')))return reply({code:'ORIGIN'},403);
 if(origin)headers['access-control-allow-origin']=origin;
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({code:'METHOD'},405);
 try{
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token)return reply({code:'AUTH'},401);
  const {data:auth,error}=await db.auth.getUser(token);
  if(error||!auth.user)return reply({code:'AUTH'},401);
  const reader=request.body?.getReader();if(!reader)return reply({code:'INPUT'},400);
  const parts:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply({code:'INPUT'},400);}parts.push(value);}
  const parsed=schema.safeParse(JSON.parse(await new Blob(parts as BlobPart[]).text()));
  if(!parsed.success)return reply({code:'INPUT'},400);
  const input=parsed.data;
  const {data:profile}=await db.from('content_profiles').select('id').eq('id',input.profileId).eq('user_id',auth.user.id).single();
  if(!profile)return reply({code:'PROFILE'},403);
  const key=Deno.env.get('CREATOR_PERPLEXITY_API_KEY');
  if(!key)return reply({code:'NOT_CONFIGURED'},503);
  const {data:allowed,error:rateError}=await db.rpc('creator_ai_allow',{p_user:auth.user.id});
  if(rateError||!allowed)return reply({code:'RATE_LIMIT'},429);
  const domains={youtube:['youtube.com','youtu.be'],instagram:['instagram.com'],tiktok:['tiktok.com']};
  const response=await fetch('https://api.perplexity.ai/search',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({query:input.query,max_results:8,...(input.platform==='all'?{}:{search_domain_filter:domains[input.platform]})}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)return reply({code:'PROVIDER'},502);
  const data=await response.json();
  const results=z.array(z.object({title:z.string(),url:z.string().url(),snippet:z.string().default(''),date:z.string().nullish()})).parse(data.results).filter(r=>{const u=new URL(r.url);return u.protocol==='https:'&&!u.username&&!u.password;}).slice(0,8).map(r=>({...r,title:r.title.slice(0,300),snippet:r.snippet.slice(0,500)}));
  return reply({results});
 }catch{return reply({code:'UNAVAILABLE'},503);}
});
