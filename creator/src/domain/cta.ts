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
export function containsCtaKeyword(text:string,keyword:string){
 const escaped=keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return !keyword || new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`,'iu').test(text);
}
export function ctaInstruction(selection:CTASelection|undefined, conversational=false){
 if(selection&&conversational)return `CURRENT OFFER: ${JSON.stringify(selection.cta)}. Write a concise, natural spoken invitation in the cta field, usually one or two short sentences, using the creator's preferred CTA style. Name what viewers receive or join and its relevant purpose: never say only "if you want to join" or "send you the link" without identifying the offer. Preserve the exact comment keyword, the offer and the requested action; do not paste the full offer description. Do not invent free access, guarantees, automatic delivery, prices or benefits. If mentioning price or schedule, preserve them exactly. Do not use an older offer or a different keyword from reference videos. This is the sole promotional CTA; do not add a competing offer to hook or body.`;
 return selection?`CTA OVERRIDE: The creator explicitly selected this invitation: ${JSON.stringify(selection.cta.text)}. Use it as the sole promotional CTA in the cta field. Do not promote an older profile offer in hook or body. This supersedes older CTA and guide-promotion instructions, including Stephen's older guide mention. Do not promise automatic delivery or invent offer details. Delivery context: ${JSON.stringify(selection.cta.delivery)}. Keep other voice and factual safeguards.`:'';
}
