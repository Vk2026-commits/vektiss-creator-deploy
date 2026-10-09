import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('keeps certification private and prevents users from certifying themselves',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;create table provider_connections(id uuid primary key);create table avatar_profiles(id uuid primary key);create table creator_presenter_tests(id uuid primary key);`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610090004_avatar_verification.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202610090005_avatar_visual_review.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  for(const table of ['provider_connections','avatar_profiles','creator_presenter_tests'])await db.query(`insert into ${table} values($1)`,[a]);
  await db.query(`insert into creator_avatar_verifications(user_id,connection_id,avatar_id,engine,aspect_ratio,test_id,verification_version,crop,source_width,source_height) values($1,$1,$1,'avatar_iii','9:16',$1,1,'{"x":0,"y":0,"width":10,"height":20}',720,1280)`,[a]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');
  expect((await db.query('select * from creator_avatar_verifications')).rows).toHaveLength(1);
  await expect(db.exec("update creator_avatar_verifications set engine='avatar_v'")).rejects.toThrow();
  await expect(db.exec("update creator_avatar_verifications set visual_approved_at=now()")).rejects.toThrow();
  await expect(db.exec("delete from creator_avatar_verifications")).rejects.toThrow();
  await expect(db.exec("insert into creator_avatar_verifications default values")).rejects.toThrow();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  expect((await db.query('select * from creator_avatar_verifications')).rows).toHaveLength(0);
 }finally{await db.close();}
},30000);
