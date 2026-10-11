import {z} from 'zod';

export const deliveryFields=['pace','energy','pauses','emphasis','phrasing','closing'] as const;
const description=z.string().trim().max(400);
export const deliverySuggestionsSchema=z.object({
 pace:description,energy:description,pauses:description,emphasis:description,
 phrasing:description,closing:description,
 uncertainty:z.string().trim().max(800),
}).strict();
export const deliveryProfileSchema=deliverySuggestionsSchema.extend({
 version:z.literal(1),approved_at:z.string().datetime(),
}).strict();
export type DeliveryProfile=z.infer<typeof deliveryProfileSchema>;
export type DeliverySuggestions=z.infer<typeof deliverySuggestionsSchema>;
export const emptyDelivery:DeliverySuggestions={pace:'',energy:'',pauses:'',emphasis:'',phrasing:'',closing:'Finish the final sentence clearly, with a settled cadence.',uncertainty:''};
export const deliveryInstruction='Use approved delivery preferences only as speaking-style guidance, never factual evidence or an offer. Do not copy reference anecdotes, claims or promotions. Use natural spoken sentences and punctuation to support the requested pauses and emphasis; never put stage directions or unsupported audio tags in spoken text. End with a complete closing sentence, not a trailing ellipsis or unfinished thought. Preserve the current CTA and exact keyword. Voice engines may not reproduce every requested nuance.';

// Keep complete sentences: never cut the last word to meet a preview limit.
export function closingPreview(script:{hook:string;body:string;cta:string}){
 const ending=(script.cta.trim()||script.body.trim()).match(/[^.!?]+[.!?]+[”"']*|[^.!?]+$/g)?.map(s=>s.trim()).filter(Boolean)??[];
 const last=ending.at(-1)??'';
 if(last.length>1200)return '';
 const hook=script.hook.trim().match(/^[\s\S]*?[.!?](?:\s|$)/)?.[0].trim()??script.hook.trim();
 return hook&&hook!==last&&hook.length+last.length+2<=1200?`${hook}\n\n${last}`:last;
}
