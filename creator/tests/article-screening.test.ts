import {expect,it} from 'vitest';
import {qualifyArticleCandidates} from '../src/domain/article-screening';
import {researchBriefSchema,type ProviderResearchCandidate} from '../src/domain/research';
const brief=researchBriefSchema.parse({expertise:'',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'Make Money With AI',primaryAudience:'Business owners',audienceProblems:[],audienceInterests:[],contentPillars:[],sourceTopics:['AI services'],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',sourceMode:'articles',discoveryPilot:true});
const source={providerSourceId:1,title:'AI receptionist client case study',url:'https://www.reuters.com/technology/ai-service-story',snippet:'A business reports paid deployment of an AI receptionist.',publishedAt:'2026-10-20',sourceType:'article',articleReview:{language:'en' as const,editorialType:'reporting' as const,excerpt:'A business reports paid deployment of an AI receptionist.',reviewedAt:'2026-10-20T12:00:00.000Z',method:'provider_source_text' as const}};
const candidate=(relevanceScore:number):ProviderResearchCandidate=>({title:'AI services',factualSummary:'A business describes its deployment.',whyAudienceCares:'Service delivery example.',creatorConnection:'AI expertise.',recommendedAngle:'Evaluate the claimed result.',suggestedHook:'Does it work?',category:'AI service',publishedAt:'2026-10-20',timelinessScore:100,relevanceScore,sourceIds:[1],uncertainty:''});
it('rejects the actual 8–10 scores and all scores below 70 without converting them to percentages',()=>{
 for(const score of [0,8,9,10,50,69])expect(qualifyArticleCandidates([candidate(score)],[source],brief)).toEqual([]);
 expect(qualifyArticleCandidates([candidate(70),candidate(90)],[source],brief)).toHaveLength(2);
});
it('does not invent an AI connection from a recommendation title or angle',()=>{
 expect(qualifyArticleCandidates([candidate(95)],[{...source,title:'An artist finds a client',snippet:'A handmade sculpture commission.'}],brief)).toEqual([]);
});
it('rejects missing or blocked source evidence and preserves other profiles subject matter',()=>{
 expect(qualifyArticleCandidates([candidate(90)],[],brief)).toEqual([]);
 expect(qualifyArticleCandidates([candidate(90)],[source],{...brief,researchBlockedUrls:[source.url]})).toEqual([]);
 expect(qualifyArticleCandidates([candidate(90)],[{...source,title:'Safety incident',snippet:'A documented safety issue affects the public in a new report.',articleReview:{...source.articleReview,excerpt:'A documented safety issue affects the public in a new report.'}}],{...brief,discoveryPilot:false,audienceName:'Safety',sourceTopics:['Personal safety']})).toHaveLength(1);
});

it('requires established English editorial reporting independently of a high relevance score',()=>{
 for(const url of ['https://dev.to/user/ai-experiment','https://note.com/user/story','https://www.prnewswire.com/news-releases/ai-contract','https://rexautomaton.com/blog/ai-automation','https://forbesjapan.com/articles/detail/123','https://reuters.com.evil.test/story','https://www.bbc.com/mundo/noticias-123','https://www.wired.com/sponsored/ai-story','https://www.axios.com/business/2026/10/16','https://www.reuters.com/technology/'])expect(qualifyArticleCandidates([candidate(99)],[{...source,url}],brief)).toEqual([]);
 for(const language of ['other','unknown'] as const)expect(qualifyArticleCandidates([candidate(99)],[{...source,articleReview:{...source.articleReview,language}}],brief)).toEqual([]);
 for(const editorialType of ['sponsored','press_release','opinion','unknown'] as const)expect(qualifyArticleCandidates([candidate(99)],[{...source,articleReview:{...source.articleReview,editorialType}}],brief)).toEqual([]);
 expect(qualifyArticleCandidates([candidate(99)],[{...source,articleReview:undefined}],brief)).toEqual([]);
 expect(qualifyArticleCandidates([candidate(99)],[{...source,articleReview:{...source.articleReview,excerpt:'The company is making money with an invented AI business claim.'}}],brief)).toEqual([]);
 expect(qualifyArticleCandidates([candidate(90)],[{...source,title:'AI service business expands in India'}],brief)).toHaveLength(1);
});
