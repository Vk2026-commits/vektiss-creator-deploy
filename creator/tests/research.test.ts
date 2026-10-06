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
import { automaticTikTokRejectReason, buildTikTokQueryPack } from "../supabase/functions/_shared/platform-discovery";

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
  const score = (history: ResearchHistorySignal[], duplicates = history) => rankResearchCandidates([candidate({relevanceScore:50,timelinessScore:50})], [source(1,'https://new.example.com/item')], history, 1, duplicates)[0]?.rankScore;
  const signal = (reason?: ResearchHistorySignal['rejectionReason'], status: ResearchHistorySignal['status'] = 'rejected'): ResearchHistorySignal => ({title:'Old',category:'Home buying',status,sourceSnapshot:[],rejectionReason:reason});
  it('only penalizes explicit topic or audience rejection reasons',()=>{
    for(const reason of ['not_relevant','not_my_audience','dont_like_this_topic'] as const) expect(score([signal(reason)])).toBe(score([])!-10);
    for(const reason of ['already_talked_about_this','too_old','wrong_angle','other',null,undefined] as const) expect(score([signal(reason)])).toBe(score([]));
  });
  it('uses current positive status once and caps combined preferences',()=>{
    for(const status of ['saved','selected','turned_into_content'] as const) expect(score([signal('dont_like_this_topic',status)])).toBe(score([])!+8);
    expect(score(Array(8).fill(signal('not_relevant')))).toBe(score([])!-20);
    expect(score(Array(8).fill(signal(undefined,'saved')))).toBe(score([])!+20);
    expect(score([signal('not_relevant'),signal(undefined,'saved')])).toBe(score([])!-2);
  });
  it('keeps account duplicate history separate from audience preferences',()=>{
    const otherAudience = [signal('dont_like_this_topic')];
    expect(score([],otherAudience)).toBe(score([]));
    expect(score([],[{...signal(),sourceSnapshot:[source(5,'https://new.example.com/item')]}])).toBeUndefined();
  });
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

  it("uses concrete native-video scenarios instead of broad safety-topic searches", () => {
    const brief = researchBriefSchema.parse({
      expertise: "", experience: "", industries: [], communicationStyle: "", creatorTone: [], phrasesToAvoid: [], preferredCtaStyle: "",
      creatorContext: "", audienceName: "Steve", primaryAudience: "", audienceProblems: ["personal safety"], audienceInterests: [], contentPillars: [],
      sourceTopics: ["women safety"], reactionAngles: [], desiredOutcomes: [], profileTone: [], thingsToAvoid: [], profileContext: "",
      researchSourcePlatforms: ["TikTok"], researchScreeningCriteria: "", researchReferenceUrls: [],
    });
    const pack = buildTikTokQueryPack(brief);
    expect(pack).toHaveLength(3);
    expect(pack.some((query) => query.includes("parking lot") || query.includes("store"))).toBe(true);
    expect(pack.every((query) => query.length > 10)).toBe(true);
  });

  it("rejects self-declared fiction, news packaging, and staged formats before screening", () => {
    expect(automaticTikTokRejectReason("Parking garage camera #HorrorTok #FoundFootage")).toBe("fiction");
    expect(automaticTikTokRejectReason("CBS News reports a safety incident")).toBe("news");
    expect(automaticTikTokRejectReason("Ultra-realistic AI CCTV footage")).toBe("fiction");
    expect(automaticTikTokRejectReason("Safety storytime reenactment")).toBe("format");
    expect(automaticTikTokRejectReason("Employee walks customer to her car after closing")).toBeNull();
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

  it("keeps a new direct clip when its lesson resembles an earlier idea", () => {
    const ranked = rankResearchCandidates(
      [candidate({ title: "First-time buyers prepare for mortgage rule changes", sourceIds: [1] })],
      [source(1, "https://new.example.com/video")],
      [{ title: "First-time buyers prepare for mortgage rule changes", category: "Home buying", status: "saved", sourceSnapshot: [source(7, "https://old.example.com/video")] }],
      10,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].sources[0].url).toBe("https://new.example.com/video");
  });
});
