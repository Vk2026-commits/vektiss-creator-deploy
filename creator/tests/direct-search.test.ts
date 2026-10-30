import {acceptedCandidates} from '../src/domain/pilot-screening';
import {describe,it,expect} from 'vitest';
import {researchBriefSchema,researchRequestSchema} from '../src/domain/research';
import {nativeScreeningInstructions} from '../supabase/functions/_shared/research-provider';
import {directSearchBrief} from '../src/domain/direct-search';
import {buildTikTokQueryPack,buildCrossPlatformQueryPack,buildInstagramQueryPack} from '../supabase/functions/_shared/platform-discovery';
const brief=researchBriefSchema.parse({expertise:'security',experience:'security',industries:['security'],communicationStyle:'direct',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'security only',audienceName:'Safety',primaryAudience:'guards',audienceProblems:[],audienceInterests:['safety'],contentPillars:['safety'],sourceTopics:['personal safety'],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:['food'],profileContext:'Only safety clips',researchScreeningCriteria:'visible action only',researchReferenceUrls:['https://example.com/safety'],discoveryPilot:true});
describe('direct search',()=>{
 it('removes inherited topic and screening restrictions when profile is off',()=>{const result=directSearchBrief(brief,'fast food fries rankings',false);expect(result.thingsToAvoid).toEqual([]);expect(result.creatorContext).toBe('');expect(result.researchReferenceUrls).toEqual([]);expect(result.researchScreeningCriteria).not.toContain('visible action');expect(result.sourceTopics).toEqual(['fast food fries rankings']);expect(brief.sourceTopics).toEqual(['personal safety']);});
 it('uses profile screening as ranking preferences and queries every platform',()=>{const result=directSearchBrief(brief,'fast food fries rankings',true);expect(result.researchScreeningCriteria).not.toContain('visible action');expect(result.profileContext).toContain('visible action');expect(result.thingsToAvoid).toEqual([]);for(const build of [buildTikTokQueryPack,buildCrossPlatformQueryPack,buildInstagramQueryPack])expect(build(result)).toEqual(['fast food fries rankings']);expect(result.discoveryPilot).toBe(true);});
 it('rejects empty profile-free requests and defaults old clients to profile mode',()=>{const base={profileId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),requestedCount:3};expect(researchRequestSchema.parse(base).useContentProfile).toBe(true);expect(researchRequestSchema.safeParse({...base,useContentProfile:false,searchQuery:'  '}).success).toBe(false);});
});

it('searches each keyword phrase on every platform without joining them',()=>{
 const result=directSearchBrief(brief,'AI side hustles, first AI client, AI side hustles',false);
 for(const build of [buildTikTokQueryPack,buildCrossPlatformQueryPack,buildInstagramQueryPack])expect(build(result)).toEqual(['AI side hustles','first AI client']);
 expect(result.researchScreeningCriteria).toContain('at least one');
});

it('limits ranking context and keeps explicit keyword evidence separate',()=>{
 const result=directSearchBrief({...brief,profileContext:'x'.repeat(5000)},'restaurant reviews',true);
 expect(result.profileContext.length).toBeLessThanOrEqual(5000);
 expect(result.profileRankingOnly).toBe(true);
 expect(result.sourceTopics).toEqual(['restaurant reviews']);
});

it('ranks profile fit rather than applying legacy audience vetoes',()=>{
 const prompt=nativeScreeningInstructions(directSearchBrief(brief,'restaurant reviews',true),5,15,[]);
 expect(prompt).toContain('ranking preference, never an additional topic or format gate');
 expect(prompt).not.toContain('For an AI-income audience, acceptance requires');
 expect(prompt).not.toContain('reject news/reaction/compilation packaging');
});

it('keeps accepted topic matches with lower profile scores in search mode',()=>{
 const candidates=[{relevanceScore:40,sourceIds:[1]},{relevanceScore:90,sourceIds:[2]}] as any;
 const decisions=[{sourceId:1,outcome:'accepted',reason:'Matches topic'},{sourceId:2,outcome:'rejected',reason:'Off topic'}] as any;
 expect(acceptedCandidates(candidates,decisions,0)).toEqual([candidates[0]]);
 expect(acceptedCandidates(candidates,decisions)).toEqual([]);
});
