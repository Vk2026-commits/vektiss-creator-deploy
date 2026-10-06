// supabase/functions/research-request/index.ts
import { createClient } from "npm:@supabase/supabase-js@2.106.0";

// supabase/functions/_shared/app-origins.ts
function isAllowedAppOrigin(origin, primary, additional = "") {
  return [primary, ...additional.split(",")].some((value) => value?.trim() === origin);
}

// src/domain/research.ts
import { z } from "npm:zod@3.24.2";
var shortText = (max) => z.string().trim().min(1).max(max);
var sourceDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
var researchStatusSchema = z.enum([
  "queued",
  "researching",
  "reviewing_sources",
  "ranking",
  "ready",
  "failed",
  "cancelled"
]);
var opportunityStatusSchema = z.enum([
  "new",
  "saved",
  "rejected",
  "selected",
  "turned_into_content"
]);
var feedbackActionSchema = z.enum([
  "shown",
  "saved",
  "rejected",
  "selected",
  "angle_refined",
  "script_created",
  "turned_into_content"
]);
var feedbackReasonSchema = z.enum([
  "not_relevant",
  "already_talked_about_this",
  "dont_like_this_topic",
  "too_old",
  "not_my_audience",
  "wrong_angle",
  "other"
]);
var researchSourceSchema = z.object({
  providerSourceId: z.number().int().positive(),
  title: shortText(300),
  url: z.string().url().max(2048),
  snippet: z.string().trim().max(6e3).default(""),
  publishedAt: sourceDate.nullable(),
  sourceType: z.string().trim().max(80).default("web")
}).strict();
var providerResearchCandidateSchema = z.object({
  title: shortText(220),
  factualSummary: shortText(2500),
  whyAudienceCares: shortText(1800),
  creatorConnection: shortText(1800),
  recommendedAngle: shortText(1800),
  suggestedHook: z.string().trim().max(500).default(""),
  category: shortText(120),
  publishedAt: sourceDate.nullable(),
  timelinessScore: z.number().int().min(0).max(100),
  relevanceScore: z.number().int().min(0).max(100),
  sourceIds: z.array(z.number().int().positive()).min(1).max(6),
  uncertainty: z.string().trim().max(1e3).default("")
}).strict();
var providerResearchEnvelopeSchema = z.object({
  opportunities: z.array(providerResearchCandidateSchema).min(1).max(50)
}).strict();
var researchBriefSchema = z.object({
  expertise: z.string().trim().max(2e3),
  experience: z.string().trim().max(2e3),
  industries: z.array(z.string().trim().max(160)).max(20),
  communicationStyle: z.string().trim().max(2e3),
  creatorTone: z.array(z.string().trim().max(160)).max(20),
  phrasesToAvoid: z.array(z.string().trim().max(160)).max(20),
  preferredCtaStyle: z.string().trim().max(500),
  creatorContext: z.string().trim().max(5e3),
  audienceName: z.string().trim().max(100),
  primaryAudience: z.string().trim().max(1e3),
  audienceProblems: z.array(z.string().trim().max(160)).max(20),
  audienceInterests: z.array(z.string().trim().max(160)).max(20),
  contentPillars: z.array(z.string().trim().max(160)).max(20),
  sourceTopics: z.array(z.string().trim().max(160)).max(20),
  reactionAngles: z.array(z.string().trim().max(160)).max(20),
  desiredOutcomes: z.array(z.string().trim().max(160)).max(20),
  profileTone: z.array(z.string().trim().max(160)).max(20),
  thingsToAvoid: z.array(z.string().trim().max(160)).max(20),
  profileContext: z.string().trim().max(5e3),
  researchSourcePlatforms: z.array(z.enum(["TikTok", "Instagram", "YouTube"])).max(3).default([]),
  researchScreeningCriteria: z.string().trim().max(12e3).default(""),
  researchReferenceUrls: z.array(z.string().url().max(2048)).max(10).default([])
}).strict();
var researchRequestSchema = z.object({
  profileId: z.string().uuid(),
  requestedCount: z.union([z.literal(10), z.literal(20), z.literal(30)]),
  idempotencyKey: z.string().uuid()
}).strict();
var researchFeedbackRequestSchema = z.object({
  opportunityId: z.string().uuid(),
  action: feedbackActionSchema,
  reason: feedbackReasonSchema.optional(),
  note: z.string().trim().max(1e3).optional()
}).strict().superRefine((value, context) => {
  if (value.action === "rejected" && !value.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A rejection reason is required." });
  }
});
var researchRefineRequestSchema = z.object({
  opportunityId: z.string().uuid(),
  instruction: shortText(1e3)
}).strict();
var researchOpportunityRowSchema = z.object({
  id: z.string().uuid(),
  content_profile_id: z.string().uuid(),
  title: z.string(),
  factual_summary: z.string(),
  why_audience_cares: z.string(),
  creator_connection: z.string(),
  recommended_angle: z.string(),
  suggested_hook: z.string(),
  category: z.string(),
  published_at: z.string().nullable(),
  timeliness_score: z.number(),
  relevance_score: z.number(),
  rank_score: z.number(),
  source_snapshot: z.array(researchSourceSchema),
  uncertainty: z.string(),
  status: opportunityStatusSchema,
  created_at: z.string(),
  updated_at: z.string()
});
var researchJobRowSchema = z.object({
  id: z.string().uuid(),
  content_profile_id: z.string().uuid(),
  requested_count: z.number().int(),
  delivered_count: z.number().int(),
  candidate_count: z.number().int(),
  status: researchStatusSchema,
  phase: z.string(),
  error_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable()
});

// supabase/functions/_shared/platform-discovery.ts
var APIFY_API = "https://api.apify.com/v2";
var TIKTOK_ACTOR = "clockworks~tiktok-scraper";
function apifyToken() {
  const token = Deno.env.get("CREATOR_APIFY_API_TOKEN");
  if (!token) throw new Error("APIFY_NOT_CONFIGURED");
  return token;
}
async function apify(path, init = {}) {
  const response = await fetch(`${APIFY_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apifyToken()}`,
      "content-type": "application/json",
      ...init.headers ?? {}
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") throw new Error("APIFY_PROVIDER");
  return payload;
}
function words(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 4);
}
function buildTikTokQueryPack(brief) {
  const defaults = [
    "woman followed parking lot security camera",
    "store employee walks woman to car safety",
    "woman followed in store staff helps",
    "doorbell camera stranger approaches driveway woman",
    "security guard removes aggressive man from store",
    "woman being followed gets help original video"
  ];
  const profileTerms = [...brief.sourceTopics, ...brief.audienceProblems, ...brief.contentPillars].flatMap(words).filter((word) => !["women", "woman", "safety", "security", "situational", "awareness"].includes(word));
  const profileQuery = profileTerms.slice(0, 4).join(" ");
  const combined = profileQuery ? [`${profileQuery} safety footage`, ...defaults] : defaults;
  return [...new Set(combined)].slice(0, 3);
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
async function startNativeDiscovery(input) {
  const queryPack = buildTikTokQueryPack(input.brief);
  const payload = await apify(`/acts/${encodeURIComponent(TIKTOK_ACTOR)}/runs`, {
    method: "POST",
    body: JSON.stringify({
      searchQueries: queryPack,
      searchSection: "Video",
      resultsPerPage: Math.min(12, Math.max(8, input.requestedCount)),
      videoSearchSorting: "MOST_RELEVANT",
      videoSearchDateFilter: "ALL_TIME",
      scrapeRelatedSearchWords: false,
      scrapeRelatedVideos: false,
      scrapeAdditionalAuthorMeta: false,
      commentsPerPost: 0,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      aiVideoDescription: false,
      aiVideoSummary: false,
      proxyCountryCode: "US"
    })
  });
  const run = asRecord(payload.data);
  if (!run || typeof run.id !== "string" || typeof run.status !== "string") throw new Error("APIFY_PROVIDER");
  return { id: run.id, status: run.status, platform: "TikTok", queryPack };
}

// supabase/functions/research-request/index.ts
var db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
var currentPeriod = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 7) + "-01";
function headersFor(origin) {
  const headers = {
    "content-type": "application/json",
    "cache-control": "no-store",
    vary: "Origin",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS"
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
function reply(headers, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function safeCode(error) {
  if (error instanceof Error && ["APIFY_NOT_CONFIGURED", "APIFY_PROVIDER", "PERSISTENCE", "ENTITLEMENT", "QUOTA"].includes(error.message)) return error.message;
  return "UNAVAILABLE";
}
async function releaseReservation(userId, amount) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await db.from("creator_research_entitlements").select("reserved_count,delivered_count,period_start").eq("user_id", userId).maybeSingle();
    if (!data) return;
    const result = await db.from("creator_research_entitlements").update({ reserved_count: Math.max(0, Number(data.reserved_count) - amount), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("user_id", userId).eq("reserved_count", data.reserved_count).select("user_id");
    if (!result.error && result.data?.length) return;
  }
}
async function reserve(userId, count) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await db.from("creator_research_entitlements").select("enabled,monthly_opportunity_limit,period_start,delivered_count,reserved_count").eq("user_id", userId).maybeSingle();
    if (error) throw new Error("PERSISTENCE");
    if (!data || !data.enabled) throw new Error("ENTITLEMENT");
    const entitlement = data;
    const shouldReset = entitlement.period_start !== currentPeriod();
    const delivered = shouldReset ? 0 : Number(entitlement.delivered_count);
    const reserved = shouldReset ? 0 : Number(entitlement.reserved_count);
    if (delivered + reserved + count > Number(entitlement.monthly_opportunity_limit)) throw new Error("QUOTA");
    const updated = await db.from("creator_research_entitlements").update({ period_start: currentPeriod(), delivered_count: delivered, reserved_count: reserved + count, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("user_id", userId).eq("period_start", entitlement.period_start).eq("delivered_count", entitlement.delivered_count).eq("reserved_count", entitlement.reserved_count).select("enabled,monthly_opportunity_limit,period_start,delivered_count,reserved_count");
    if (!updated.error && updated.data?.[0]) return updated.data[0];
  }
  throw new Error("CONCURRENT_REQUEST");
}
function buildBrief(creator, profile) {
  const creatorContext = creator?.context ?? {};
  const strategy = profile.strategy ?? {};
  const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  const platforms = (value) => Array.isArray(value) ? value.filter((item) => item === "TikTok" || item === "Instagram" || item === "YouTube") : [];
  return researchBriefSchema.parse({
    expertise: creatorContext.expertise ?? "",
    experience: creatorContext.experience ?? "",
    industries: strings(creatorContext.industries),
    communicationStyle: creatorContext.communication_style ?? "",
    creatorTone: strings(creatorContext.tone),
    phrasesToAvoid: strings(creatorContext.phrases_to_avoid),
    preferredCtaStyle: creatorContext.preferred_cta_style ?? "",
    creatorContext: creatorContext.additional_context ?? "",
    audienceName: profile.name ?? "",
    primaryAudience: profile.primary_audience ?? "",
    audienceProblems: strings(strategy.audience_problems),
    audienceInterests: strings(strategy.audience_interests),
    contentPillars: strings(strategy.content_pillars),
    sourceTopics: strings(strategy.source_topics),
    reactionAngles: strings(strategy.reaction_angles),
    desiredOutcomes: strings(strategy.desired_outcomes),
    profileTone: strings(strategy.tone),
    thingsToAvoid: strings(strategy.things_to_avoid),
    profileContext: strategy.additional_context ?? "",
    researchSourcePlatforms: platforms(strategy.research_source_platforms),
    researchScreeningCriteria: typeof strategy.research_screening_criteria === "string" ? strategy.research_screening_criteria : "",
    researchReferenceUrls: strings(strategy.research_reference_urls)
  });
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = headersFor(origin);
  if (origin && !isAllowedAppOrigin(origin, Deno.env.get("APP_ORIGIN"), Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"))) return reply(headers, { code: "ORIGIN" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(headers, { code: "METHOD" }, 405);
  let jobId = null;
  let reservation = 0;
  let userId = null;
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return reply(headers, { code: "AUTH" }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply(headers, { code: "AUTH" }, 401);
    userId = auth.user.id;
    const input = researchRequestSchema.parse(await request.json());
    const { data: existing, error: existingError } = await db.from("creator_research_jobs").select("*").eq("user_id", userId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existingError) throw new Error("PERSISTENCE");
    if (existing) return reply(headers, { job: existing, reused: true });
    const { data: config, error: configError } = await db.from("creator_research_config").select("feature_enabled,candidate_multiplier").eq("id", true).maybeSingle();
    if (configError) throw new Error("PERSISTENCE");
    if (!config?.feature_enabled) return reply(headers, { code: "FEATURE_DISABLED" }, 403);
    const { data: profile, error: profileError } = await db.from("content_profiles").select("id,user_id,creator_profile_id,name,primary_audience,strategy").eq("id", input.profileId).eq("user_id", userId).maybeSingle();
    if (profileError || !profile) return reply(headers, { code: "PROFILE" }, 403);
    const { data: creator } = await db.from("creator_profiles").select("context").eq("id", profile.creator_profile_id).eq("user_id", userId).maybeSingle();
    const brief = buildBrief(creator, profile);
    await reserve(userId, input.requestedCount);
    reservation = input.requestedCount;
    jobId = crypto.randomUUID();
    const inserted = await db.from("creator_research_jobs").insert({
      id: jobId,
      user_id: userId,
      content_profile_id: input.profileId,
      idempotency_key: input.idempotencyKey,
      requested_count: input.requestedCount,
      reserved_count: reservation,
      input_snapshot: brief
    }).select("*").maybeSingle();
    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === "23505") {
        await releaseReservation(userId, reservation);
        const { data: concurrent } = await db.from("creator_research_jobs").select("*").eq("user_id", userId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
        if (concurrent) return reply(headers, { job: concurrent, reused: true });
      }
      throw new Error("PERSISTENCE");
    }
    const providerRun = await startNativeDiscovery({ brief, requestedCount: input.requestedCount });
    const updated = await db.from("creator_research_jobs").update({
      provider_response_id: providerRun.id,
      status: "researching",
      phase: "Finding direct TikTok videos\u2026",
      started_at: (/* @__PURE__ */ new Date()).toISOString(),
      provider_metadata: { stage: "native_discovery", platform: providerRun.platform, apifyStatus: providerRun.status, queryPack: providerRun.queryPack },
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", jobId).select("*").maybeSingle();
    if (updated.error || !updated.data) throw new Error("PERSISTENCE");
    await db.from("creator_research_usage").insert({
      id: crypto.randomUUID(),
      job_id: jobId,
      user_id: userId,
      operation: "deep_research_start",
      provider_response_id: providerRun.id,
      model: "apify-tiktok-discovery",
      status: "started",
      request_metadata: { requestedCount: input.requestedCount, queryPack: providerRun.queryPack }
    });
    reservation = 0;
    return reply(headers, { job: updated.data, reused: false }, 202);
  } catch (error) {
    const code = safeCode(error);
    if (jobId && userId) {
      await db.from("creator_research_jobs").update({ status: "failed", phase: "Research unavailable", error_code: code, completed_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", jobId);
      await db.from("creator_research_usage").insert({ id: crypto.randomUUID(), job_id: jobId, user_id: userId, operation: "deep_research_failed", status: "failed", request_metadata: { code } });
    }
    if (userId && reservation) await releaseReservation(userId, reservation);
    const status = code === "ENTITLEMENT" || code === "FEATURE_DISABLED" ? 403 : code === "QUOTA" ? 429 : code === "NOT_CONFIGURED" ? 503 : 503;
    return reply(headers, { code }, status);
  }
});
