import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const inputSchema = z.object({ profileId: z.string().uuid().optional() }).strict();
function headersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "Origin", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
function reply(headers: Record<string, string>, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
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
    const jobs = await db.from("creator_research_jobs").select("id,content_profile_id,requested_count,delivered_count,candidate_count,status,phase,error_code,created_at,updated_at,completed_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(30);
    let opportunities = db.from("creator_research_opportunities").select("id,content_profile_id,title,factual_summary,why_audience_cares,creator_connection,recommended_angle,suggested_hook,category,published_at,timeliness_score,relevance_score,rank_score,source_snapshot,uncertainty,status,created_at,updated_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(120);
    if (input.profileId) opportunities = opportunities.eq("content_profile_id", input.profileId);
    const opportunityResult = await opportunities;
    if (jobs.error || opportunityResult.error) throw new Error("PERSISTENCE");
    const active = Boolean(config?.feature_enabled && entitlement?.enabled);
    const limit = Number(entitlement?.monthly_opportunity_limit ?? 0);
    const remaining = active ? Math.max(0, limit - Number(entitlement?.delivered_count ?? 0) - Number(entitlement?.reserved_count ?? 0)) : 0;
    return reply(headers, { active, remaining, limit, periodStart: entitlement?.period_start ?? null, jobs: jobs.data ?? [], opportunities: opportunityResult.data ?? [] });
  } catch { return reply(headers, { code: "UNAVAILABLE" }, 503); }
});
