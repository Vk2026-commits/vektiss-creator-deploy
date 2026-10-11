import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('keeps audio reservations server-only and uniquely reserved per owner',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table provider_connections(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/202610110001_voice_previews.sql',import.meta.url),'utf8'));
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await expect(db.exec('select * from creator_voice_previews')).rejects.toThrow();await expect(db.exec('insert into creator_voice_previews default values')).rejects.toThrow();await db.exec('reset role');}
  const id='11111111-1111-4111-8111-111111111111';await db.query('insert into auth.users values($1)',[id]);await db.query('insert into provider_connections values($1)',[id]);
  await db.exec('set role service_role');
  const query="insert into creator_voice_previews(user_id,connection_id,revision,settings) values($1,$1,'same','{}')";
  await db.query(query,[id]);await expect(db.query(query,[id])).rejects.toThrow();
 }finally{await db.close();}
},30000);
