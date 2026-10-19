import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
import { defaultSearchQuality, qualityFromRow, searchQualitySettingsSchema } from "../../../src/domain/search-quality.ts";
import { creatorInputSchema, contentInputSchema } from "../../../src/domain/strategy.ts";
import {prepareSearchChat} from './chat.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const inputSchema = z.discriminatedUnion("action", [
  z.object({action:z.literal('chat_prepare'),requestId:z.string().uuid(),profileId:z.string().uuid(),scope:z.enum(['creator','profile']),message:z.string().trim().min(1).max(5000)}).strict(),
  z.object({action:z.literal('chat_history'),profileId:z.string().uuid(),scope:z.enum(['creator','profile'])}).strict(),
  z.object({action:z.literal('chat_apply'),requestId:z.string().uuid()}).strict(),
  z.object({action:z.literal('chat_undo'),requestId:z.string().uuid()}).strict(),
  z.object({ action: z.literal("creators"), offset: z.number().int().min(0).max(10000).default(0) }),
  z.object({ action: z.literal("creator_detail"), creatorId: z.string().uuid() }),
  z.object({ action: z.literal("save_creator"), creatorId: z.string().uuid(), expectedUpdatedAt: z.string().datetime({ offset: true }), input: creatorInputSchema }),
  z.object({ action: z.literal("save_content"), profileId: z.string().uuid(), expectedUpdatedAt: z.string().datetime({ offset: true }), input: contentInputSchema }),
  z.object({ action: z.literal("list"), offset: z.number().int().min(0).max(10000).default(0) }),
  z.object({ action: z.literal("detail"), profileId: z.string().uuid() }),
  z.object({ action: z.literal("save"), profileId: z.string().uuid(), expectedVersion: z.number().int().min(0), settings: searchQualitySettingsSchema }),
  z.object({ action: z.literal("rollback"), profileId: z.string().uuid(), expectedVersion: z.number().int().positive(), restoreVersion: z.number().int().positive() }),
  z.object({ action: z.literal("reject"), profileId: z.string().uuid(), opportunityId: z.string().uuid(), reason: z.enum(["off_topic","staged","duplicate","unavailable","poor_quality","not_relevant","wrong_angle"]) }),
]);
function headersFor(origin: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "Origin", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
function reply(headers: Record<string, string>, body: unknown, status = 200) { return new Response(JSON.stringify(body), { headers, status }); }

Deno.serve(async request => {
  const origin = request.headers.get("origin"); const headers = headersFor(origin);
  if (origin && !isAllowedAppOrigin(origin, Deno.env.get("APP_ORIGIN"), Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"))) return reply(headers, { code: "ORIGIN" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(headers, { code: "METHOD" }, 405);
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return reply(headers, { code: "AUTH" }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return reply(headers, { code: "AUTH" }, 401);
  // Never accept a creator or owner identity supplied by the browser.
  if (auth.user.app_metadata?.creator_cost_admin !== true) return reply(headers, { code: "FORBIDDEN" }, 403);
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply(headers, { code: "INPUT" }, 400);
  const input = parsed.data;
  try {
    if(input.action==='chat_prepare')return reply(headers,{request:await prepareSearchChat(db,auth.user.id,input,Deno.env.get('CREATOR_OPENAI_API_KEY'))});
    if(input.action==='chat_apply'||input.action==='chat_undo'){
      const result=await db.rpc('creator_apply_search_chat',{p_id:input.requestId,p_actor:auth.user.id,p_undo:input.action==='chat_undo'});
      if(result.error)return reply(headers,{code:result.error.message.includes('VERSION_CONFLICT')?'VERSION_CONFLICT':'SAVE_FAILED'},409);
      return reply(headers,{version:result.data});
    }
    if(input.action==='chat_history'){
      const profile=await db.from('content_profiles').select('creator_profile_id').eq('id',input.profileId).single();
      if(profile.error)return reply(headers,{code:'PROFILE'},404);
      let query=db.from('creator_search_chat').select('*').eq('actor',auth.user.id).eq('scope',input.scope);
      query=input.scope==='creator'?query.eq('creator_id',profile.data.creator_profile_id):query.eq('profile_id',input.profileId);
      const result=await query.order('created_at',{ascending:false}).limit(10);
      if(result.error)throw result.error;
      return reply(headers,{requests:result.data});
    }
    if (input.action === "creators") {
      const {data, error, count} = await db.from("creator_profiles").select("id,display_name", { count: "exact" }).order("display_name").order("id").range(input.offset, input.offset + 49);
      if (error) throw error;
      return reply(headers, { creators: data ?? [], total: count ?? 0 });
    }
    if (input.action === "creator_detail") {
      const {data: creator, error} = await db.from("creator_profiles").select("*").eq("id", input.creatorId).maybeSingle();
      if (error) throw error;
      if (!creator) return reply(headers, {code:"PROFILE"},404);
      // Page through all profiles; do not silently omit profiles at the API row limit.
      const profiles = [];
      for (let offset = 0; ; offset += 100) {
        const result = await db.from("content_profiles").select("*").eq("creator_profile_id", creator.id).eq("user_id", creator.user_id).order("created_at").order("id").range(offset, offset + 99);
        if (result.error) throw result.error;
        profiles.push(...result.data);
        if (result.data.length < 100) break;
      }
      return reply(headers, {creator, profiles});
    }
    if (input.action === "save_creator" || input.action === "save_content") {
      const {data, error} = await db.rpc("creator_admin_save_profile", {
        p_scope: input.action === "save_creator" ? "creator" : "content",
        p_profile_id: input.action === "save_creator" ? input.creatorId : input.profileId,
        p_expected_updated_at: input.expectedUpdatedAt, p_input: input.input, p_actor: auth.user.id,
      });
      if (error) return reply(headers, {code: error.message.includes("VERSION_CONFLICT") ? "VERSION_CONFLICT" : "SAVE_FAILED"}, error.message.includes("VERSION_CONFLICT") ? 409 : 503);
      return reply(headers, {profile: data});
    }
    if (input.action === "list") {
      const { data, error, count } = await db.from("content_profiles").select("id,user_id,creator_profile_id,name,primary_audience,archived_at,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(input.offset, input.offset + 49);
      if (error) throw error;
      const creatorIds = [...new Set((data ?? []).map(row => row.creator_profile_id))];
      const creators = creatorIds.length ? await db.from("creator_profiles").select("id,display_name").in("id", creatorIds) : { data: [], error: null };
      if (creators.error) throw creators.error;
      const names = new Map((creators.data ?? []).map(row => [row.id, row.display_name]));
      return reply(headers, { profiles: (data ?? []).map(row => ({ ...row, creator_name: names.get(row.creator_profile_id) ?? "Creator" })), total: count ?? 0 });
    }
    const { data: profile, error: profileError } = await db.from("content_profiles").select("*").eq("id", input.profileId).maybeSingle();
    if (profileError || !profile) return reply(headers, { code: "PROFILE" }, 404);
    if (input.action === "reject") {
      const { data: changed, error } = await db.rpc("creator_admin_reject_research", { p_profile_id: input.profileId, p_opportunity_id: input.opportunityId, p_reason: input.reason, p_actor: auth.user.id });
      if (error) return reply(headers, { code: error.message.includes("ALREADY_USED") ? "ALREADY_USED" : error.message.includes("OPPORTUNITY_NOT_FOUND") ? "OPPORTUNITY" : "SAVE_FAILED" }, error.message.includes("ALREADY_USED") ? 409 : 404);
      return reply(headers, { ok: true, reused: changed === false });
    }
    if (input.action === "save" || input.action === "rollback") {
      let settings = input.action === "save" ? input.settings : null;
      if (input.action === "rollback") {
        const { data: restore, error } = await db.from("creator_search_quality_history").select("settings").eq("content_profile_id", input.profileId).eq("version", input.restoreVersion).maybeSingle();
        if (error || !restore) return reply(headers, { code: "VERSION" }, 404);
        settings = searchQualitySettingsSchema.parse(restore.settings);
      }
      const { data: version, error } = await db.rpc("creator_save_search_quality", { p_profile_id: input.profileId, p_expected_version: input.expectedVersion, p_settings: settings, p_actor: auth.user.id });
      if (error) return reply(headers, { code: error.message.includes("VERSION_CONFLICT") ? "VERSION_CONFLICT" : "SAVE_FAILED" }, error.message.includes("VERSION_CONFLICT") ? 409 : 503);
      return reply(headers, { version });
    }
    const [quality, history, jobs, opportunities, defaults] = await Promise.all([
      db.from("creator_search_quality").select("*").eq("content_profile_id", input.profileId).maybeSingle(),
      db.from("creator_search_quality_history").select("version,settings,created_at").eq("content_profile_id", input.profileId).order("version", { ascending: false }).limit(20),
      db.from("creator_research_jobs").select("id,status,requested_count,delivered_count,candidate_count,phase,provider_metadata,created_at").eq("content_profile_id", input.profileId).order("created_at", { ascending: false }).limit(20),
      db.from("creator_research_opportunities").select("id,title,category,relevance_score,source_snapshot,status,job_id,created_at").eq("content_profile_id", input.profileId).order("created_at", { ascending: false }).limit(40),
      db.from('creator_search_defaults').select('*').eq('creator_id',profile.creator_profile_id).maybeSingle(),
    ]);
    if (quality.error || history.error || jobs.error || opportunities.error || defaults.error) throw Error("READ_FAILED");
    const ids = (opportunities.data ?? []).map(item => item.id);
    const feedback = ids.length ? await db.from("creator_research_feedback").select("opportunity_id,reason,action,created_at").in("opportunity_id", ids).eq("action", "rejected").order("created_at", { ascending: false }).limit(100) : { data: [], error: null };
    if (feedback.error) throw Error("READ_FAILED");
    const strategy = profile.strategy && typeof profile.strategy === "object" && !Array.isArray(profile.strategy) ? profile.strategy as Record<string, unknown> : {};
    return reply(headers, { profile, version: quality.data?.version ?? 0, inherited: !quality.data?.enabled && !!defaults.data?.settings, settings: quality.data?.enabled ? qualityFromRow(quality.data) : defaults.data?.settings ?? {
      ...defaultSearchQuality,
      screeningCriteria: String(strategy.research_screening_criteria ?? ""),
      platforms: Array.isArray(strategy.research_source_platforms) && strategy.research_source_platforms.length
        ? strategy.research_source_platforms : defaultSearchQuality.platforms,
    }, history: history.data ?? [], jobs: jobs.data ?? [], opportunities: opportunities.data ?? [], feedback: feedback.data ?? [] });
  } catch {
    return reply(headers, { code: "UNAVAILABLE" }, 503);
  }
});
