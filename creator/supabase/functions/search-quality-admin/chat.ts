import type {SupabaseClient} from '@supabase/supabase-js';
import {defaultSearchQuality,qualityFromRow,searchQualitySettingsSchema} from '../../../src/domain/search-quality.ts';
import {applySearchProposal,initialSearchSettings,searchChatInstruction,searchChatProposalSchema} from '../../../src/domain/search-chat.ts';
import {openAICost,PRICING_VERSION} from '../../../src/domain/project-cost.ts';

export async function prepareSearchChat(db:SupabaseClient,actor:string,input:{requestId:string;profileId:string;scope:'creator'|'profile';message:string},key:string|undefined){
 const old=await db.from('creator_search_chat').select('*').eq('id',input.requestId).maybeSingle();
 if(old.error)throw Error('PERSISTENCE');
 if(old.data){
   if(old.data.actor!==actor||old.data.profile_id!==input.profileId||old.data.scope!==input.scope||old.data.message!==input.message)throw Error('REQUEST_CONFLICT');
   return old.data;
 }
 if(!key)throw Error('NOT_CONFIGURED');
 const profile=await db.from('content_profiles').select('*').eq('id',input.profileId).single();
 if(profile.error)throw Error('PROFILE');
 const [creator,quality,defaults]=await Promise.all([
   db.from('creator_profiles').select('*').eq('id',profile.data.creator_profile_id).eq('user_id',profile.data.user_id).single(),
   db.from('creator_search_quality').select('*').eq('content_profile_id',input.profileId).maybeSingle(),
   db.from('creator_search_defaults').select('*').eq('creator_id',profile.data.creator_profile_id).maybeSingle(),
 ]);
 if(creator.error||quality.error||defaults.error)throw Error('PERSISTENCE');
 const inherited=defaults.data?.settings ? searchQualitySettingsSchema.parse(defaults.data.settings) : initialSearchSettings(profile.data.strategy);
 const before=input.scope==='creator' ? defaults.data?.settings??defaultSearchQuality : quality.data?.enabled ? qualityFromRow(quality.data) : inherited;
 const limit=await db.rpc('creator_ai_allow',{p_user:actor});
 if(limit.error||!limit.data)throw Error('RATE_LIMIT');
 const inserted=await db.from('creator_search_chat').insert({id:input.requestId,actor,creator_id:creator.data.id,profile_id:input.profileId,scope:input.scope,message:input.message,
   base_version:input.scope==='creator'?defaults.data?.version??0:quality.data?.version??0,
   defaults_version:defaults.data?.version??0,before_settings:before,before_enabled:input.scope==='creator'?!!defaults.data?.settings:!!quality.data?.enabled,
 }).select('*').single();
 if(inserted.error){
   if(inserted.error.code==='23505')return prepareSearchChat(db,actor,input,key);
   throw Error('PERSISTENCE');
 }
 try{
   const record=await db.from('creator_ai_generations').insert({id:input.requestId,user_id:profile.data.user_id,profile_id:input.profileId,action:'clarify',model:'gpt-4o-mini'});
   if(record.error)throw Error('PERSISTENCE');
   const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},signal:AbortSignal.timeout(55000),body:JSON.stringify({model:'gpt-4o-mini',store:false,max_tokens:4500,response_format:{type:'json_object'},messages:[{role:'system',content:searchChatInstruction},{role:'user',content:JSON.stringify({scope:input.scope,creator:{name:creator.data.display_name,context:creator.data.context},profile:input.scope==='profile'?{name:profile.data.name,audience:profile.data.primary_audience,strategy:profile.data.strategy}:null,currentSettings:before,request:input.message})}]})});
   const data=await response.json();
   // Preserve usage/request evidence even if structured output is rejected.
   const usage=await db.from('creator_ai_generations').update({usage:data.usage??null,estimated_cost_usd:data.usage?openAICost('gpt-4o-mini',data.usage):null,pricing_version:PRICING_VERSION,provider_requests:[{provider:'openai',request_id:response.headers.get('x-request-id'),response_id:data.id??null,status:response.status}]}).eq('id',input.requestId);
   if(usage.error)throw Error('PERSISTENCE');
   if(!response.ok||data.choices?.[0]?.finish_reason!=='stop')throw Error('PROVIDER');
   const proposal=searchChatProposalSchema.parse(JSON.parse(data.choices[0].message.content));
   const settings=proposal.question?null:applySearchProposal(before,proposal);
   const saved=await db.from('creator_search_chat').update({proposal,after_settings:settings,status:'ready'}).eq('id',input.requestId).select('*').single();
   if(saved.error)throw Error('PERSISTENCE');
   await db.from('creator_ai_generations').update({status:'complete',result:{purpose:'search-quality-proposal',requestId:input.requestId}}).eq('id',input.requestId);
   return saved.data;
 }catch{
   await db.from('creator_ai_generations').update({status:'error'}).eq('id',input.requestId);
   await db.from('creator_search_chat').update({status:'error'}).eq('id',input.requestId);
   throw Error('PROPOSAL_FAILED');
 }
}
