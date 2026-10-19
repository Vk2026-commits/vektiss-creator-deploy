import { describe, expect, it } from "vitest";
import { defaultSearchQuality, qualityInstruction, searchQualitySettingsSchema } from "../src/domain/search-quality";
import { rankResearchCandidates, type ProviderResearchCandidate, type ResearchSource } from "../src/domain/research";

const source: ResearchSource = { providerSourceId: 1, title: "Woman notices a follower", url: "https://youtube.com/shorts/safety-one", snippet: "A public safety clip", publishedAt: null, sourceType: "youtube-shorts-native" };
const candidate: ProviderResearchCandidate = { title: "Woman notices a follower", factualSummary: "A person notices someone nearby.", whyAudienceCares: "This is a safety situation.", creatorConnection: "Stephen can explain the response.", recommendedAngle: "Explain how to move toward help.", suggestedHook: "What would you do?", category: "Following", publishedAt: null, timelinessScore: 70, relevanceScore: 85, sourceIds: [1], uncertainty: "Watch first" };

describe("Search Quality rules", () => {
  it("validates platforms and examples before saving", () => {
    expect(searchQualitySettingsSchema.safeParse({ ...defaultSearchQuality, platforms: [] }).success).toBe(false);
    expect(searchQualitySettingsSchema.safeParse({ ...defaultSearchQuality, badExamples: ["not a url"] }).success).toBe(false);
  });
  it("keeps admin directions distinct from default rules", () => {
    const text = qualityInstruction({ ...defaultSearchQuality, seekSituations: "People seeking help in a parking lot", avoidTopics: "Staged skits" });
    expect(text).toContain("People seeking help in a parking lot");
    expect(text).toContain("Staged skits");
    expect(qualityInstruction(defaultSearchQuality)).toBe("");
  });
  it("applies rejection to its profile history only and blocks unavailable URLs", () => {
    const clean = rankResearchCandidates([candidate], [source], [], 1)[0].rankScore;
    const rejected = { title: "Old result", category: "Following", status: "rejected" as const, sourceSnapshot: [], rejectionReason: "off_topic" as const };
    expect(rankResearchCandidates([candidate], [source], [rejected], 1)[0].rankScore).toBe(clean - 10);
    expect(rankResearchCandidates([candidate], [source], [], 1)[0].rankScore).toBe(clean);
    expect(rankResearchCandidates([candidate], [source], [{ ...rejected, title: "Woman notices a follower", rejectionReason: "poor_quality" }], 1)[0].rankScore).toBe(clean - 5);
    expect(rankResearchCandidates([candidate], [source], [{ ...rejected, sourceSnapshot: [source], rejectionReason: "unavailable" }], 1)).toEqual([]);
  });
});
