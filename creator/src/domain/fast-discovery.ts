import type {ResearchBrief,ResearchSource,ProviderResearchCandidate} from './research.ts';
import {wantsVisibleAction,actionFormatRejection} from './search-intent.ts';
export function fastClipCandidates(sources:ResearchSource[],brief:ResearchBrief):ProviderResearchCandidate[]{
 return sources.filter(s=>{
  if(!wantsVisibleAction(brief))return true;
  if(s.review?.level!=='video_sampled'||actionFormatRejection(brief,s))return false;
  const observed=(s.review.observations??'').split(/[.!?\n]/).filter(x=>! /\b(no|not|without|unclear|cannot|unable)\b/i.test(x)).join(' ');
  return /\b(demonstrat\w*|interven\w*|confront\w*|fight\w*|running|grabs?|grabbing|push\w*|rescu\w*|approach\w*|interaction|incident|physical action)\b/i.test(observed);
 }).map(s=>({title:s.title.slice(0,220),factualSummary:s.snippet||'Open the original video to watch this search result.',whyAudienceCares:'Search result matching your selected filters.',creatorConnection:'Choose this clip to develop your own video.',recommendedAngle:'Choose React or Remake to develop this clip into your own video.',suggestedHook:'',category:'Search result',publishedAt:s.publishedAt,timelinessScore:0,relevanceScore:0,sourceIds:[s.providerSourceId],uncertainty:'Direct search result. AI audience ranking and editorial analysis have not been generated. Watch the original before using it.'}));
}
