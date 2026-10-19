import {expect,it} from 'vitest';
import {researchBriefSchema} from '../src/domain/research';
import {wantsVisibleAction,actionFormatRejection} from '../src/domain/search-intent';
import {buildInstagramQueryPack,buildTikTokQueryPack,buildCrossPlatformQueryPack} from '../supabase/functions/_shared/platform-discovery';
import {nativeScreeningInstructions} from '../supabase/functions/_shared/research-provider';
const brief=researchBriefSchema.parse({expertise:'Security',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'Safety',primaryAudience:'',audienceProblems:[],audienceInterests:[],contentPillars:['situational awareness'],sourceTopics:['personal safety'],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',researchScreeningCriteria:'Focus on de-escalation techniques in action, rather than discussing situations.'});
it('uses action-specific queries across three distinct rounds without gender/following defaults',()=>{
 expect(wantsVisibleAction(brief)).toBe(true);
 for(const build of [buildInstagramQueryPack,buildTikTokQueryPack,buildCrossPlatformQueryPack]){
  const rounds=[1,2,3].map(round=>build(brief,'same',round));
  expect(rounds.every(pack=>pack.length===5)).toBe(true);
  expect(new Set(rounds.flat()).size).toBe(15);
  expect(rounds.flat().join(' ')).not.toMatch(/woman|stalking|followed/);
 }
});
it('uses saved seek situations and keeps action rules scoped to requesting profiles',()=>{
 expect(buildTikTokQueryPack({...brief,researchSeekSituations:'bus driver intervenes in confrontation'})[0]).toBe('bus driver intervenes in confrontation');
 const other={...brief,expertise:'Credit',sourceTopics:['credit reports'],contentPillars:[],researchScreeningCriteria:''};
 expect(wantsVisibleAction(other)).toBe(false);
 expect(buildTikTokQueryPack(other).join(' ')).not.toMatch(/security|confrontation/);
});
it('rejects explicit car monologues but not an actual incident merely involving a car',()=>{
 const source={providerSourceId:1,title:'Storytime: sitting in my car telling my story',snippet:'',url:'https://example.com/video',publishedAt:null,sourceType:'instagram-reels-native'};
 expect(actionFormatRejection(brief,source)).toBeTruthy();
 expect(actionFormatRejection(brief,{...source,title:'CCTV shows security intervening beside a car'})).toBeNull();
 expect(nativeScreeningInstructions(brief,3,9,[source])).toContain('omit the lead rather than using Watch first');
});
