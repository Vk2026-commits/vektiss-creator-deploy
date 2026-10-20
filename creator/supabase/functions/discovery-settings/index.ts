import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {isAllowedAppOrigin} from '../_shared/app-origins.ts';
import {creatorFromUrl} from '../../../src/domain/discovery-pilot.ts';
declare const Deno:{env:{get(k:string):string|undefined};serve(h:(r:Request)=>Promise<Response>):void};
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const schema=z.object({profileId:z.string().uuid(),action:z.enum(['load','toggle','follow','remove']).default('load'),enabled:z.boolean().optional(),url:z.string().url().max(2048).optional(),id:z.string().uuid().optional()}).strict();
Deno.serve(async request=>{
 const origin=request.headers.get('origin');const headers:Record<string,string>={'content-type':'application/json','cache-control':'no-store',vary:'Origin','access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!isAllowedAppOrigin(origin,Deno.env.get('APP_ORIGIN'),Deno.env.get('CREATOR_ADDITIONAL_ORIGINS')))return reply({code:'ORIGIN'},403);if(origin)headers['access-control-allow-origin']=origin;
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='POST')return reply({code:'METHOD'},405);
 try{const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return reply({code:'AUTH'},401);
 const {data:auth,error:ae}=await db.auth.getUser(token);if(ae||!auth.user)return reply({code:'AUTH'},401);
 const body=await request.text();if(body.length>4096)return reply({code:'INPUT'},400);const input=schema.parse(JSON.parse(body));
 const profile=await db.from('content_profiles').select('id').eq('id',input.profileId).eq('user_id',auth.user.id).is('archived_at',null).maybeSingle();if(profile.error||!profile.data)return reply({code:'PROFILE'},403);
 const pilot=await db.from('creator_discovery_pilot').select('enabled').eq('content_profile_id',input.profileId).maybeSingle();if(pilot.error)throw Error('PERSISTENCE');
 if(input.action!=='load'&&!pilot.data)return reply({code:'PILOT'},403);
 if(input.action==='toggle'){const enabled=z.boolean().parse(input.enabled);const r=await db.from('creator_discovery_pilot').update({enabled,updated_at:new Date().toISOString()}).eq('content_profile_id',input.profileId);if(r.error)throw Error('PERSISTENCE');}
 if(input.action==='follow'){const creator=creatorFromUrl(input.url??'');if(!creator)return reply({code:'CREATOR_URL'},400);
 const {count,error}=await db.from('creator_discovery_watchlist').select('id',{head:true,count:'exact'}).eq('content_profile_id',input.profileId).eq('user_id',auth.user.id);if(error)throw Error('PERSISTENCE');if((count??0)>=20){const existing=await db.from('creator_discovery_watchlist').select('id').eq('content_profile_id',input.profileId).eq('user_id',auth.user.id).eq('platform',creator.platform).eq('identifier',creator.identifier).maybeSingle();if(existing.error)throw Error('PERSISTENCE');if(!existing.data)return reply({code:'WATCHLIST_LIMIT'},409);}
 const r=await db.from('creator_discovery_watchlist').upsert({...creator,content_profile_id:input.profileId,user_id:auth.user.id},{onConflict:'content_profile_id,platform,identifier',ignoreDuplicates:true});if(r.error)throw Error('PERSISTENCE');}
 if(input.action==='remove'){const id=z.string().uuid().parse(input.id);const r=await db.from('creator_discovery_watchlist').delete().eq('id',id).eq('content_profile_id',input.profileId).eq('user_id',auth.user.id);if(r.error)throw Error('PERSISTENCE');}
 const watch=await db.from('creator_discovery_watchlist').select('id,platform,identifier,url,name,created_at').eq('content_profile_id',input.profileId).eq('user_id',auth.user.id).order('created_at');if(watch.error)throw Error('PERSISTENCE');
 return reply({configured:Boolean(pilot.data),enabled:input.action==='toggle'?input.enabled:pilot.data?.enabled??false,watchlist:watch.data??[],provider:Deno.env.get('CREATOR_DISCOVERY_PROVIDER')==='scrapecreators'?'Scrape Creators':'Apify',youtube:Deno.env.get('CREATOR_YOUTUBE_API_KEY')?'configured':'apify_fallback'});
 }catch(e){return reply({code:e instanceof z.ZodError?'INPUT':'UNAVAILABLE'},e instanceof z.ZodError?400:503);}
});
