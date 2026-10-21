import {z} from 'zod';
import type {ProviderResearchCandidate,ResearchSource} from './research.ts';
export const screeningDecisionSchema=z.object({sourceId:z.number().int().positive(),outcome:z.enum(['accepted','rejected','needs_content_review']),reason:z.string().min(1).max(300)});
export type ScreeningDecision=z.infer<typeof screeningDecisionSchema>;
export function screeningDecisions(sources:ResearchSource[],candidates:ProviderResearchCandidate[],supplied:ScreeningDecision[]=[]):ScreeningDecision[]{
 const byId=new Map(supplied.map(d=>[d.sourceId,d]));
 return sources.map(s=>byId.get(s.providerSourceId)??{sourceId:s.providerSourceId,outcome:'needs_content_review',reason:'No explicit metadata verdict; content review required.'});
}
export function acceptedCandidates(candidates:ProviderResearchCandidate[],decisions:ScreeningDecision[]):ProviderResearchCandidate[]{
 const accepted=new Set(decisions.filter(d=>d.outcome==='accepted').map(d=>d.sourceId));
 return candidates.filter(c=>c.relevanceScore>=70&&accepted.has(c.sourceIds[0]));
}
export function inspectionIds(candidates:ProviderResearchCandidate[],decisions:ScreeningDecision[]):number[]{
 // Reserve space for unclear captions instead of inspecting only metadata approvals.
 const approved=[...new Set(candidates.filter(c=>c.relevanceScore>=70).sort((a,b)=>b.relevanceScore-a.relevanceScore).map(c=>c.sourceIds[0]))];
 const unclear=decisions.filter(d=>d.outcome==='needs_content_review').map(d=>d.sourceId);
 return [...approved.slice(0,unclear.length?3:5),...unclear.slice(0,2),...approved.slice(3),...unclear.slice(2)].filter((id,i,a)=>a.indexOf(id)===i).slice(0,5);
}
