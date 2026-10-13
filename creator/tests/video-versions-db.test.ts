import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('isolates accounts, preserves immutable originals, and recovers duplicate version requests',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated;
   create table creator_scripts(id uuid primary key default gen_random_uuid(),user_id uuid not null,content_profile_id uuid,title text,hook text,body text,cta text,brief jsonb,updated_at timestamptz default now());
   alter table creator_scripts enable row level security;create policy owned on creator_scripts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());grant select,insert,update,delete on creator_scripts to authenticated;`);
  await db.query(`insert into creator_scripts(id,user_id,title,body,brief) values($1,$1,'VantageScore','saved script',$2)`,[a,JSON.stringify({production:{article_capture:{id:'screenshot'},voice_engine:'fish',render:{status:'ready',export_id:'original',job_id:'paid-job'}}})]);
  await db.exec(await readFile(new URL('../supabase/migrations/202610130001_video_versions.sql',import.meta.url),'utf8'));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');
  const create=async(key:string)=>(await db.query<{id:string;brief:any;version_number:number;project_id:string}>('select * from create_video_version($1,$2)',[a,key])).rows[0];
  const v2=await create(a);expect(v2.version_number).toBe(2);expect(v2.project_id).toBe(a);expect(v2.brief.production.article_capture.id).toBe('screenshot');expect(v2.brief.production.render).toBeUndefined();expect((await create(a)).id).toBe(v2.id);expect((await create(b)).id).toBe(v2.id);
  await expect(db.query('update creator_scripts set body=$1 where id=$2',['changed',a])).rejects.toThrow(/read-only/);
  await expect(db.query('delete from creator_scripts where id=$1',[a])).rejects.toThrow(/retained/);
  await db.query(`update creator_scripts set brief=jsonb_set(brief,'{production,voice_engine}','"starfish"') where id=$1`,[v2.id]);
  expect((await db.query<any>('select brief from creator_scripts where id=$1',[v2.id])).rows[0].brief.production.article_capture.id).toBe('screenshot');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);expect((await db.query('select * from creator_scripts')).rows).toHaveLength(0);await expect(create(b)).rejects.toThrow(/your account/);
 }finally{await db.close();}
},30000);
