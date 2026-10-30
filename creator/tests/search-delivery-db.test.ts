import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
it('atomically delivers, deduplicates, stops and settles partial batches exactly once',async()=>{
 const db=new PGlite();const owner='00000000-0000-4000-8000-000000000001',job='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
 create table creator_research_jobs(id uuid primary key,user_id uuid,content_profile_id uuid,status text,reserved_count int,delivered_count int,requested_count int,phase text,error_code text,completed_at timestamptz,updated_at timestamptz);
 create table creator_research_entitlements(user_id uuid primary key,reserved_count int,delivered_count int,updated_at timestamptz);
 create table creator_research_opportunities(id uuid primary key,job_id uuid,user_id uuid,content_profile_id uuid,normalized_title text,title text,factual_summary text,why_audience_cares text,creator_connection text,recommended_angle text,suggested_hook text,category text,published_at timestamptz,timeliness_score numeric,relevance_score numeric,rank_score numeric,uncertainty text,evidence_state text,source_snapshot jsonb);
 create table creator_research_sources(id uuid primary key,user_id uuid,canonical_url text,title text,snippet text,source_type text,published_at timestamptz,provider_source_id int,retrieved_at timestamptz,unique(user_id,canonical_url));
 create table creator_research_opportunity_sources(opportunity_id uuid,source_id uuid,source_order int,primary key(opportunity_id,source_id));
 create table creator_research_feedback(id uuid,opportunity_id uuid,user_id uuid,action text,metadata jsonb);`);
 for(const name of ['202610090003_research_stop.sql','202610300001_incremental_search.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.query('insert into auth.users values($1),($2)',[owner,other]);
 await db.query('insert into creator_research_entitlements values($1,5,0,now())',[owner]);
 await db.query("insert into creator_research_jobs(id,user_id,content_profile_id,status,reserved_count,delivered_count,requested_count,incremental_delivery) values($1,$2,$2,'reviewing_sources',5,0,5,true)",[job,owner]);
 const row=(n:number)=>({normalized_title:'clip'+n,title:'Clip '+n,factual_summary:'Summary',why_audience_cares:'Why',creator_connection:'Connection',recommended_angle:'Angle',suggested_hook:'Hook',category:'AI',published_at:null,timeliness_score:80,relevance_score:90,rank_score:90,uncertainty:'',evidence_state:'source_backed',source_snapshot:[{url:'https://www.instagram.com/reel/clip'+n+'/',title:'Clip',snippet:'Evidence',sourceType:'video',publishedAt:null,providerSourceId:n}]});
 await expect(db.query('select creator_search_deliver($1,$2,$3)',[job,other,[row(1)]])).rejects.toThrow('JOB');
 await db.query('select creator_search_deliver($1,$2,$3)',[job,owner,[row(1),row(2),row(2)]]);
 await db.query('select creator_search_deliver($1,$2,$3)',[job,owner,[row(1),row(2),row(3),row(4)]]);
 expect((await db.query('select delivered_count,reserved_count from creator_research_entitlements')).rows).toEqual([{delivered_count:4,reserved_count:1}]);
 await db.query("update creator_research_jobs set status='ready',reserved_count=0 where id=$1",[job]);
 expect((await db.query('select status,delivered_count,interruption_reason from creator_research_jobs')).rows).toEqual([{status:'failed',delivered_count:4,interruption_reason:'search_incomplete'}]);
 await db.query('select creator_search_deliver($1,$2,$3)',[job,owner,[row(5)]]);
 await db.query('select creator_research_stop($1,$2)',[job,owner]);
 expect((await db.query('select delivered_count,reserved_count from creator_research_entitlements')).rows).toEqual([{delivered_count:4,reserved_count:0}]);
 expect((await db.query('select count(*)::int as n from creator_research_opportunities')).rows).toEqual([{n:4}]);
 const next='00000000-0000-4000-8000-000000000004';
 await db.query("insert into creator_research_jobs(id,user_id,content_profile_id,status,reserved_count,delivered_count,requested_count,incremental_delivery) values($1,$2,$2,'reviewing_sources',5,0,5,true)",[next,owner]);
 await db.query('update creator_research_entitlements set reserved_count=5 where user_id=$1',[owner]);
 await expect(db.query('select creator_search_deliver($1,$2,$3)',[next,owner,[row(5),{...row(6),timeliness_score:'invalid'}]])).rejects.toThrow();
 expect((await db.query('select delivered_count from creator_research_jobs where id=$1',[next])).rows).toEqual([{delivered_count:0}]);
 await db.query('select creator_search_deliver($1,$2,$3)',[next,owner,[row(1),row(5),row(6),row(7)]]);
 expect((await db.query('select delivered_count from creator_research_jobs where id=$1',[next])).rows).toEqual([{delivered_count:3}]);
 await db.query('select creator_search_deliver($1,$2,$3)',[next,owner,[row(7),row(8),row(9),row(10)]]);
 await db.query("update creator_research_jobs set status='ready',reserved_count=0 where id=$1",[next]);
 expect((await db.query('select status,delivered_count from creator_research_jobs where id=$1',[next])).rows).toEqual([{status:'ready',delivered_count:5}]);
 expect((await db.query('select delivered_count,reserved_count from creator_research_entitlements')).rows).toEqual([{delivered_count:9,reserved_count:0}]);

 }finally{await db.close();}
});
