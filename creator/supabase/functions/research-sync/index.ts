import { createClient } from "@supabase/supabase-js";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
import { getDeepResearchRun, startNativeVideoScreening } from "../_shared/research-provider.ts";
import { getNativeDiscoveryRun } from "../_shared/platform-discovery.ts";
import {
  canonicalResearchUrl,
  rankResearchCandidates,
  researchBriefSchema,
  researchSourceSchema,
  type ResearchHistorySignal,
  type ResearchSource,
} from "../../../src/domain/research.ts";
import { z } from "zod";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const requestSchema = z.object({ jobId: z.string().uuid() }).strict();

function headersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json", "cache-control": "no-store", vary: "Origin",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
function reply(headers: Record<string, string>, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
function providerCost(usage: Record<string, unknown>): number | null {
  const cost = usage.cost;
  if (!cost || typeof cost !== "object") return null;
  const value = (cost as Record<string, unknown>).total_cost;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
async function releaseReservation(userId: string, amount: number, delivered = 0) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data } = await db.from("creator_research_entitlements").select("reserved_count,delivered_count").eq("user_id", userId).maybeSingle();
    if (!data) return;
    const updated = await db.from("creator_research_entitlements")
      .update({ reserved_count: Math.max(0, Number(data.reserved_count) - amount), delivered_count: Number(data.delivered_count) + delivered, updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("reserved_count", data.reserved_count).eq("delivered_count", data.delivered_count).select("user_id");
    if (!updated.error && updated.data?.length) return;
  }
  throw new Error("PERSISTENCE");
}
async function markFailed(job: Record<string, unknown>, code: string, cancelled = false) {
  if (["ready", "failed", "cancelled"].includes(String(job.status))) return;
  await db.from("creator_research_jobs").update({
    status: cancelled ? "cancelled" : "failed", phase: cancelled ? "Research cancelled" : "Research unavailable", error_code: code,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  await releaseReservation(String(job.user_id), Number(job.reserved_count));
  await db.from("creator_research_usage").insert({
    id: crypto.randomUUID(), job_id: job.id, user_id: job.user_id, operation: "deep_research_failed",
    provider_response_id: job.provider_response_id ?? null, status: cancelled ? "cancelled" : "failed", request_metadata: { code },
  });
}

function metadata(job: Record<string, unknown>): Record<string, unknown> {
  const value = job.provider_metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nativeSources(value: unknown): ResearchSource[] {
  const parsed = z.array(researchSourceSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = headersFor(origin);
  if (origin && !isAllowedAppOrigin(origin, Deno.env.get("APP_ORIGIN"), Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"))) return reply(headers, { code: "ORIGIN" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(headers, { code: "METHOD" }, 405);
  let job: Record<string, unknown> | null = null;
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return reply(headers, { code: "AUTH" }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply(headers, { code: "AUTH" }, 401);
    const input = requestSchema.parse(await request.json());
    const loaded = await db.from("creator_research_jobs").select("*").eq("id", input.jobId).eq("user_id", auth.user.id).maybeSingle();
    if (loaded.error || !loaded.data) return reply(headers, { code: "JOB" }, 404);
    job = loaded.data as Record<string, unknown>;
    if (["ready", "failed", "cancelled"].includes(String(job.status))) return reply(headers, { job });
    if (!job.provider_response_id) {
      await markFailed(job, "PROVIDER_RESPONSE_MISSING");
      return reply(headers, { code: "PROVIDER_RESPONSE_MISSING" }, 503);
    }

    const brief = researchBriefSchema.safeParse(job.input_snapshot);
    if (!brief.success) throw new Error("RESEARCH_INPUT");
    const providerMetadata = metadata(job);
    if (providerMetadata.stage === "native_discovery") {
      if (job.status !== "researching") return reply(headers, { job }, 202);
      const discovery = await getNativeDiscoveryRun(String(job.provider_response_id), Number(job.requested_count));
      if (discovery.state === "pending") {
        const updated = await db.from("creator_research_jobs").update({
          status: "researching", phase: "Finding direct TikTok videos…",
          provider_metadata: { ...providerMetadata, apifyStatus: discovery.status }, updated_at: new Date().toISOString(),
        }).eq("id", job.id).select("*").maybeSingle();
        return reply(headers, { job: updated.data ?? job }, 202);
      }
      if (discovery.state === "failed") {
        await markFailed(job, `APIFY_${discovery.status}`);
        return reply(headers, { code: `APIFY_${discovery.status}` }, 503);
      }
      if (!discovery.sources.length) {
        await markFailed(job, "NATIVE_DISCOVERY_EMPTY");
        return reply(headers, { code: "NATIVE_DISCOVERY_EMPTY" }, 503);
      }
      const discoveredUrls = discovery.sources
        .map((source) => canonicalResearchUrl(source.url))
        .filter((url): url is string => Boolean(url));
      const known = discoveredUrls.length
        ? await db.from("creator_research_sources").select("canonical_url").eq("user_id", auth.user.id).in("canonical_url", discoveredUrls)
        : { data: [], error: null };
      if (known.error) throw new Error("PERSISTENCE");
      const knownUrls = new Set((known.data ?? []).map((source) => String(source.canonical_url)));
      const freshSources = discovery.sources.filter((source) => {
        const canonical = canonicalResearchUrl(source.url);
        return canonical && !knownUrls.has(canonical);
      });
      if (!freshSources.length) {
        await markFailed(job, "NATIVE_DISCOVERY_NO_NEW_LEADS");
        return reply(headers, { code: "NATIVE_DISCOVERY_NO_NEW_LEADS" }, 503);
      }
      const claimed = await db.from("creator_research_jobs").update({
        status: "reviewing_sources", phase: "Checking clip quality…", updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "researching").select("*").maybeSingle();
      if (claimed.error) throw new Error("PERSISTENCE");
      if (!claimed.data) {
        const { data: current } = await db.from("creator_research_jobs").select("*").eq("id", job.id).maybeSingle();
        return reply(headers, { job: current ?? job }, 202);
      }
      job = claimed.data as Record<string, unknown>;
      const screening = await startNativeVideoScreening({ brief: brief.data, requestedCount: Number(job.requested_count), sources: freshSources });
      const compactSources = freshSources.map((source) => ({ ...source, snippet: source.snippet.slice(0, 1200) }));
      const updated = await db.from("creator_research_jobs").update({
        provider_response_id: screening.id, status: "researching", phase: "Ranking direct video leads…",
        provider_metadata: {
          ...providerMetadata, stage: "perplexity_screening", apifyStatus: discovery.status,
          nativeSources: compactSources, discoveredSourceCount: discovery.sources.length, freshSourceCount: freshSources.length,
          duplicateSourceCount: discovery.sources.length - freshSources.length, screeningModel: screening.model ?? null, screeningStatus: screening.status,
        }, updated_at: new Date().toISOString(),
      }).eq("id", job.id).select("*").maybeSingle();
      if (updated.error || !updated.data) throw new Error("PERSISTENCE");
      return reply(headers, { job: updated.data }, 202);
    }
    const suppliedSources = providerMetadata.stage === "perplexity_screening" ? nativeSources(providerMetadata.nativeSources) : undefined;
    if (providerMetadata.stage === "perplexity_screening" && !suppliedSources?.length) throw new Error("NATIVE_SOURCES_MISSING");
    const providerRun = await getDeepResearchRun(String(job.provider_response_id), brief.data, suppliedSources);
    if (["queued", "in_progress"].includes(providerRun.status)) {
      const phase = providerMetadata.stage === "perplexity_screening" ? "Checking clip quality…" : "Researching…";
      const updated = await db.from("creator_research_jobs").update({ status: "researching", phase, updated_at: new Date().toISOString() }).eq("id", job.id).select("*").maybeSingle();
      return reply(headers, { job: updated.data ?? job }, 202);
    }
    if (["failed", "cancelled", "incomplete"].includes(providerRun.status)) {
      await markFailed(job, `PROVIDER_${providerRun.status.toUpperCase()}`, providerRun.status === "cancelled");
      return reply(headers, { code: `PROVIDER_${providerRun.status.toUpperCase()}` }, 503);
    }
    if (providerRun.status !== "completed" || !("candidates" in providerRun)) return reply(headers, { code: "PROVIDER" }, 502);

    const claimed = await db.from("creator_research_jobs").update({ status: "reviewing_sources", phase: "Reviewing sources…", updated_at: new Date().toISOString() })
      .eq("id", job.id).eq("status", "researching").select("*").maybeSingle();
    if (claimed.error) throw new Error("PERSISTENCE");
    if (!claimed.data) {
      const { data: current } = await db.from("creator_research_jobs").select("*").eq("id", job.id).maybeSingle();
      return reply(headers, { job: current ?? job }, 202);
    }
    job = claimed.data as Record<string, unknown>;

    const { data: duplicateRows, error: duplicateError } = await db.from("creator_research_opportunities")
      .select("title,category,status,source_snapshot").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(250);
    if (duplicateError) throw new Error("PERSISTENCE");
    const { data: historicalRows, error: historyError } = await db.from("creator_research_opportunities")
      .select("id,title,category,status,source_snapshot").eq("user_id", auth.user.id).eq("content_profile_id", job.content_profile_id).order("created_at", { ascending: false }).limit(250);
    if (historyError) throw new Error("PERSISTENCE");
    // Fetch one latest rejection per idea, not every click. Bounded parallel
    // batches avoid both PostgREST row limits and an unbounded request fan-out.
    const reasons = new Map<string, ResearchHistorySignal['rejectionReason']>();
    const rejected = (historicalRows ?? []).filter(row => row.status === 'rejected');
    for (let offset = 0; offset < rejected.length; offset += 10) {
      await Promise.all(rejected.slice(offset, offset + 10).map(async row => {
        const result = await db.from('creator_research_feedback').select('reason').eq('user_id', auth.user.id)
          .eq('opportunity_id', row.id).eq('action', 'rejected').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
        if (result.error) throw new Error('PERSISTENCE');
        reasons.set(row.id, result.data?.reason ?? null);
      }));
    }
    const history: ResearchHistorySignal[] = (historicalRows ?? []).flatMap((row) => {
      const sources = z.array(z.object({ providerSourceId: z.number(), title: z.string(), url: z.string(), snippet: z.string(), publishedAt: z.string().nullable(), sourceType: z.string() })).safeParse(row.source_snapshot);
      return sources.success ? [{ title: row.title, category: row.category, status: row.status, sourceSnapshot: sources.data, rejectionReason: reasons.get(row.id) }] : [];
    });
    const duplicateHistory: ResearchHistorySignal[] = (duplicateRows ?? []).flatMap(row => {
      const sources = z.array(z.object({ providerSourceId: z.number(), title: z.string(), url: z.string(), snippet: z.string(), publishedAt: z.string().nullable(), sourceType: z.string() })).safeParse(row.source_snapshot);
      return sources.success ? [{ title: row.title, category: row.category, status: row.status, sourceSnapshot: sources.data }] : [];
    });
    const ranked = rankResearchCandidates(providerRun.candidates, providerRun.sources, history, Number(job.requested_count), duplicateHistory);
    if (!ranked.length) throw new Error("NO_NEW_OPPORTUNITIES");
    await db.from("creator_research_jobs").update({ status: "ranking", phase: "Ranking opportunities…", updated_at: new Date().toISOString() }).eq("id", job.id);

    const uniqueSources = new Map<string, ResearchSource>();
    for (const candidate of ranked) for (const source of candidate.sources) {
      const canonical = canonicalResearchUrl(source.url);
      if (canonical) uniqueSources.set(canonical, { ...source, url: canonical });
    }
    const urls = [...uniqueSources.keys()];
    const existingSources = await db.from("creator_research_sources").select("id,canonical_url").eq("user_id", auth.user.id).in("canonical_url", urls);
    if (existingSources.error) throw new Error("PERSISTENCE");
    const existingByUrl = new Map((existingSources.data ?? []).map((source) => [source.canonical_url, source.id]));
    const newSources = [...uniqueSources.entries()].filter(([url]) => !existingByUrl.has(url)).map(([canonicalUrl, source]) => ({
      id: crypto.randomUUID(), user_id: auth.user.id, canonical_url: canonicalUrl, title: source.title, snippet: source.snippet,
      source_type: source.sourceType, published_at: source.publishedAt, provider_source_id: source.providerSourceId,
    }));
    if (newSources.length) {
      const insertedSources = await db.from("creator_research_sources").insert(newSources).select("id,canonical_url");
      if (insertedSources.error) throw new Error("PERSISTENCE");
      for (const source of insertedSources.data ?? []) existingByUrl.set(source.canonical_url, source.id);
    }

    const opportunityRows = ranked.map((candidate) => ({
      id: crypto.randomUUID(), job_id: job!.id, user_id: auth.user.id, content_profile_id: job!.content_profile_id,
      normalized_title: candidate.normalizedTitle, title: candidate.title, factual_summary: candidate.factualSummary,
      why_audience_cares: candidate.whyAudienceCares, creator_connection: candidate.creatorConnection,
      recommended_angle: candidate.recommendedAngle, suggested_hook: candidate.suggestedHook, category: candidate.category,
      published_at: candidate.publishedAt, timeliness_score: candidate.timelinessScore, relevance_score: candidate.relevanceScore,
      rank_score: candidate.rankScore, uncertainty: candidate.uncertainty,
      evidence_state: candidate.uncertainty ? "partial" : "source_backed", source_snapshot: candidate.sources,
    }));
    const insertedOpportunities = await db.from("creator_research_opportunities").insert(opportunityRows).select("id,source_snapshot");
    if (insertedOpportunities.error || !insertedOpportunities.data) throw new Error("PERSISTENCE");
    const sourceLinks = insertedOpportunities.data.flatMap((opportunity, index) =>
      (opportunity.source_snapshot as ResearchSource[]).flatMap((source, sourceIndex) => {
        const id = existingByUrl.get(canonicalResearchUrl(source.url) ?? "");
        return id ? [{ opportunity_id: opportunity.id, source_id: id, source_order: sourceIndex + 1 }] : [];
      }),
    );
    if (sourceLinks.length) {
      const links = await db.from("creator_research_opportunity_sources").insert(sourceLinks);
      if (links.error) throw new Error("PERSISTENCE");
    }
    const shown = await db.from("creator_research_feedback").insert(insertedOpportunities.data.map((opportunity) => ({
      id: crypto.randomUUID(), opportunity_id: opportunity.id, user_id: auth.user.id, action: "shown", metadata: { jobId: job!.id },
    })));
    if (shown.error) throw new Error("PERSISTENCE");

    const delivered = insertedOpportunities.data.length;
    await releaseReservation(auth.user.id, Number(job.reserved_count), delivered);
    const usage = providerRun.usage;
    const finalJob = await db.from("creator_research_jobs").update({
      status: "ready", phase: "Your opportunities are ready.", delivered_count: delivered, candidate_count: providerRun.candidates.length,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id).select("*").maybeSingle();
    if (finalJob.error || !finalJob.data) throw new Error("PERSISTENCE");
    await db.from("creator_research_usage").insert({
      id: crypto.randomUUID(), job_id: job.id, user_id: auth.user.id, operation: "deep_research_complete",
      provider_response_id: providerRun.id, model: providerRun.model ?? null, status: "completed", usage,
      provider_cost_usd: providerCost(usage), candidate_count: providerRun.candidates.length, accepted_count: delivered,
      elapsed_ms: job.started_at ? Date.now() - new Date(String(job.started_at)).getTime() : null,
      request_metadata: { requestedCount: job.requested_count, sourceCount: providerRun.sources.length },
    });
    return reply(headers, { job: finalJob.data, deliveredCount: delivered });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "UNAVAILABLE";
    if (job) {
      await db.from("creator_research_opportunities").delete().eq("job_id", job.id);
      await markFailed(job, code);
    }
    return reply(headers, { code: "RESEARCH_SYNC_FAILED" }, 503);
  }
});
