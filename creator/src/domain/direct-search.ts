import {wantsVisibleAction,actionEvidenceInstruction} from './search-intent.ts';
import {searchKeywords} from './search-keywords.ts';
import {researchBriefSchema,type ResearchBrief} from './research.ts';
/** Build a per-request brief. Never mutate the saved profile. */
export function directSearchBrief(brief:ResearchBrief,query:string,useProfile:boolean,visibleActionOnly?:boolean,speedFirst=false):ResearchBrief {
 const searchQuery=query.trim();
 if(!useProfile&&!searchQuery)throw new Error('SEARCH_QUERY_REQUIRED');
 const actionRequired=visibleActionOnly??(useProfile&&wantsVisibleAction(brief));
 const result={...brief,profileRankingOnly:speedFirst||!useProfile,profileVerificationRequired:useProfile&&!speedFirst,...(visibleActionOnly!==undefined?{visibleActionOnly}: {})};
 if(!useProfile){
  for(const key of ['expertise','experience','communicationStyle','preferredCtaStyle','creatorContext','primaryAudience','profileContext','researchScreeningCriteria','researchSeekSituations'] as const)result[key]='';
  for(const key of ['industries','creatorTone','phrasesToAvoid','audienceProblems','audienceInterests','contentPillars','sourceTopics','reactionAngles','desiredOutcomes','profileTone','thingsToAvoid','researchReferenceUrls','researchBlockedUrls'] as const)result[key]=[];
  result.audienceName='Direct search';result.researchSourcePlatforms=['TikTok','Instagram','YouTube'];
 }
 // An enabled profile is an explicit relevance requirement, not a decorative score.
 if(useProfile){
  result.researchScreeningCriteria=[result.researchScreeningCriteria,'Verify each clip against the creator’s audience, expertise, topics, and exclusions. Require a concrete useful connection supported by source evidence. Keyword overlap alone is insufficient; reject unrelated entertainment or incidental mentions. Explain the profile connection without inventing one.'].filter(Boolean).join('\n').slice(0,12000);
 }
 if(searchQuery){result.searchQuery=searchQuery;result.sourceTopics=searchKeywords(searchQuery);result.researchSeekSituations=searchQuery;result.researchScreeningCriteria=[`Find content matching at least one of these keyword phrases: ${searchKeywords(searchQuery).join("; ")}. Search each phrase separately; do not require every phrase in one clip. Do not substitute adjacent topics.`,result.researchScreeningCriteria].filter(Boolean).join('\n').slice(0,12000);}
 if(actionRequired)result.researchScreeningCriteria+='\nVisible action required. '+actionEvidenceInstruction({...brief,visibleActionOnly:true});
 return researchBriefSchema.parse(result);
}
