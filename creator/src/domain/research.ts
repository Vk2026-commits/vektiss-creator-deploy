import { z } from "zod";

const shortText = (max: number) => z.string().trim().min(1).max(max);
const sourceDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);

export const researchStatusSchema = z.enum([
  "queued",
  "researching",
  "reviewing_sources",
  "ranking",
  "ready",
  "failed",
  "cancelled",
]);
export const opportunityStatusSchema = z.enum([
  "new",
  "saved",
  "rejected",
  "selected",
  "turned_into_content",
]);
export const feedbackActionSchema = z.enum([
  "shown",
  "saved",
  "rejected",
  "selected",
  "angle_refined",
  "script_created",
  "turned_into_content",
]);
export const feedbackReasonSchema = z.enum([
  "not_relevant",
  "already_talked_about_this",
  "dont_like_this_topic",
  "too_old",
  "not_my_audience",
  "wrong_angle",
  "other",
]);

export const researchSourceSchema = z
  .object({
    providerSourceId: z.number().int().positive(),
    title: shortText(300),
    url: z.string().url().max(2048),
    snippet: z.string().trim().max(6000).default(""),
    publishedAt: sourceDate.nullable(),
    sourceType: z.string().trim().max(80).default("web"),
  })
  .strict();
export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const providerResearchCandidateSchema = z
  .object({
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
    uncertainty: z.string().trim().max(1000).default(""),
  })
  .strict();
export type ProviderResearchCandidate = z.infer<
  typeof providerResearchCandidateSchema
>;

export const providerResearchEnvelopeSchema = z
  .object({
    opportunities: z.array(providerResearchCandidateSchema).min(1).max(50),
  })
  .strict();

export const researchBriefSchema = z
  .object({
    expertise: z.string().trim().max(2000),
    experience: z.string().trim().max(2000),
    industries: z.array(z.string().trim().max(160)).max(20),
    communicationStyle: z.string().trim().max(2000),
    creatorTone: z.array(z.string().trim().max(160)).max(20),
    phrasesToAvoid: z.array(z.string().trim().max(160)).max(20),
    preferredCtaStyle: z.string().trim().max(500),
    creatorContext: z.string().trim().max(5000),
    audienceName: z.string().trim().max(100),
    primaryAudience: z.string().trim().max(1000),
    audienceProblems: z.array(z.string().trim().max(160)).max(20),
    audienceInterests: z.array(z.string().trim().max(160)).max(20),
    contentPillars: z.array(z.string().trim().max(160)).max(20),
    sourceTopics: z.array(z.string().trim().max(160)).max(20),
    reactionAngles: z.array(z.string().trim().max(160)).max(20),
    desiredOutcomes: z.array(z.string().trim().max(160)).max(20),
    profileTone: z.array(z.string().trim().max(160)).max(20),
    thingsToAvoid: z.array(z.string().trim().max(160)).max(20),
    profileContext: z.string().trim().max(5000),
    researchSourcePlatforms: z.array(z.enum(["TikTok", "Instagram", "YouTube"])).max(3).default([]),
    researchScreeningCriteria: z.string().trim().max(12000).default(""),
    researchReferenceUrls: z.array(z.string().url().max(2048)).max(10).default([]),
  })
  .strict();
export type ResearchBrief = z.infer<typeof researchBriefSchema>;

export const researchRequestSchema = z
  .object({
    profileId: z.string().uuid(),
    requestedCount: z.union([z.literal(10), z.literal(20), z.literal(30)]),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const researchFeedbackRequestSchema = z
  .object({
    opportunityId: z.string().uuid(),
    action: feedbackActionSchema,
    reason: feedbackReasonSchema.optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "rejected" && !value.reason) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "A rejection reason is required." });
    }
  });

export const researchRefineRequestSchema = z
  .object({
    opportunityId: z.string().uuid(),
    instruction: shortText(1000),
  })
  .strict();

export const researchOpportunityRowSchema = z.object({
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
  updated_at: z.string(),
});
export type ResearchOpportunityRow = z.infer<typeof researchOpportunityRowSchema>;

export const researchJobRowSchema = z.object({
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
  completed_at: z.string().nullable(),
});
export type ResearchJobRow = z.infer<typeof researchJobRowSchema>;

export function canonicalResearchUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_[a-z]+)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function normalizedWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !["the", "and", "for", "with", "from", "that", "this"].includes(word)),
  );
}

export function headlineSimilarity(left: string, right: string): number {
  const leftWords = normalizedWords(left);
  const rightWords = normalizedWords(right);
  if (!leftWords.size || !rightWords.size) return 0;
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  return intersection / new Set([...leftWords, ...rightWords]).size;
}

export type RankedResearchCandidate = ProviderResearchCandidate & {
  sources: ResearchSource[];
  rankScore: number;
  normalizedTitle: string;
};
export type ResearchHistorySignal = {
  title: string;
  category: string;
  status: z.infer<typeof opportunityStatusSchema>;
  sourceSnapshot: ResearchSource[];
};

export function rankResearchCandidates(
  candidates: ProviderResearchCandidate[],
  sourcePool: ResearchSource[],
  history: ResearchHistorySignal[],
  maxResults: number,
): RankedResearchCandidate[] {
  const sourceById = new Map(sourcePool.map((source) => [source.providerSourceId, source]));
  const priorUrls = new Set(
    history.flatMap((item) => item.sourceSnapshot.map((source) => canonicalResearchUrl(source.url)).filter(Boolean)),
  );
  const accepted: RankedResearchCandidate[] = [];

  for (const candidate of candidates) {
    const sources = candidate.sourceIds
      .map((id) => sourceById.get(id))
      .filter((source): source is ResearchSource => Boolean(source));
    const urls = sources.map((source) => canonicalResearchUrl(source.url)).filter(Boolean);
    if (!sources.length || !urls.length || urls.every((url) => priorUrls.has(url!))) continue;
    if (history.some((item) => headlineSimilarity(item.title, candidate.title) >= 0.72)) continue;
    if (accepted.some((item) => headlineSimilarity(item.title, candidate.title) >= 0.72)) continue;

    const sameCategory = history.filter((item) => item.category.toLowerCase() === candidate.category.toLowerCase());
    const preferenceBoost = sameCategory.reduce((score, item) => {
      if (["saved", "selected", "turned_into_content"].includes(item.status)) return score + 8;
      if (item.status === "rejected") return score - 10;
      return score;
    }, 0);
    const evidenceBoost = Math.min(sources.length, 3) * 3;
    const rankScore = Math.round(
      Math.max(0, Math.min(100, candidate.relevanceScore * 0.68 + candidate.timelinessScore * 0.22 + evidenceBoost + preferenceBoost)),
    );
    accepted.push({
      ...candidate,
      sources,
      rankScore,
      normalizedTitle: candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    });
  }

  return accepted.sort((left, right) => right.rankScore - left.rankScore).slice(0, maxResults);
}
