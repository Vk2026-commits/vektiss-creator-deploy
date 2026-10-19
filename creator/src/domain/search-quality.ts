import { z } from "zod";

const urls = z.array(z.string().url().max(2048)).max(10);
export const searchQualitySettingsSchema = z.object({
  seekSituations: z.string().trim().max(5000),
  avoidTopics: z.string().trim().max(5000),
  screeningCriteria: z.string().trim().max(5000),
  platforms: z.array(z.enum(["TikTok", "Instagram", "YouTube"])).min(1).max(3),
  goodExamples: urls,
  badExamples: urls,
}).strict();
export type SearchQualitySettings = z.infer<typeof searchQualitySettingsSchema>;

export const defaultSearchQuality: SearchQualitySettings = {
  seekSituations: "", avoidTopics: "", screeningCriteria: "",
  platforms: ["TikTok", "Instagram", "YouTube"], goodExamples: [], badExamples: [],
};

export function qualityFromRow(row: Record<string, unknown>): SearchQualitySettings {
  return searchQualitySettingsSchema.parse({
    seekSituations: row.seek_situations ?? "", avoidTopics: row.avoid_topics ?? "",
    screeningCriteria: row.screening_criteria ?? "", platforms: row.platforms,
    goodExamples: row.good_examples ?? [], badExamples: row.bad_examples ?? [],
  });
}

export function qualityInstruction(settings: SearchQualitySettings): string {
  return [
    settings.seekSituations && `Seek situations: ${settings.seekSituations}`,
    settings.avoidTopics && `Reject topics or formats: ${settings.avoidTopics}`,
    settings.screeningCriteria && `Additional screening: ${settings.screeningCriteria}`,
    settings.goodExamples.length && `Positive examples (style/subject only; do not repeat URLs): ${settings.goodExamples.slice(0, 3).map(url => url.slice(0, 300)).join(", ")}`,
    settings.badExamples.length && `Negative examples (do not return these URLs or close equivalents): ${settings.badExamples.slice(0, 3).map(url => url.slice(0, 300)).join(", ")}`,
  ].filter(Boolean).join("\n").slice(0, 10000);
}
