import {filterLibraryPlatform} from '../../../src/domain/discovery-engagement.ts';
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
import {filterResearchSource} from '../../../src/domain/research-feed-source.ts';
import {orderResearch} from '../../../src/domain/research-sort.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const feedFilterSchema = z.enum(["all", "saved", "used", "skipped"]);
const inputSchema = z.object({ platform:z.enum(['all','TikTok','Instagram','YouTube']).default('all'), sort:z.enum(['match','newest','oldest','discovered','views','engagement','outlier']).default('discovered'), sourceMode:z.enum(["all","videos","articles"]).default("all"), profileId: z.string().uuid().optional(), filter: feedFilterSchema.default("all"), offset: z.number().int().min(0).max(100000).default(0), limit: z.number().int().min(6).max(30).default(8) }).strict();
type FeedFilter = z.infer<typeof feedFilterSchema>;
const opportunityFields = "id,content_profile_id,title,factual_summary,why_audience_cares,creator_connection,recommended_angle,suggested_hook,category,published_at,timeliness_score,relevance_score,rank_score,source_snapshot,uncertainty,status,created_at,updated_at";
function headersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "Origin", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
function reply(headers: Record<string, string>, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
function applyFilter(query: any, filter: FeedFilter) {
  if (filter === "saved") return query.eq("status", "saved");
  if (filter === "used") return query.in("status", ["selected", "turned_into_content"]);
  if (filter === "skipped") return query.eq("status", "rejected");
  return query.neq("status", "rejected");
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin"); const headers = headersFor(origin);
  if (origin && !isAllowedAppOrigin(origin, Deno.env.get("APP_ORIGIN"), Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"))) return reply(headers, { code: "ORIGIN" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(headers, { code: "METHOD" }, 405);
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, ""); if (!token) return reply(headers, { code: "AUTH" }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token); if (authError || !auth.user) return reply(headers, { code: "AUTH" }, 401);
    const input = inputSchema.parse(await request.json());
    const { data: entitlement } = await db.from("creator_research_entitlements").select("enabled,monthly_opportunity_limit,delivered_count,reserved_count,period_start").eq("user_id", auth.user.id).maybeSingle();
    const { data: config } = await db.from("creator_research_config").select("feature_enabled").eq("id", true).maybeSingle();
    const jobs = db.from("creator_research_jobs").select("id,content_profile_id,requested_count,delivered_count,candidate_count,status,phase,error_code,created_at,updated_at,completed_at,engagement_diagnostics:provider_metadata->engagementDiagnostics,retrieval_diagnostics:provider_metadata->searchDiagnostics,review_limited:provider_metadata->reviewLimited,relevance_review_limited:provider_metadata->relevanceReviewLimited")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(30);
    let opportunities = db.from("creator_research_opportunities").select(opportunityFields, { count: "exact" }).eq("user_id", auth.user.id);
    if (input.profileId) opportunities = opportunities.eq("content_profile_id", input.profileId);
    opportunities = orderResearch(applyFilter(filterLibraryPlatform(filterResearchSource(opportunities,input.sourceMode),input.platform), input.filter),input.sort).range(input.offset, input.offset + input.limit - 1);
    const countFor = async (filter: FeedFilter) => {
      let query = db.from("creator_research_opportunities").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
      if (input.profileId) query = query.eq("content_profile_id", input.profileId);
      const result = await applyFilter(filterLibraryPlatform(filterResearchSource(query,input.sourceMode),input.platform), filter);
      if (result.error) throw new Error("PERSISTENCE");
      return result.count ?? 0;
    };
    const [jobResult, opportunityResult, all, saved, used, skipped] = await Promise.all([jobs, opportunities, countFor("all"), countFor("saved"), countFor("used"), countFor("skipped")]);
    if (jobResult.error || opportunityResult.error) throw new Error("PERSISTENCE");
    const active = Boolean(config?.feature_enabled && entitlement?.enabled);
    const monthlyLimit = Number(entitlement?.monthly_opportunity_limit ?? 0);
    const remaining = active ? Math.max(0, monthlyLimit - Number(entitlement?.delivered_count ?? 0) - Number(entitlement?.reserved_count ?? 0)) : 0;
    const pilot=input.profileId?await db.from('creator_discovery_pilot').select('enabled').eq('content_profile_id',input.profileId).maybeSingle():{data:null,error:null};
    if(pilot.error)throw Error('PERSISTENCE');
    return reply(headers, { pilot:{profileId:input.profileId??'',configured:Boolean(pilot.data),enabled:pilot.data?.enabled??false}, active, remaining, limit: monthlyLimit, periodStart: entitlement?.period_start ?? null, jobs: jobResult.data ?? [], opportunities: opportunityResult.data ?? [], opportunityTotal: opportunityResult.count ?? 0, pageOffset: input.offset, pageSize: input.limit, statusCounts: { all, saved, used, skipped } });
  } catch { return reply(headers, { code: "UNAVAILABLE" }, 503); }
});
