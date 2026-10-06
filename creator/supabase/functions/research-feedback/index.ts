import { createClient } from "@supabase/supabase-js";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
import { researchFeedbackRequestSchema } from "../../../src/domain/research.ts";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
function headersFor(origin: string | null): Record<string, string> { const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", vary: "Origin", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" }; if (origin) headers["access-control-allow-origin"] = origin; return headers; }
function reply(headers: Record<string, string>, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
const statusByAction: Record<string, string | undefined> = { saved: "saved", rejected: "rejected", selected: "selected", turned_into_content: "turned_into_content" };
Deno.serve(async (request) => {
  const origin = request.headers.get("origin"); const headers = headersFor(origin);
  if (origin && !isAllowedAppOrigin(origin, Deno.env.get("APP_ORIGIN"), Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"))) return reply(headers, { code: "ORIGIN" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(headers, { code: "METHOD" }, 405);
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, ""); if (!token) return reply(headers, { code: "AUTH" }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token); if (authError || !auth.user) return reply(headers, { code: "AUTH" }, 401);
    const input = researchFeedbackRequestSchema.parse(await request.json());
    const { data: opportunity, error: opportunityError } = await db.from("creator_research_opportunities").select("id,status").eq("id", input.opportunityId).eq("user_id", auth.user.id).maybeSingle();
    if (opportunityError || !opportunity) return reply(headers, { code: "OPPORTUNITY" }, 404);
    const nextStatus = statusByAction[input.action];
    if (nextStatus) {
      const updated = await db.from("creator_research_opportunities").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", opportunity.id).select("*").maybeSingle();
      if (updated.error || !updated.data) throw new Error("PERSISTENCE");
    }
    const feedback = await db.from("creator_research_feedback").insert({ id: crypto.randomUUID(), opportunity_id: opportunity.id, user_id: auth.user.id, action: input.action, reason: input.reason ?? null, note: input.note ?? "" });
    if (feedback.error) throw new Error("PERSISTENCE");
    return reply(headers, { ok: true, status: nextStatus ?? opportunity.status });
  } catch { return reply(headers, { code: "UNAVAILABLE" }, 503); }
});
