import {z} from 'zod';
export const ctaSchema=z.object({
 text:z.string().trim().min(1).max(500),
 keyword:z.string().trim().max(60).default(''),
 offer:z.string().trim().max(200).default(''),
 delivery:z.string().trim().max(300).default(''),
 wording:z.enum(['natural','exact']).optional(),
}).strict();
export const campaignSchema=z.object({id:z.string().uuid(),cta:ctaSchema,limit:z.number().int().min(1).max(100)}).strict();
export const ctaSelectionSchema=z.object({cta:ctaSchema,campaign_id:z.string().uuid().nullable(),scope:z.enum(['video','campaign','default'])}).strict();
export type CTA=z.infer<typeof ctaSchema>;
export type CTASelection=z.infer<typeof ctaSelectionSchema>;
export function containsCtaKeyword(text:string,keyword:string){
 const escaped=keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return !keyword || new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`,'iu').test(text);
}
export function naturalCtaIssues(text:string,cta?:CTA){
 const issues:string[]=[];
 if(!text.trim()&&cta)issues.push('Missing invitation');
 if(cta&&!containsCtaKeyword(text,cta.keyword))issues.push('Missing comment keyword');
 if(/\b(?:I want (?:the )?(?:viewers|audience)|invite (?:them|viewers|the audience) to|ask (?:them|viewers|the audience) to|tell (?:them|viewers|the audience) to|the (?:viewer|audience) should|(?:CTA|call to action)\s*:)/i.test(text))issues.push('Spoken text contains planning instructions');
 return issues;
}
export function finalizeCta(text:string,selection?:CTASelection){
 if(selection?.cta.wording==='exact')return selection.cta.text;
 if(naturalCtaIssues(text,selection?.cta).length)throw Error('SCRIPT_STYLE');
 return text;
}
export function ctaInstruction(selection:CTASelection|undefined){
 const spoken=' Write the ending as words the creator says directly to the viewer: use you/your and I/my where appropriate. Never narrate planning instructions such as "I want viewers to", "Invite them to", or "Ask viewers to". Connect the invitation to the specific problem discussed in this script using only benefits supported by the selected offer. End with a complete sentence.';
 if(selection?.cta.wording!=='exact')return (selection?`CURRENT OFFER: ${JSON.stringify(selection.cta)}. Write a concise, natural spoken invitation in the cta field, usually one or two short sentences. Preserve the exact comment keyword, named offer, requested action, price and delivery commitments; do not paste the full offer description. With a comment keyword, tell the viewer directly what word to comment and what they will receive. Do not promise automatic delivery unless explicitly supplied, or invent free access, guarantees, prices, benefits or a different delivery method. Preserve any required assessment or sign-up step. The topic may change emphasis, not the offer. This is the sole promotional CTA; do not add a competing offer to hook or body.`:'Use the profile’s CTA preferences as guidance for a natural spoken invitation. Do not invent an offer or keyword.')+spoken;
 return selection?`CTA OVERRIDE: The creator explicitly selected this invitation: ${JSON.stringify(selection.cta.text)}. Use it as the sole promotional CTA in the cta field. Do not promote an older profile offer in hook or body. This supersedes older CTA and guide-promotion instructions, including Stephen's older guide mention. Do not promise automatic delivery or invent offer details. Delivery context: ${JSON.stringify(selection.cta.delivery)}. Keep other voice and factual safeguards.`:'';
}
