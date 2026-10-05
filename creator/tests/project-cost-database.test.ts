import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('isolates usage, rejects cross-account render credit entries and deduplicates jobs',async()=>{
 const db=new PGlite();const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;
  create table creator_scripts(id uuid primary key,user_id uuid,brief jsonb);create table creator_presenter_tests(id uuid primary key,user_id uuid,script_id uuid);create table creator_ai_generations(id uuid primary key,user_id uuid);grant select on creator_scripts,creator_presenter_tests to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610050001_project_costs.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values ($1),($2)',[owner,other]);
  await db.query("insert into creator_scripts values($1,$1,'{}')",[owner]);
  await db.query('insert into creator_presenter_tests values($1,$1,$1)',[owner]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
  await db.query("insert into creator_processing_usage(id,user_id,project_id,operation,status) values($1,$1,$1,'source','running')",[owner]);
  await db.query("insert into creator_processing_usage(id,user_id,project_id,operation,status) values($1,$1,$1,'source','done') on conflict(id) do update set status=excluded.status",[owner]);
  expect((await db.query('select * from creator_processing_usage')).rows).toHaveLength(1);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  expect((await db.query('select * from creator_processing_usage')).rows).toHaveLength(0);
  await expect(db.query("insert into creator_cost_entries(id,user_id,project_id,kind,render_id,quantity,unit_rate_usd) values($2,$2,$1,'heygen',$1,146,.048)",[owner,other])).rejects.toThrow();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  await db.query("insert into creator_cost_entries(id,user_id,project_id,kind,render_id,quantity,unit_rate_usd) values($1,$1,$1,'heygen',$1,146,.048)",[owner]);
  await expect(db.query("update creator_cost_entries set quantity=0")).rejects.toThrow();
 }finally{await db.close();}
},30000);
