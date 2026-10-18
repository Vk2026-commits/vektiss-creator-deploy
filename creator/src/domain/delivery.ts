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
export const deliveryInstruction='Use approved delivery preferences only as speaking-style guidance, never factual evidence or an offer. Do not copy reference anecdotes, claims or promotions. Use natural spoken sentences and punctuation to support the requested pauses and emphasis; never put stage directions or unsupported audio tags in spoken text. The CTA is the final spoken beat: write it as a direct invitation followed by a short, complete closing thought with a full stop, not a trailing ellipsis, dangling conjunction, or transition that sounds like more is coming. Do not add a new promise or sign-off that the creator did not choose. Preserve the current CTA and exact keyword; exact-wording selections must stay exact. Voice engines may not reproduce every requested nuance.';

export {closingPreview} from './voice-excerpt.ts';
