import {z} from 'zod';
import type {ProviderResearchCandidate,ResearchSource,ResearchBrief} from './research.ts';
export const screeningDecisionSchema=z.object({sourceId:z.number().int().positive(),outcome:z.enum(['accepted','rejected','needs_content_review']),reason:z.string().min(1).max(300)});
export type ScreeningDecision=z.infer<typeof screeningDecisionSchema>;
export function sourceTopicSupported(s:ResearchSource,brief?:ResearchBrief):boolean{
 if(!brief||!/\bAI\b/i.test(brief.sourceTopics.join(' '))||!/money|income|business|service|freelanc/i.test(brief.audienceName+' '+brief.sourceTopics.join(' ')))return true;
 const visible=(s.review?.observations??'').split(/[.!?\n]/).filter(line=>!/\b(no|not|without|absent|unrelated|none)\b/i.test(line)).join(' ');
 const text=[s.title,s.snippet,s.review?.transcript??'',visible].join(' ');
 return /\b(?:AI|artificial intelligence|ChatGPT|Claude|GPT[ -]?\d[\w.-]*|LLMs?|Midjourney|Copilot|Gemini|Grok|DeepSeek|HeyGen|Higgsfield|ElevenLabs)\b/i.test(text);
}
export function screeningDecisions(sources:ResearchSource[],candidates:ProviderResearchCandidate[],supplied:ScreeningDecision[]=[],brief?:ResearchBrief):ScreeningDecision[]{
 const byId=new Map(supplied.map(d=>[d.sourceId,d]));
 return sources.map(s=>{
  const decision=byId.get(s.providerSourceId)??{sourceId:s.providerSourceId,outcome:'needs_content_review' as const,reason:'No explicit metadata verdict; content review required.'};
  return decision.outcome==='accepted'&&!sourceTopicSupported(s,brief)?{...decision,outcome:'needs_content_review' as const,reason:'Source evidence does not establish an AI connection; a hypothetical reaction angle is insufficient.'}:decision;
 });
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
