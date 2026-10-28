import {searchKeywords} from './search-keywords.ts';
import {researchBriefSchema,type ResearchBrief} from './research.ts';
/** Build a per-request brief. Never mutate the saved profile. */
export function directSearchBrief(brief:ResearchBrief,query:string,useProfile:boolean):ResearchBrief {
 const searchQuery=query.trim();
 if(!useProfile&&!searchQuery)throw new Error('SEARCH_QUERY_REQUIRED');
 const result={...brief};
 if(!useProfile){
  for(const key of ['expertise','experience','communicationStyle','preferredCtaStyle','creatorContext','primaryAudience','profileContext','researchScreeningCriteria','researchSeekSituations'] as const)result[key]='';
  for(const key of ['industries','creatorTone','phrasesToAvoid','audienceProblems','audienceInterests','contentPillars','sourceTopics','reactionAngles','desiredOutcomes','profileTone','thingsToAvoid','researchReferenceUrls','researchBlockedUrls'] as const)result[key]=[];
  result.audienceName='Direct search';result.researchSourcePlatforms=['TikTok','Instagram','YouTube'];
 }
 if(searchQuery){result.searchQuery=searchQuery;result.sourceTopics=searchKeywords(searchQuery);result.researchSeekSituations=searchQuery;result.researchScreeningCriteria=[`Find content matching at least one of these keyword phrases: ${searchKeywords(searchQuery).join("; ")}. Search each phrase separately; do not require every phrase in one clip. Do not substitute adjacent topics.`,result.researchScreeningCriteria].filter(Boolean).join('\n').slice(0,12000);}
 return researchBriefSchema.parse(result);
}
