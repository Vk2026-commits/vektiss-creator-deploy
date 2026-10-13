import { createClient } from "@supabase/supabase-js";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
import { getDeepResearchRun, startNativeVideoScreening, type CompletedResearchRun, type ProviderRun } from "../_shared/research-provider.ts";
import { getNativeDiscoveryRun, renumberNativeSources, type NativeDiscoveryResult, type NativePlatform } from "../_shared/platform-discovery.ts";
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
const requestSchema = z.object({ jobId: z.string().uuid(), action:z.enum(['sync','stop']).default('sync') }).strict();

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
async function markFailed(job: Record<string, unknown>, code: string, cancelled = false, diagnostics: {incompleteReason?:string;usage?:Record<string,unknown>;model?:string} = {}) {
  if (["ready", "failed", "cancelled"].includes(String(job.status))) return;
  await db.from("creator_research_jobs").update({
    status: cancelled ? "cancelled" : "failed", reserved_count:0, phase: cancelled ? "Research cancelled" : "Research unavailable", error_code: code,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", job.id);

  await db.from("creator_research_usage").insert({
    id: crypto.randomUUID(), job_id: job.id, user_id: job.user_id, operation: "deep_research_failed",
    provider_response_id: job.provider_response_id ?? null, status: cancelled ? "cancelled" : "failed",
    model:diagnostics.model, usage:diagnostics.usage ?? {}, provider_cost_usd:providerCost(diagnostics.usage ?? {}),
    request_metadata: { code, incompleteReason:diagnostics.incompleteReason },
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
    if(input.action==='stop'){
      const stopped=await db.rpc('creator_research_stop',{p_job_id:input.jobId,p_user_id:auth.user.id});
      if(stopped.error)return reply(headers,{code:'STOP_FAILED'},503);
      return reply(headers,{job:stopped.data});
    }
    if (["ready", "failed", "cancelled"].includes(String(job.status))) return reply(headers, { job });
    if (!job.provider_response_id) {
      if(job.status==='queued')return reply(headers,{job},202);
      await markFailed(job, "PROVIDER_RESPONSE_MISSING");
      return reply(headers, { code: "PROVIDER_RESPONSE_MISSING" }, 503);
    }

    const brief = researchBriefSchema.safeParse(job.input_snapshot);
    if (!brief.success) throw new Error("RESEARCH_INPUT");
    const providerMetadata = metadata(job);
    if (providerMetadata.stage === "native_discovery" || providerMetadata.stage === "multi_discovery") {
      if (job.status !== "researching") return reply(headers, { job }, 202);
      const multi = providerMetadata.stage === "multi_discovery";
      const runs = multi && Array.isArray(providerMetadata.discoveryRuns) ? providerMetadata.discoveryRuns as Array<Record<string, unknown>> : [];
      const checkedRuns = multi ? await Promise.all(runs.map(async (run) => {
        if (run.state === "completed" || run.state === "failed") return run;
        const platform: NativePlatform = run.platform === "YouTube" || run.platform === "Instagram" ? run.platform : "TikTok";
        try {
          const result = await getNativeDiscoveryRun(String(run.id), Number(job!.requested_count), brief.data, platform);
          return { ...run, ...result, sources: result.state === "completed" ? result.sources.map((source) => ({ ...source, snippet: source.snippet.slice(0, 1200) })) : [] };
        } catch { return { ...run, state: "failed", status: "PROVIDER_ERROR", sources: [] }; }
      })) : [];
      const sourceGroups = checkedRuns.map((run) => run.state === "completed" && Array.isArray(run.sources) ? nativeSources(run.sources) : []);
      const balancedSources = Array.from({ length: Math.max(0, ...sourceGroups.map((group) => group.length)) }, (_, index) =>
        sourceGroups.flatMap((group) => group[index] ? [group[index]] : [])).flat();
      const discovery: NativeDiscoveryResult = multi
        ? checkedRuns.some((run) => run.state === "pending")
          ? { state: "pending", status: "MULTI" }
          : { state: "completed", status: "MULTI", sources: balancedSources }
        : await getNativeDiscoveryRun(String(job.provider_response_id), Number(job.requested_count), brief.data);
      if (discovery.state === "pending") {
        const updated = await db.from("creator_research_jobs").update({
          status: "researching", phase: multi ? "Finding direct social videos…" : "Finding direct TikTok videos…",
          provider_metadata: { ...providerMetadata, apifyStatus: discovery.status, ...(multi ? { discoveryRuns: checkedRuns } : {}) }, updated_at: new Date().toISOString(),
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
      const uniqueSources = [...new Map(discovery.sources.map((source) => [canonicalResearchUrl(source.url), source])).values()]
        .slice(0, Math.min(90, Math.max(45, Number(job.requested_count) * 7)));
      const discoveredUrls = uniqueSources
        .map((source) => canonicalResearchUrl(source.url))
        .filter((url): url is string => Boolean(url));
      const known = discoveredUrls.length
        ? await db.from("creator_research_sources").select("canonical_url").eq("user_id", auth.user.id).in("canonical_url", discoveredUrls)
        : { data: [], error: null };
      if (known.error) throw new Error("PERSISTENCE");
      const knownUrls = new Set((known.data ?? []).map((source) => String(source.canonical_url)));
      const freshSources = renumberNativeSources(uniqueSources.filter((source) => {
        const canonical = canonicalResearchUrl(source.url);
        return canonical && !knownUrls.has(canonical);
      }));
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
      if(job.status==='cancelled')return reply(headers,{job});
      // A single long prompt allowed one marginal source cluster to dominate
      // the response. Screen bounded, independent groups and rank them together.
      const batchSize = 22;
      const batches = Array.from({ length: Math.ceil(freshSources.length / batchSize) }, (_, index) => freshSources.slice(index * batchSize, (index + 1) * batchSize));
      const batchTarget = Math.max(3, Math.ceil(Number(job.requested_count) / batches.length) + 2);
      const started = await Promise.allSettled(batches.map((sources) =>
        startNativeVideoScreening({ brief: brief.data, requestedCount: batchTarget, sources })));
      const screeningRuns = started.flatMap((result, index) => result.status === "fulfilled"
        ? [{ id: result.value.id, status: result.value.status, sourceIds: batches[index].map((source) => source.providerSourceId) }] : []);
      if (!screeningRuns.length) throw new Error("SCREENING_PROVIDER_UNAVAILABLE");
      const compactSources = freshSources.map((source) => ({ ...source, snippet: source.snippet.slice(0, 1200) }));
      const updated = await db.from("creator_research_jobs").update({
        provider_response_id: screeningRuns[0].id, status: "researching", phase: "Ranking direct video leads…",
        provider_metadata: {
          ...providerMetadata, stage: "multi_screening", apifyStatus: discovery.status,
          discoveryRuns: undefined, discoverySummary: multi ? checkedRuns.map((run) => ({ platform: run.platform, status: run.status, sourceCount: Array.isArray(run.sources) ? run.sources.length : 0 })) : [{ platform: "TikTok", status: discovery.status, sourceCount: discovery.sources.length }],
          screeningRuns, screeningLaunchFailures: started.length - screeningRuns.length,
          nativeSources: compactSources, discoveredSourceCount: uniqueSources.length, freshSourceCount: freshSources.length,
          duplicateSourceCount: uniqueSources.length - freshSources.length,
        }, updated_at: new Date().toISOString(),
      }).eq("id", job.id).select("*").maybeSingle();
      if (updated.error || !updated.data) throw new Error("PERSISTENCE");
      return reply(headers, { job: updated.data }, 202);
    }
    const screeningStage = providerMetadata.stage === "perplexity_screening" || providerMetadata.stage === "multi_screening";
    const suppliedSources = screeningStage ? nativeSources(providerMetadata.nativeSources) : undefined;
    if (screeningStage && !suppliedSources?.length) throw new Error("NATIVE_SOURCES_MISSING");
    let providerRun: ProviderRun | CompletedResearchRun;
    if (providerMetadata.stage === "multi_screening") {
      const runs = Array.isArray(providerMetadata.screeningRuns) ? providerMetadata.screeningRuns as Array<{ id: string; sourceIds: number[] }> : [];
      if (!runs.length) throw new Error("SCREENING_RUNS_MISSING");
      const results = await Promise.all(runs.map(async (run) => {
        const ids = new Set(run.sourceIds);
        try { return await getDeepResearchRun(run.id, brief.data, suppliedSources!.filter((source) => ids.has(source.providerSourceId))); }
        catch { return { id: run.id, status: "failed", usage: {} } as ProviderRun; }
      }));
      if (results.some((result) => result.status === "queued" || result.status === "in_progress")) {
        const updated = await db.from("creator_research_jobs").update({ phase: "Checking clip quality across platforms…", updated_at: new Date().toISOString() }).eq("id", job.id).select("*").maybeSingle();
        return reply(headers, { job: updated.data ?? job }, 202);
      }
      const complete = results.filter((result): result is CompletedResearchRun => result.status === "completed" && "candidates" in result);
      if (!complete.length) throw new Error("SCREENING_PROVIDER_UNAVAILABLE");
      providerRun = { ...complete[0], sources: suppliedSources!, candidates: complete.flatMap((result) => result.candidates),
        usage: { cost: { total_cost: complete.reduce((sum, result) => sum + (providerCost(result.usage) ?? 0), 0) } } };
    } else providerRun = await getDeepResearchRun(String(job.provider_response_id), brief.data, suppliedSources);
    if (["queued", "in_progress"].includes(providerRun.status)) {
      const phase = providerMetadata.stage === "perplexity_screening" ? "Checking clip quality…" : "Researching…";
      const updated = await db.from("creator_research_jobs").update({ status: "researching", phase, updated_at: new Date().toISOString() }).eq("id", job.id).select("*").maybeSingle();
      return reply(headers, { job: updated.data ?? job }, 202);
    }
    if (["failed", "cancelled", "incomplete"].includes(providerRun.status)) {
      await markFailed(job, `PROVIDER_${providerRun.status.toUpperCase()}`, providerRun.status === "cancelled", providerRun);
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
      if(job.status==='cancelled')return reply(headers,{job});

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
    if (!ranked.length) {

      const phase=brief.data.sourceMode==='articles'
        ? 'No new relevant articles with verified dates were found in this window. Try a wider date range.'
        : 'No new clips met this profile’s safety and relevance checks. Try again later or broaden the profile’s research criteria.';
      const result=await db.from('creator_research_jobs').update({status:'ready',reserved_count:0,phase,delivered_count:0,candidate_count:providerRun.candidates.length,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',job.id).select('*').maybeSingle();
      if(result.error)throw Error('PERSISTENCE');
      await db.from('creator_research_usage').insert({id:crypto.randomUUID(),job_id:job.id,user_id:auth.user.id,operation:'deep_research_complete',provider_response_id:providerRun.id,model:providerRun.model,status:'completed',usage:providerRun.usage,provider_cost_usd:providerCost(providerRun.usage),accepted_count:0,request_metadata:{sourceMode:brief.data.sourceMode,articleWindow:brief.data.articleWindow}});
      return reply(headers,{job:result.data,deliveredCount:0});
    }
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

    const usage = providerRun.usage;
    const finalJob = await db.from("creator_research_jobs").update({
      status: "ready", reserved_count:0, phase: brief.data.sourceMode==='articles'?`${delivered} articles ready.${delivered<Number(job.requested_count)?' Fewer relevant, dated, new stories were available in this window.':''}`:`${delivered} clips ready.${delivered<Number(job.requested_count)?' Fewer new clips met this profile’s checks.':''}`, delivered_count: delivered, candidate_count: providerRun.candidates.length,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id).select("*").maybeSingle();
    if (finalJob.error || !finalJob.data) throw new Error("PERSISTENCE");
    await db.from("creator_research_usage").insert({
      id: crypto.randomUUID(), job_id: job.id, user_id: auth.user.id, operation: "deep_research_complete",
      provider_response_id: providerRun.id, model: providerRun.model ?? null, status: "completed", usage,
      provider_cost_usd: providerCost(usage), candidate_count: providerRun.candidates.length, accepted_count: delivered,
      elapsed_ms: job.started_at ? Date.now() - new Date(String(job.started_at)).getTime() : null,
      request_metadata: { requestedCount: job.requested_count, sourceCount: providerRun.sources.length,sourceMode:brief.data.sourceMode,articleWindow:brief.data.articleWindow },
    });
    return reply(headers, { job: finalJob.data, deliveredCount: delivered });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "UNAVAILABLE";
    if (job) {
      const current=await db.from('creator_research_jobs').select('*').eq('id',job.id).maybeSingle();
      if(current.data?.status==='cancelled')return reply(headers,{job:current.data});
      // Keep results already saved, even if a later linking operation failed.
      await markFailed(job, code);
    }
    return reply(headers, { code: "RESEARCH_SYNC_FAILED" }, 503);
  }
});
