import { z } from 'zod';
import { videoPlanSchema,graphicCaptureSchema } from './video-plan.ts';
import {sourceCutSchema} from './source-cut.ts';
import {resolvedSourceSchema} from './resolved-source.ts';
export const briefSchema = z.object({
  kind: z.enum(['article', 'video','graphic']),
  prepared_source:resolvedSourceSchema.optional(),
  graphic_capture:graphicCaptureSchema.optional(),
  url: z.string().max(2000).refine(v => !v || /^https?:\/\//i.test(v), 'Use an http or https source URL.'),
  source: z.string().max(40000),
  notes: z.string().max(10000),
  questions: z.array(z.object({ question: z.string().max(1000), answer: z.string().max(5000) })).max(5),
  summary: z.string().max(4000),
  source_summary: z.string().max(4000).optional(),
  review: z.string().max(4000),
  clarified: z.boolean(),
  stage: z.enum(['source', 'perspective', 'clarify', 'review']),
  production: videoPlanSchema.optional(),
  source_cut: sourceCutSchema.optional(),
});
export type ScriptBrief = z.infer<typeof briefSchema>;
export const emptyBrief = (): ScriptBrief => ({kind:'article',url:'',source:'',notes:'',questions:[],summary:'',review:'',clarified:false,stage:'source'});
