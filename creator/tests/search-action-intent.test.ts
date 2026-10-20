import {expect,it,vi} from 'vitest';
import {researchBriefSchema} from '../src/domain/research';
import {wantsVisibleAction,actionFormatRejection,actionEvidenceInstruction} from '../src/domain/search-intent';
import {discoveryDiagnostics,buildInstagramQueryPack,buildTikTokQueryPack,buildCrossPlatformQueryPack} from '../supabase/functions/_shared/platform-discovery';
import {nativeScreeningInstructions,startDeepResearch} from '../supabase/functions/_shared/research-provider';
const brief=researchBriefSchema.parse({expertise:'Security',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'Safety',primaryAudience:'',audienceProblems:[],audienceInterests:[],contentPillars:['situational awareness'],sourceTopics:['personal safety'],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',researchScreeningCriteria:'Focus on de-escalation techniques in action, rather than discussing situations.'});
it('respects profile permissions for labeled demonstrations and recorded interactions',()=>{
 const instruction=actionEvidenceInstruction(brief);
 expect(instruction).toContain('Recorded conversations can qualify');
 expect(instruction).toContain('News-account footage can qualify');
 expect(instruction).toContain('never as a verified real incident');
 expect(instruction).toContain('do not override an explicit permission');
});
it('keeps indexed fallback scoped to selected platforms and concrete action queries',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'test',status:'queued'})));
 vi.stubGlobal('fetch',fetchMock);
 vi.stubGlobal('Deno',{env:{get:()=> 'test-only'}});
 try{
  await startDeepResearch({brief:{...brief,sourceMode:'videos',researchSourcePlatforms:['Instagram']},requestedCount:3,candidateMultiplier:2,queryHints:['doorbell attempted entry footage'],excludeUrls:['https://www.instagram.com/reel/seen/']});
  const body=JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.tools[0].filters.search_domain_filter).toEqual(['instagram.com']);
  expect(body.input).toContain('doorbell attempted entry footage');
  expect(body.input).toContain('https://www.instagram.com/reel/seen/');
  expect(body.input).toContain('omit the lead rather than using Watch first');
  expect(body.max_steps).toBe(5);
 }finally{vi.unstubAllGlobals();}
});
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
 expect(buildInstagramQueryPack({...brief,researchSeekSituations:'bus driver intervenes in confrontation'})[0]).toBe('bus driver intervenes in confrontation');
 const other={...brief,expertise:'Credit',sourceTopics:['credit reports'],contentPillars:[],researchScreeningCriteria:''};
 expect(wantsVisibleAction(other)).toBe(false);
 expect(buildTikTokQueryPack(other).join(' ')).not.toMatch(/security|confrontation/);
 expect(buildInstagramQueryPack(other)).toContain('credit reports');
});
it('rejects explicit car monologues but not an actual incident merely involving a car',()=>{
 const source={providerSourceId:1,title:'Storytime: sitting in my car telling my story',snippet:'',url:'https://example.com/video',publishedAt:null,sourceType:'instagram-reels-native'};
 expect(actionFormatRejection(brief,source)).toBeTruthy();
 expect(actionFormatRejection(brief,{...source,title:'CCTV shows security intervening beside a car'})).toBeNull();
 expect(nativeScreeningInstructions(brief,3,9,[source])).toContain('omit the lead rather than using Watch first');
});
it('retains query and collection diagnostics without treating missing historical counts as zero',()=>{
 const data=discoveryDiagnostics({id:'run',platform:'Instagram',status:'SUCCEEDED',queryPack:['security intervention'],sources:[],rawCount:12,invalidCount:8,formatRejectedCount:4,duplicateCount:0});
 expect(data).toMatchObject({queryPack:['security intervention'],sourceCount:0,rawCount:12,invalidCount:8,formatRejectedCount:4});
 expect(discoveryDiagnostics({sources:[]}).rawCount).toBeNull();
});
