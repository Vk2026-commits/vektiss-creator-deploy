import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('recovers checkpoint totals once, prices only supported speech and preserves unknowns',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;
 create table creator_research_jobs(id uuid primary key,provider_metadata jsonb);
 create table creator_research_usage(id uuid primary key,job_id uuid,provider_cost_usd numeric,pricing_version text,request_metadata jsonb,provider_response_id text);
 create table creator_presenter_tests(id uuid primary key,script_id uuid,user_id uuid,snapshot jsonb,status text,provider_video_id text,message text);
 create table creator_scripts(id uuid primary key,user_id uuid,title text);
 create table creator_voice_previews(id uuid primary key,status text,result jsonb);
 create function creator_usage_dashboard_v2(timestamptz,timestamptz) returns jsonb language sql as $$select jsonb_build_object('events',jsonb_agg(jsonb_build_object('id','preview:'||id,'estimate',null))) from public.creator_voice_previews$$;
 insert into creator_voice_previews values('00000000-0000-4000-8000-000000000001','completed','{"engine":"starfish","duration":30}'),('00000000-0000-4000-8000-000000000002','completed','{"engine":"elevenlabs","duration":30}');
 insert into creator_research_jobs values('00000000-0000-4000-8000-000000000003','{"stage":"multi_discovery","accumulatedCost":0.30788}');
 insert into creator_research_usage(id,job_id) values('648a0351-0bc0-4042-8c58-4047a6bc3911','00000000-0000-4000-8000-000000000003');`);
 const sql=await readFile(new URL('../supabase/migrations/202610140004_cost_audit_evidence.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 expect((await db.query<{provider_cost_usd:string}>('select provider_cost_usd from creator_research_usage')).rows[0].provider_cost_usd).toBe('0.30788');
 const rows=(await db.query<{d:{events:Array<{id:string;estimate:number|null}>}}>("select creator_usage_dashboard_v3(now()-interval '1 day',now()) as d")).rows[0].d.events;
 expect(rows.find(e=>e.id.endsWith('1'))?.estimate).toBe(.06);
 expect(rows.find(e=>e.id.endsWith('2'))?.estimate).toBeNull();
 }finally{await db.close();}
},30000);
