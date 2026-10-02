import { z } from 'zod';
import type { ContentProfile } from './strategy';
import { briefSchema, emptyBrief } from './script-brief';

export const scriptSchema = z.object({
  content_profile_id: z.string().min(1),
  title: z.string().trim().min(1, 'Add a topic or title.').max(200),
  hook: z.string().max(2000),
  body: z.string().max(15000),
  cta: z.string().max(2000),
  brief: briefSchema.default(emptyBrief),
});
export type ScriptInput = z.infer<typeof scriptSchema>;
export type Script = ScriptInput & { id: string; updated_at: string };
export function guidedDraft(topic: string, profile: ContentProfile): ScriptInput {
  return scriptSchema.parse({
    content_profile_id: profile.id,
    title: topic,
    hook: `Let’s talk about ${topic.trim()}. Here’s one thing worth knowing.`,
    body: '[Explain the key idea in your own words.]\n\n[Give one specific, accurate example from your experience.]\n\n[Share one practical takeaway your audience can use.]',
    cta: profile.strategy.preferred_ctas[0] || 'Save this for later, and tell me what you’d like to learn next.',
  });
}
export const scriptText = (s: ScriptInput) => [s.hook, s.body, s.cta].filter(Boolean).join('\n\n');
