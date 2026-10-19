import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {defaultSearchQuality} from '../src/domain/search-quality';
it('requires approval, applies once, isolates profiles, blocks stale changes, and undoes inheritance safely',async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111', owner='22222222-2222-4222-8222-222222222222',creator='33333333-3333-4333-8333-333333333333',profile='44444444-4444-4444-8444-444444444444',other='55555555-5555-4555-8555-555555555555';
 try{
  await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_app_meta_data jsonb);create role anon;create role authenticated;create role service_role;
   create table creator_profiles(id uuid primary key);create table content_profiles(id uuid unique,user_id uuid,creator_profile_id uuid,primary key(id,user_id));
   create table creator_research_opportunities(id uuid primary key,user_id uuid,content_profile_id uuid,status text,updated_at timestamptz);
   create table creator_research_feedback(id uuid,opportunity_id uuid,user_id uuid,action text,reason text,metadata jsonb,created_at timestamptz default now());`);
  for(const name of ['202610190001_search_quality.sql','202610190003_search_chat.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.query(`insert into auth.users values($1,'{"creator_cost_admin":true}'),($2,'{}')`,[admin,owner]);
  await db.query('insert into creator_profiles values($1)',[creator]);
  await db.query('insert into content_profiles values($1,$3,$4),($2,$3,$4)',[profile,other,owner,creator]);
  const next={...defaultSearchQuality,seekSituations:'Real safety situations',avoidTopics:'Staged clips'};
  async function proposal(scope='profile',version=0,defaults=0){const id=crypto.randomUUID();await db.query(`insert into creator_search_chat(id,actor,creator_id,profile_id,scope,message,base_version,defaults_version,before_settings,before_enabled,after_settings,status) values($1,$2,$3,$4,$5,'test',$6,$7,$8,false,$9,'ready')`,[id,admin,creator,profile,scope,version,defaults,JSON.stringify(defaultSearchQuality),JSON.stringify(next)]);return id;}
  const apply=(id:string,undo=false,actor=admin)=>db.query<{v:number}>('select creator_apply_search_chat($1,$2,$3) as v',[id,actor,undo]);
  const id=await proposal();
  expect((await db.query('select * from creator_search_quality')).rows).toEqual([]);
  await expect(apply(id,false,owner)).rejects.toThrow(/FORBIDDEN|PROPOSAL_NOT_FOUND/);
  expect((await apply(id)).rows[0].v).toBe(1);
  expect((await apply(id)).rows[0].v).toBe(1);
  expect((await db.query('select * from creator_search_quality where content_profile_id=$1',[other])).rows).toEqual([]);
  expect((await apply(id,true)).rows[0].v).toBe(2);
  expect((await db.query('select enabled from creator_search_quality')).rows).toEqual([{enabled:false}]);
  expect((await apply(id,true)).rows[0].v).toBe(2);
  const a=await proposal('creator'),b=await proposal('creator');
  await apply(a);await expect(apply(b)).rejects.toThrow(/VERSION_CONFLICT/);
  const stale=await proposal('profile',2,0);await expect(apply(stale)).rejects.toThrow(/VERSION_CONFLICT/);
  await apply(a,true);
  expect((await db.query('select settings from creator_search_defaults')).rows).toEqual([{settings:null}]);
  await db.query('select creator_save_search_quality($1,2,$2,$3)',[profile,JSON.stringify(next),admin]);
  expect((await db.query('select enabled from creator_search_quality')).rows).toEqual([{enabled:true}]);
  expect((await db.query(`select has_function_privilege('authenticated','creator_apply_search_chat(uuid,uuid,boolean)','execute') as allowed`)).rows).toEqual([{allowed:false}]);
 }finally{await db.close();}
});
