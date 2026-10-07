import {z} from 'zod';
export const ctaSchema=z.object({
 text:z.string().trim().min(1).max(500),
 keyword:z.string().trim().max(60).default(''),
 offer:z.string().trim().max(200).default(''),
 delivery:z.string().trim().max(300).default(''),
}).strict();
export const campaignSchema=z.object({id:z.string().uuid(),cta:ctaSchema,limit:z.number().int().min(1).max(100)}).strict();
export const ctaSelectionSchema=z.object({cta:ctaSchema,campaign_id:z.string().uuid().nullable(),scope:z.enum(['video','campaign','default'])}).strict();
export type CTA=z.infer<typeof ctaSchema>;
export type CTASelection=z.infer<typeof ctaSelectionSchema>;
export function ctaInstruction(selection:CTASelection|undefined){
 return selection?`CTA OVERRIDE: The creator explicitly selected this invitation: ${JSON.stringify(selection.cta.text)}. Use it as the sole promotional CTA in the cta field. Do not promote an older profile offer in hook or body. This supersedes older CTA and guide-promotion instructions, including Stephen's older guide mention. Do not promise automatic delivery or invent offer details. Delivery context: ${JSON.stringify(selection.cta.delivery)}. Keep other voice and factual safeguards.`:'';
}
