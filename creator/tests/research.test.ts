import { describe, expect, it } from "vitest";
import {
  canonicalResearchUrl,
  providerResearchEnvelopeSchema,
  rankResearchCandidates,
  researchBriefSchema,
  type ProviderResearchCandidate,
  type ResearchHistorySignal,
  type ResearchSource,
} from "../src/domain/research";

const source = (id: number, url: string, title = "Evidence") => ({
  providerSourceId: id,
  title,
  url,
  snippet: "A source-backed report.",
  publishedAt: "2026-10-01",
  sourceType: "web",
}) satisfies ResearchSource;

const candidate = (overrides: Partial<ProviderResearchCandidate> = {}): ProviderResearchCandidate => ({
  title: "Mortgage rule changes affect first-time buyers",
  factualSummary: "A regulator announced a documented rule change affecting mortgage applications.",
  whyAudienceCares: "It could change how first-time buyers prepare before applying.",
  creatorConnection: "The creator can explain practical preparation without giving lender-specific advice.",
  recommendedAngle: "Explain the application preparation questions buyers should ask now.",
  suggestedHook: "Before you apply, this is the change worth understanding.",
  category: "Home buying",
  publishedAt: "2026-10-01",
  timelinessScore: 90,
  relevanceScore: 88,
  sourceIds: [1],
  uncertainty: "",
  ...overrides,
});

describe("research contracts", () => {
  it("canonicalizes only safe HTTPS source URLs", () => {
    expect(canonicalResearchUrl("https://Example.com/story/?utm_source=test&b=2&a=1#section"))
      .toBe("https://example.com/story?a=1&b=2");
    expect(canonicalResearchUrl("http://example.com/story")).toBeNull();
    expect(canonicalResearchUrl("https://user:pass@example.com/story")).toBeNull();
  });

  it("requires source ids instead of model-authored URLs", () => {
    expect(() => providerResearchEnvelopeSchema.parse({ opportunities: [{ ...candidate(), sourceUrls: ["https://invented.example"] }] })).toThrow();
    expect(providerResearchEnvelopeSchema.parse({ opportunities: [candidate()] }).opportunities).toHaveLength(1);
  });

  it("preserves profile-specific platform and screening constraints", () => {
    const brief = researchBriefSchema.parse({
      expertise: "", experience: "", industries: [], communicationStyle: "", creatorTone: [], phrasesToAvoid: [], preferredCtaStyle: "",
      creatorContext: "", audienceName: "Steve", primaryAudience: "", audienceProblems: [], audienceInterests: [], contentPillars: [],
      sourceTopics: [], reactionAngles: [], desiredOutcomes: [], profileTone: [], thingsToAvoid: [], profileContext: "",
      researchSourcePlatforms: ["TikTok", "Instagram", "YouTube"],
      researchScreeningCriteria: "Only authentic, complete, person-to-person safety incidents.",
      researchReferenceUrls: ["https://www.tiktok.com/@miss.chievousss/video/7260573341868641582"],
    });
    expect(brief.researchSourcePlatforms).toEqual(["TikTok", "Instagram", "YouTube"]);
    expect(brief.researchScreeningCriteria).toContain("authentic");
  });

  it("removes prior and same-batch duplicate stories while using behavior as a rank signal", () => {
    const sources = [
      source(1, "https://news.example.com/mortgages?utm_source=campaign"),
      source(2, "https://news.example.com/buyers"),
      source(3, "https://news.example.com/debt"),
    ];
    const history: ResearchHistorySignal[] = [
      { title: "First-time buyers prepare for mortgage rule changes", category: "Home buying", status: "saved", sourceSnapshot: [source(7, "https://old.example.com/help")] },
      { title: "Celebrity finance discussion", category: "Celebrity finance", status: "rejected", sourceSnapshot: [source(8, "https://old.example.com/celebrity")] },
    ];
    const ranked = rankResearchCandidates([
      candidate(),
      candidate({ title: "Mortgage rule changes affect first-time buyers again", sourceIds: [2] }),
      candidate({ title: "Consumer debt changes that affect home buyers", category: "Debt", sourceIds: [3], relevanceScore: 70 }),
    ], sources, history, 10);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].category).toBe("Home buying");
    expect(ranked.every((item) => item.sources.length > 0)).toBe(true);
  });
});
