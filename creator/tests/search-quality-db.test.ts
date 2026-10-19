import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("versions search rules, rejects stale saves, and keeps profiles isolated", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key);
      create role anon; create role authenticated; create role service_role;
      create table public.content_profiles(id uuid, user_id uuid, primary key(id,user_id));
      create table public.creator_research_opportunities(id uuid primary key,user_id uuid,content_profile_id uuid,status text,updated_at timestamptz);
      create table public.creator_research_feedback(id uuid,opportunity_id uuid,user_id uuid,action text,reason text,metadata jsonb default '{}'::jsonb,created_at timestamptz default now());`);
    await db.exec(await readFile(new URL("../supabase/migrations/202610190001_search_quality.sql", import.meta.url), "utf8"));
    const owner = "11111111-1111-4111-8111-111111111111";
    const admin = "22222222-2222-4222-8222-222222222222";
    const first = "33333333-3333-4333-8333-333333333333";
    const second = "44444444-4444-4444-8444-444444444444";
    await db.query("insert into auth.users values ($1),($2)", [owner, admin]);
    await db.query("insert into public.content_profiles values ($1,$3),($2,$3)", [first, second, owner]);
    const settings = { seekSituations: "Parking-lot safety", avoidTopics: "Staged skits", screeningCriteria: "Original clips", platforms: ["Instagram"], goodExamples: [], badExamples: [] };
    const save = (profile: string, expected: number, value = settings) => db.query<{ creator_save_search_quality: number }>(
      "select public.creator_save_search_quality($1,$2,$3::jsonb,$4) as creator_save_search_quality", [profile, expected, JSON.stringify(value), admin]);
    expect((await save(first, 0)).rows[0].creator_save_search_quality).toBe(1);
    await expect(save(first, 0)).rejects.toThrow(/VERSION_CONFLICT/);
    expect((await save(first, 1, { ...settings, avoidTopics: "News packaging" })).rows[0].creator_save_search_quality).toBe(2);
    expect((await db.query("select version from public.creator_search_quality where content_profile_id=$1", [second])).rows).toEqual([]);
    expect((await db.query("select version from public.creator_search_quality_history where content_profile_id=$1 order by version", [first])).rows).toEqual([{ version: 1 }, { version: 2 }]);
    const idea = "55555555-5555-4555-8555-555555555555";
    await db.query("insert into public.creator_research_opportunities values($1,$2,$3,'new',now())", [idea, owner, first]);
    const reject = () => db.query<{ creator_admin_reject_research: boolean }>("select public.creator_admin_reject_research($1,$2,'off_topic',$3) as creator_admin_reject_research", [first, idea, admin]);
    expect((await reject()).rows[0].creator_admin_reject_research).toBe(true);
    expect((await reject()).rows[0].creator_admin_reject_research).toBe(false);
    expect((await db.query("select count(*)::int as count from public.creator_research_feedback where opportunity_id=$1", [idea])).rows).toEqual([{ count: 1 }]);
    await expect(db.query("select public.creator_admin_reject_research($1,$2,'off_topic',$3)", [second, idea, admin])).rejects.toThrow(/OPPORTUNITY_NOT_FOUND/);
  } finally { await db.close(); }
});
