import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';

it('lets a new user create and edit only their own onboarding profiles',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;
   create table creator_profiles(id uuid primary key default gen_random_uuid(),user_id uuid unique not null,display_name text not null,bio text not null default '',context jsonb not null default '{}',default_content_profile_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
   create table content_profiles(id uuid primary key default gen_random_uuid(),user_id uuid not null,creator_profile_id uuid not null references creator_profiles(id),name text not null,primary_audience text not null,strategy jsonb not null,cta_default jsonb,cta_campaign jsonb,archived_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
   alter table creator_profiles enable row level security;alter table content_profiles enable row level security;
   create policy creator_owner on creator_profiles to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
   create policy content_owner on content_profiles to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
   grant usage on schema public,auth to authenticated;grant select on creator_profiles,content_profiles to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610120002_onboarding_write_grants.sql',import.meta.url),'utf8'));
  await db.query("select set_config('app.user',$1,false)",[a]);await db.exec('set role authenticated');
  const creator=(await db.query<{id:string}>("insert into creator_profiles(user_id,display_name,bio,context) values($1,'Ricky','','{}') returning id",[a])).rows[0];
  await db.query("insert into content_profiles(user_id,creator_profile_id,name,primary_audience,strategy) values($1,$2,'Audience','People','{}')",[a,creator.id]);
  expect((await db.query('select * from creator_profiles')).rows).toHaveLength(1);
  expect((await db.query('select * from content_profiles')).rows).toHaveLength(1);
  await expect(db.query("insert into creator_profiles(user_id,display_name,bio,context) values($1,'Other','','{}')",[b])).rejects.toThrow();
  await expect(db.query("update creator_profiles set display_name='Changed' where user_id=$1",[b])).resolves.toMatchObject({affectedRows:0});
  await expect(db.exec("update creator_profiles set user_id='22222222-2222-4222-8222-222222222222' where user_id='11111111-1111-4111-8111-111111111111'")).rejects.toThrow();
 }finally{await db.close();}
},30000);
