import { supabase } from "./supabase";

export type ResearchSource = { providerSourceId: number; title: string; url: string; snippet: string; publishedAt: string | null; sourceType: string };
export type ResearchOpportunity = {
  id: string; content_profile_id: string; title: string; factual_summary: string; why_audience_cares: string;
  creator_connection: string; recommended_angle: string; suggested_hook: string; category: string; published_at: string | null;
  timeliness_score: number; relevance_score: number; rank_score: number; source_snapshot: ResearchSource[]; uncertainty: string;
  status: "new" | "saved" | "rejected" | "selected" | "turned_into_content"; created_at: string; updated_at: string;
};
export type ResearchJob = { id: string; content_profile_id: string; requested_count: number; delivered_count: number; candidate_count: number; status: string; phase: string; error_code: string | null; created_at: string; updated_at: string; completed_at: string | null };
export type ResearchFeedFilter = "all" | "saved" | "used" | "skipped";
export type ResearchFeed = { active: boolean; remaining: number; limit: number; periodStart: string | null; jobs: ResearchJob[]; opportunities: ResearchOpportunity[]; opportunityTotal: number; pageOffset: number; pageSize: number; statusCounts: Record<ResearchFeedFilter, number> };

async function invoke<T>(name: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error("Research requires a signed-in account.");
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown>, signal: AbortSignal.timeout(45000) });
  if (!error) return data as T;
  let code = "UNAVAILABLE";
  try { code = (await error.context.json()).code ?? code; } catch { /* A generic retry message is safer than a raw upstream error. */ }
  const messages: Record<string, string> = {
    FEATURE_DISABLED: "Discover is not available for your account yet.", ENTITLEMENT: "Discover is not available for your account yet.",
    QUOTA: "You have used this period’s available opportunities.", NOT_CONFIGURED: "Research is being connected. Please try again later.",
    PROFILE: "Choose one of your content profiles before researching.",
  };
  throw new Error(messages[code] ?? "Research could not complete. Your existing opportunities are safe—please retry.");
}

export const loadResearchFeed = (profileId: string | undefined, options: { filter: ResearchFeedFilter; offset: number; limit: number }) => invoke<ResearchFeed>("research-feed", { ...(profileId ? { profileId } : {}), ...options });
export const requestResearch = (profileId: string, requestedCount: 10 | 20 | 30) => invoke<{ job: ResearchJob }>("research-request", { profileId, requestedCount, idempotencyKey: crypto.randomUUID() });
export const syncResearch = (jobId: string) => invoke<{ job: ResearchJob }>("research-sync", { jobId });
export const researchFeedback = (opportunityId: string, action: "saved" | "rejected" | "selected" | "script_created", reason?: string) => invoke<{ ok: true }>("research-feedback", { opportunityId, action, ...(reason ? { reason } : {}) });
export const refineResearchOpportunity = (opportunityId: string, instruction: string) => invoke<{ opportunity: ResearchOpportunity }>("research-refine", { opportunityId, instruction });
