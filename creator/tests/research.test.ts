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
import { automaticTikTokRejectReason, buildCrossPlatformQueryPack, buildInstagramQueryPack, buildTikTokQueryPack, renumberNativeSources, sourceFromCrossPlatformItem } from "../supabase/functions/_shared/platform-discovery";

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
    expect(pack).toHaveLength(5);
    expect(pack.some((query) => query.includes("parking lot") || query.includes("store"))).toBe(true);
    expect(pack.every((query) => query.length > 10)).toBe(true);
    const rose={...brief,audienceName:'Fix Your Own Credit',sourceTopics:['credit reports, car financing, collections'],contentPillars:['credit rebuilding'],audienceProblems:['credit score']};
    const rosePack=buildTikTokQueryPack(rose);
    expect(rosePack).toHaveLength(3);
    expect(rosePack.join(' ')).toMatch(/credit|financing|collections/);
    expect(rosePack.join(' ')).not.toMatch(/woman|parking lot|security|stranger/);
    const prose={...rose,sourceTopics:['consumer protection issues, and common credit mistakes. Prioritize content that gives Rose a natural opportunity to explain what someone should know, check, or do next.'],contentPillars:[],audienceInterests:[]};
    for(const seed of ['a','b','c','d']){
      const queries=buildTikTokQueryPack(prose,seed);
      expect(queries).toEqual(expect.arrayContaining(['consumer protection issues','common credit mistakes']));
      expect(queries.join(' ')).not.toMatch(/Prioritize|check|real life|opportunity/);
    }
  });

  it("renumbers fresh native clips after previously shown links are removed", () => {
    const fresh = [source(2, "https://www.tiktok.com/@one/video/123"), source(9, "https://www.tiktok.com/@two/video/456")];
    expect(renumberNativeSources(fresh).map((item) => item.providerSourceId)).toEqual([1, 2]);
    expect(fresh.map((item) => item.providerSourceId)).toEqual([2, 9]);
  });

  it("uses platform-specific searches and accepts only direct Shorts and Reels", () => {
    const brief = researchBriefSchema.parse({
      expertise: "", experience: "", industries: [], communicationStyle: "", creatorTone: [], phrasesToAvoid: [], preferredCtaStyle: "",
      creatorContext: "", audienceName: "Steve", primaryAudience: "", audienceProblems: [], audienceInterests: ["situational awareness"], contentPillars: [],
      sourceTopics: ["women safety"], reactionAngles: [], desiredOutcomes: [], profileTone: [], thingsToAvoid: [], profileContext: "",
      researchSourcePlatforms: ["TikTok", "Instagram", "YouTube"], researchScreeningCriteria: "", researchReferenceUrls: [],
    });
    expect(buildCrossPlatformQueryPack(brief, "seed")).toHaveLength(5);
    expect(buildInstagramQueryPack(brief, "seed")).toHaveLength(5);
    expect(buildInstagramQueryPack(brief, "seed").every((query) => !query.includes(" "))).toBe(true);
    for (const build of [buildTikTokQueryPack, buildCrossPlatformQueryPack, buildInstagramQueryPack]) {
      const rounds = [1, 2, 3].map((round) => build(brief, "same-job", round));
      expect(rounds.every((queries) => queries.length >= 3)).toBe(true);
      expect(new Set(rounds.flat()).size).toBe(rounds.flat().length);
    }
    expect(sourceFromCrossPlatformItem({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", type: "shorts", title: "Store worker helps woman get to safety" }, 0, "YouTube")?.url)
      .toBe("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(sourceFromCrossPlatformItem({ url: "https://www.instagram.com/p/ABC123/", type: "Video", shortCode: "ABC123", caption: "Store worker helps woman get to safety" }, 0, "Instagram")?.url)
      .toBe("https://www.instagram.com/reel/ABC123/");
    expect(sourceFromCrossPlatformItem({ url: "https://www.instagram.com/example/", type: "Profile", caption: "Store worker helps woman get to safety" }, 0, "Instagram")).toBeNull();
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

  it("combines distinct round candidates without padding with weak or already shown clips", () => {
    const sources = [
      source(1, "https://www.tiktok.com/@one/video/123", "Woman followed in a store"),
      source(2, "https://www.youtube.com/shorts/abcdefghijk", "Unwanted visitor at a door"),
      source(3, "https://www.instagram.com/reel/newclip/", "Parking lot help"),
    ];
    const candidates = [
      candidate({ title: "Woman gets help after being followed in a store", sourceIds: [1], relevanceScore: 91 }),
      candidate({ title: "An unwanted visitor appears at the front door", sourceIds: [2], relevanceScore: 86 }),
      candidate({ title: "Parking lot rumor with no confirmed incident", sourceIds: [3], relevanceScore: 10 }),
    ];
    const eligible = candidates.filter((item) => item.relevanceScore >= 50);
    expect(rankResearchCandidates(eligible, sources, [], 10)).toHaveLength(2);
    expect(rankResearchCandidates(eligible, sources, [{ title: "Seen", category: "Home buying", status: "new", sourceSnapshot: [sources[0]] }], 10))
      .toHaveLength(1);
  });
});
