import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("audits owner edits, rejects stale/non-owner writes and preserves voice setup and other profiles", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const admin = "22222222-2222-4222-8222-222222222222";
  const creator = "33333333-3333-4333-8333-333333333333";
  const first = "44444444-4444-4444-8444-444444444444";
  const second = "55555555-5555-4555-8555-555555555555";
  const stamp = "2026-10-19T00:00:00Z";
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key,raw_app_meta_data jsonb);
      create role anon; create role authenticated; create role service_role;
      create table creator_profiles(id uuid primary key,user_id uuid,display_name text,bio text,context jsonb,updated_at timestamptz,default_content_profile_id uuid);
      create table content_profiles(id uuid primary key,user_id uuid,creator_profile_id uuid,name text,primary_audience text,strategy jsonb,cta_default jsonb,cta_campaign jsonb,updated_at timestamptz,archived_at timestamptz);`);
    await db.exec(await readFile(new URL("../supabase/migrations/202610190002_admin_profile_edits.sql",import.meta.url),"utf8"));
    await db.query("insert into auth.users values($1,'{}'),($2,'{\"creator_cost_admin\":true}')",[owner,admin]);
    await db.query("insert into creator_profiles values($1,$2,'Steve','','{\"delivery\":{\"approved\":true},\"delivery_setup\":\"approved\"}',$3,$4)",[creator,owner,stamp,first]);
    await db.query("insert into content_profiles values($1,$3,$4,'Safety','Women','{\"research_screening_criteria\":\"original clips\"}','{\"text\":\"stay safe\"}','{\"id\":\"campaign\"}',$5,null),($2,$3,$4,'Other','Parents','{}',null,null,$5,null)",[first,second,owner,creator,stamp]);
    const save = (scope:string,id:string,input:unknown,actor=admin) => db.query<{profile:Record<string,any>}>("select creator_admin_save_profile($1,$2,$3,$4::jsonb,$5) as profile",[scope,id,stamp,JSON.stringify(input),actor]);
    const input = {display_name:"Stephen",bio:"Safety educator",context:{expertise:"Safety",delivery:{approved:false},delivery_setup:"skipped"}};
    await expect(save("creator",creator,input,owner)).rejects.toThrow(/FORBIDDEN/);
    const saved = (await save("creator",creator,input)).rows[0].profile;
    expect(saved.context).toEqual({expertise:"Safety",delivery:{approved:true},delivery_setup:"approved"});
    expect(saved.default_content_profile_id).toBe(first);
    expect(saved.user_id).toBe(owner);
    await expect(save("creator",creator,input)).rejects.toThrow(/VERSION_CONFLICT/);
    const content = (await save("content",first,{name:"Everyday safety",primary_audience:"Women",strategy:{tone:["Calm"]}})).rows[0].profile;
    expect(content.strategy).toEqual({tone:["Calm"],research_screening_criteria:"original clips"});
    expect(content.cta_default).toEqual({text:"stay safe"});
    expect(content.cta_campaign).toEqual({id:"campaign"});
    expect((await db.query("select name from content_profiles where id=$1",[second])).rows).toEqual([{name:"Other"}]);
    expect((await db.query("select count(*)::int as count from creator_admin_profile_edits")).rows).toEqual([{count:2}]);
    expect((await db.query("select has_function_privilege('authenticated','creator_admin_save_profile(text,uuid,timestamptz,jsonb,uuid)','execute') as allowed")).rows).toEqual([{allowed:false}]);
  } finally { await db.close(); }
});
