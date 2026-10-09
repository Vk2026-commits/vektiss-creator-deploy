import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('stops once, keeps results, refunds unused quota, prevents resurrection and cross-owner stops',async()=>{
 const db=new PGlite();
 const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table creator_research_jobs(id uuid primary key,user_id uuid,status text,reserved_count int,delivered_count int,phase text,error_code text,completed_at timestamptz,updated_at timestamptz);
 create table creator_research_entitlements(user_id uuid primary key,reserved_count int,delivered_count int,updated_at timestamptz);
 create table creator_research_opportunities(id serial,job_id uuid);`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610090003_research_stop.sql',import.meta.url),'utf8'));
 await db.query("insert into creator_research_jobs(id,user_id,status,reserved_count,delivered_count) values($1,$1,'researching',10,0)",[id]);
 await db.query('insert into creator_research_entitlements values($1,20,0,now())',[id]);
 await db.query('insert into creator_research_opportunities(job_id) values($1),($1)',[id]);
 await expect(db.query('select creator_research_stop($1,$2)',[id,other])).rejects.toThrow('JOB');
 await db.query('select creator_research_stop($1,$1)',[id]);
 await db.query('select creator_research_stop($1,$1)',[id]);
 await db.query("update creator_research_jobs set status='ready',reserved_count=0 where id=$1",[id]);
 expect((await db.query('select status,delivered_count from creator_research_jobs')).rows).toEqual([{status:'cancelled',delivered_count:2}]);
 expect((await db.query('select reserved_count,delivered_count from creator_research_entitlements')).rows).toEqual([{reserved_count:10,delivered_count:2}]);
 await expect(db.query('insert into creator_research_opportunities(job_id) values($1)',[id])).rejects.toThrow('RESEARCH_TERMINAL');
 }finally{await db.close();}
});
