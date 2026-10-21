import {canonicalResearchUrl,type ProviderResearchCandidate,type ResearchSource,type ResearchBrief} from './research.ts';
import {sourceTopicSupported} from './pilot-screening.ts';

/** Relevance is an eligibility requirement, not just a sorting weight. Never rescale model scores. */
export function qualifyArticleCandidates(candidates:ProviderResearchCandidate[],sources:ResearchSource[],brief:ResearchBrief):ProviderResearchCandidate[]{
 const byId=new Map(sources.map(s=>[s.providerSourceId,s]));
 const blocked=new Set(brief.researchBlockedUrls.map(canonicalResearchUrl).filter(Boolean));
 return candidates.filter(c=>{
  if(c.relevanceScore<70||!c.sourceIds.length)return false;
  const evidence=c.sourceIds.map(id=>byId.get(id));
  if(evidence.some(s=>!s||!canonicalResearchUrl(s.url)||blocked.has(canonicalResearchUrl(s.url))))return false;
  // The source itself must establish the pilot profile's AI connection. Suggested angles cannot supply it.
  return !brief.discoveryPilot||sourceTopicSupported(evidence[0]!,brief);
 });
}
