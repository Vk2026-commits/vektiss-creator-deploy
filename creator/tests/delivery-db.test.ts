import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('isolates analysis status and forbids client writes or stored reference payloads',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select current_setting('app.user',true)::uuid$$;grant usage on schema auth,public to authenticated;");
  await db.exec(await readFile(new URL('../supabase/migrations/202610120001_delivery_analysis.sql',import.meta.url),'utf8'));
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.query("insert into creator_delivery_analyses(id,user_id,model) values($1,$1,'test'),($2,$2,'test')",[a,b]);
  await db.exec(`set role authenticated;select set_config('app.user','${a}',false)`);
  expect((await db.query('select * from creator_delivery_analyses')).rows).toHaveLength(1);
  expect((await db.query('select * from creator_delivery_analyses where user_id=$1',[b])).rows).toHaveLength(0);
  await expect(db.exec("update creator_delivery_analyses set status='complete'")).rejects.toThrow();
  await expect(db.exec('insert into creator_delivery_analyses default values')).rejects.toThrow();
  await db.exec('reset role');
  const fields=(await db.query<{column_name:string}>("select column_name from information_schema.columns where table_name='creator_delivery_analyses'")).rows.map(r=>r.column_name);
  expect(fields).not.toContain('audio');expect(fields).not.toContain('transcript');expect(fields).not.toContain('suggestions');
 }finally{await db.close();}
},30000);
