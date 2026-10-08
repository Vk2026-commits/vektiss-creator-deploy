import {z} from 'zod';
import {ctaSchema} from './cta.ts';
import {contentInputSchema,type ContentInput} from './strategy.ts';
export const editFields=['name','primary_audience','secondary_audience','audience_problems','audience_interests','content_pillars','source_topics','reaction_angles','desired_outcomes','tone','things_to_avoid','preferred_ctas','additional_context'] as const;
export const profileProposalSchema=z.object({
 summary:z.string().max(1000),question:z.string().max(500),
 changes:z.array(z.object({field:z.enum(editFields),value:z.string().max(5000)}).strict()).max(13),
 scope:z.enum(['none','default','next','video','cancel']),count:z.number().int().min(1).max(100).nullable(),cta:ctaSchema.nullable(),
}).strict().transform(proposal=>({...proposal,changes:['next','video','cancel'].includes(proposal.scope)?proposal.changes.filter(change=>change.field!=='preferred_ctas'):proposal.changes}));
export type ProfileProposal=z.infer<typeof profileProposalSchema>;
export function applyProfileProposal(initial:ContentInput,p:ProfileProposal):ContentInput {
 if(p.question)throw Error('Answer the clarification before saving.');
 if(p.scope==='video')throw Error('Apply this CTA in the video editor, not the audience profile.');
 if(['default','next','video'].includes(p.scope)&&!p.cta)throw Error('Add the CTA before saving.');
 if(p.scope==='next'&&!p.count)throw Error('Choose how many posts should use this CTA.');
 const next:ContentInput={name:initial.name,primary_audience:initial.primary_audience,strategy:{...initial.strategy},cta_default:initial.cta_default,cta_campaign:initial.cta_campaign};
 for(const change of p.changes){
  if(change.field==='name'||change.field==='primary_audience')next[change.field]=change.value;
  else if(change.field==='secondary_audience'||change.field==='additional_context')next.strategy[change.field]=change.value;
  else next.strategy[change.field]=change.value.split('\n').map(s=>s.trim()).filter(Boolean);
 }
 if(p.scope==='default'){next.cta_default=p.cta;next.cta_campaign=null;}
 if(p.scope==='next')next.cta_campaign={id:crypto.randomUUID(),limit:p.count!,cta:p.cta!};
 if(p.scope==='cancel')next.cta_campaign=null;
 return contentInputSchema.parse(next);
}
