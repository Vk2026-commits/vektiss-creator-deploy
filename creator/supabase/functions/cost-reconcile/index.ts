import {createClient} from '@supabase/supabase-js';
import {credentialVault} from '../_shared/credential-crypto.ts';
import {providerVideo} from '../_shared/presenter-test.ts';
import {openAICost,PRICING_VERSION} from '../../../src/domain/project-cost.ts';
import {isAllowedAppOrigin} from '../_shared/app-origins.ts';
declare const Deno:{env:{get(k:string):string|undefined};serve(fn:(r:Request)=>Promise<Response>):void};
const env=(k:string)=>Deno.env.get(k)!;
const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
// Recovery only: no provider POSTs, generations, or paid retries.
Deno.serve(async request=>{
 const origin=request.headers.get('origin');
 const headers:Record<string,string>={'content-type':'application/json','cache-control':'no-store','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
 if(origin){if(!isAllowedAppOrigin(origin,env('APP_ORIGIN'),Deno.env.get('CREATOR_ADDITIONAL_ORIGINS')))return new Response(null,{status:403});headers['access-control-allow-origin']=origin;}
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method==='OPTIONS')return reply({});
 if(request.method!=='POST')return reply({},405);
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
 let serviceClaim:{data:any;error:any}|null=null;
 if(token!==env('SUPABASE_SERVICE_ROLE_KEY')){
  const {data}=await db.auth.getUser(token??'');
  if(!data.user){
   if(!token)return reply({},401);
   const caller=createClient(env('SUPABASE_URL'),token,{auth:{persistSession:false}});
   serviceClaim=await caller.rpc('creator_claim_cost_recovery');
   if(serviceClaim.error)return reply({},401);
  }else if(data.user.app_metadata.creator_cost_admin!==true)return reply({},403);
 }
 const lock=serviceClaim??await db.rpc('creator_claim_cost_recovery');if(lock.error)return reply({error:'RECOVERY_UNAVAILABLE'},503);if(!lock.data)return reply({busy:true});
 const counts={openai:0,heygen:0,apify:0,unavailable:0};
 try{
  const recent=await db.from('creator_cost_recovery_attempts').select('provider,id').gte('checked_at',new Date(Date.now()-86400000).toISOString());if(recent.error)throw Error('STORAGE');
  const tried=new Set((recent.data??[]).map(r=>`${r.provider}:${r.id}`));
  const attempted=async(provider:string,id:string)=>{const saved=await db.from('creator_cost_recovery_attempts').upsert({provider,id,checked_at:new Date().toISOString()});if(saved.error)throw Error('STORAGE');};
  const ai=await db.from('creator_ai_generations').select('id,model,usage').is('estimated_cost_usd',null).limit(1000);
  if(ai.error)throw Error('STORAGE');
  for(const row of ai.data??[]){const cost=openAICost(row.model,row.usage);if(cost===null)continue;const saved=await db.from('creator_ai_generations').update({estimated_cost_usd:cost,pricing_version:PRICING_VERSION}).eq('id',row.id).is('estimated_cost_usd',null);if(saved.error)throw Error('STORAGE');counts.openai++;}
  const jobs=await db.from('creator_presenter_tests').select('id,user_id,connection_id,provider_video_id,snapshot').eq('status','completed').not('provider_video_id','is',null).is('snapshot->provider_duration_seconds',null).order('created_at').limit(100);
  if(jobs.error)throw Error('STORAGE');
  const vault=credentialVault(JSON.parse(env('PROVIDER_ENCRYPTION_KEYS')),env('PROVIDER_KEY_VERSION'));
  await Promise.all((jobs.data??[]).filter(row=>!tried.has(`HeyGen:${row.id}`)).slice(0,20).map(async row=>{try{
   const credential=await db.rpc('creator_read_credential',{p_user_id:row.user_id,p_connection_id:row.connection_id});if(credential.error||!credential.data?.[0])throw Error('CONNECTION');
   const key=await vault.open(credential.data[0],{userId:row.user_id,connectionId:row.connection_id,provider:'heygen'});
   const data=await providerVideo(key,`/${encodeURIComponent(row.provider_video_id)}`);
   const duration=Number(data.duration);if(!Number.isFinite(duration)||duration<=0)throw Error('NO_DURATION');
   const saved=await db.rpc('creator_save_cost_duration',{p_id:row.id,p_seconds:duration});if(saved.error)throw Error('STORAGE');counts.heygen++;
  }catch{counts.unavailable++;}finally{await attempted('HeyGen',row.id);}}));
  const research=await db.from('creator_research_jobs').select('id,user_id,created_at,provider_metadata,provider_response_id').order('created_at',{ascending:false}).limit(500);
  if(research.error)throw Error('STORAGE');
  const references=new Map<string,{job:any;platform:string}>();
  for(const job of research.data??[]){const meta=job.provider_metadata??{};const runs=[...(meta.discoveryRuns??[]),...(meta.discoverySummary??[]),...(meta.roundReports??[]).flatMap((r:any)=>r.discovery??[])];for(const run of runs)if(typeof run.id==='string')references.set(run.id,{job,platform:run.platform??'Social'});if(['native_discovery'].includes(meta.stage)&&job.provider_response_id)references.set(job.provider_response_id,{job,platform:'TikTok'});}
  const saved=await db.from('creator_provider_costs').select('external_id,status').eq('provider','Apify');if(saved.error)throw Error('STORAGE');
  const done=new Set((saved.data??[]).filter(r=>['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(r.status)).map(r=>r.external_id));
  await Promise.all([...references].filter(([id])=>!done.has(id)&&!tried.has(`Apify:${id}`)).slice(0,20).map(async([id,{job,platform}])=>{try{
   const r=await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(id)}`,{headers:{authorization:`Bearer ${env('CREATOR_APIFY_API_TOKEN')}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('PROVIDER');const {data}=await r.json();
   if(typeof data.usageTotalUsd!=='number'||data.usageTotalUsd<0)throw Error('NO_COST');
   const result=await db.from('creator_provider_costs').upsert({provider:'Apify',external_id:id,user_id:job.user_id,job_id:job.id,operation:`${platform} discovery`,status:data.status,cost_usd:data.usageTotalUsd,created_at:job.created_at},{onConflict:'provider,external_id'});if(result.error)throw Error('STORAGE');counts.apify++;
  }catch{counts.unavailable++;}finally{await attempted('Apify',id);}}));
  return reply(counts);
 }catch{return reply({error:'RECOVERY_INCOMPLETE',...counts},503);}
});
