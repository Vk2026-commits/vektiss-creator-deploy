import { z } from "zod";
import {ctaSchema,campaignSchema} from './cta.ts';

const text = (max = 2000) => z.string().trim().max(max);
const items = z.array(z.string().trim().min(1).max(160)).max(20);
// Guided answers accept prose as well as newline-separated examples. Never
// truncate a paragraph to the old short-tag limit.
export const audienceAnswerLimit = 3220;
const audienceItems = z.array(z.string().trim().min(1).max(audienceAnswerLimit)).max(20)
  .refine(values => values.join('\n').length <= audienceAnswerLimit,
    `Keep this answer within ${audienceAnswerLimit} characters.`);
export const creatorContextSchema = z
  .object({
    expertise: text(),
    experience: text(),
    industries: items,
    credentials: text(),
    tone: items,
    communication_style: text(),
    phrases_to_avoid: items,
    preferred_cta_style: text(500),
    additional_context: text(5000),
  })
  .strict();
export const strategySchema = z
  .object({
    research_screening_criteria:text(5000).optional(),
    research_source_platforms:items.optional(),
    research_reference_urls:z.array(z.string().max(2000)).max(20).optional(),
    secondary_audience: text(500),
    audience_problems: audienceItems,
    audience_interests: audienceItems,
    content_pillars: audienceItems,
    source_topics: audienceItems,
    reaction_angles: audienceItems,
    desired_outcomes: audienceItems,
    tone: audienceItems,
    things_to_avoid: audienceItems,
    preferred_ctas: audienceItems,
    additional_context: text(5000),
  })
  .strict();
export const creatorInputSchema = z
  .object({
    display_name: z.string().trim().min(1, "Add your name.").max(100),
    bio: text(),
    context: creatorContextSchema,
  })
  .strict();
export const contentInputSchema = z
  .object({
    cta_default:ctaSchema.nullable().optional(),
    cta_campaign:campaignSchema.nullable().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Give this Content Profile a name.")
      .max(100),
    primary_audience: z
      .string()
      .trim()
      .min(1, "Describe who you are speaking to.")
      .max(1000),
    strategy: strategySchema,
  })
  .strict();
export type CreatorInput = z.infer<typeof creatorInputSchema>;
export type ContentInput = z.infer<typeof contentInputSchema>;
export type Creator = CreatorInput & {
  id: string;
  user_id: string;
  default_content_profile_id: string | null;
  updated_at: string;
};
export type ContentProfile = ContentInput & {
  id: string;
  user_id: string;
  creator_profile_id: string;
  archived_at: string | null;
  updated_at: string;
};
export type Workspace = { creator: Creator | null; profiles: ContentProfile[] };

export const emptyCreator: CreatorInput = {
  display_name: "",
  bio: "",
  context: {
    expertise: "",
    experience: "",
    industries: [],
    credentials: "",
    tone: [],
    communication_style: "",
    phrases_to_avoid: [],
    preferred_cta_style: "",
    additional_context: "",
  },
};
export const emptyContent: ContentInput = {
  name: "",
  primary_audience: "",
  strategy: {
    secondary_audience: "",
    audience_problems: [],
    audience_interests: [],
    content_pillars: [],
    source_topics: [],
    reaction_angles: [],
    desired_outcomes: [],
    tone: [],
    things_to_avoid: [],
    preferred_ctas: [],
    additional_context: "",
  },
};
export const splitItems = (value: string) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
export function selectedProfile(
  profiles: ContentProfile[],
  requested: string | null,
  defaultId: string | null,
): ContentProfile | null {
  const active = profiles.filter((p) => !p.archived_at);
  return (
    active.find((p) => p.id === requested) ??
    active.find((p) => p.id === defaultId) ??
    active[0] ??
    null
  );
}
export function explainError(error: unknown): string {
  if (error instanceof z.ZodError)
    return [...new Set(error.issues.map((i) => {
      const field = i.path.filter(p => typeof p === 'string').at(-1)?.toString().replaceAll('_', ' ') ?? 'Answer';
      return `${field.charAt(0).toUpperCase()}${field.slice(1)}: ${i.message}`;
    }))].join(" ");
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "23505")
      return "That name is already in use. Choose another name.";
    if (code === "42501")
      return "Your session cannot make this change. Sign in again and retry.";
    if (code === "PGRST116" || code === "23503")
      return "This profile has changed. Reload your workspace and try again.";
    if (code === "40001")
      return "This profile changed in another session. Reload before saving again.";
  }
  if (error instanceof Error && error.message === "STALE")
    return "This profile changed in another session. Reload before saving again.";
  return "We couldn’t complete that request. Your changes are still here—please try again.";
}
