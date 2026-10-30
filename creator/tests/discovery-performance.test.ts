import {expect,it} from 'vitest';
import {videoPerformancePoints,researchSourceSchema,rankResearchCandidates} from '../src/domain/research';
const source=(id:number,views:number,ratio:number)=>researchSourceSchema.parse({providerSourceId:id,url:`https://www.tiktok.com/@creator/video/${id}`,title:'Example',publishedAt:null,snippet:'Example',sourceType:'tiktok-native',engagement:{views,likes:100,comments:0,shares:0,rate:2,observedAt:new Date().toISOString(),provider:'test',baseline:{medianViews:100,sampleSize:5,ratio,samples:Array.from({length:5},(_,i)=>({url:`https://example.com/${i}`,views:100}))}}});
it('does not invent performance when metrics are missing',()=>{
 expect(videoPerformancePoints(researchSourceSchema.parse({providerSourceId:1,url:'https://example.com',title:'Example',publishedAt:null,snippet:''}))).toBe(0);
});
it('bounds performance and favors a creator breakout at equal audience fit',()=>{
 const weak=source(1,100,1),strong=source(2,100000,8);
 expect(videoPerformancePoints(strong)).toBeGreaterThan(videoPerformancePoints(weak));
 expect(videoPerformancePoints(source(3,1e12,10000))).toBeLessThanOrEqual(30);
 const candidates=[{title:'Customer service demonstration',sourceIds:[1]},{title:'Marketing campaign results',sourceIds:[2]}].map(c=>({...c,factualSummary:'Example',whyAudienceCares:'Useful',creatorConnection:'Relevant',recommendedAngle:'Explain',suggestedHook:'See this',category:'Business',publishedAt:null,relevanceScore:80,timelinessScore:50,uncertainty:''}));
 const ranked=rankResearchCandidates(candidates,[weak,strong],[],2);
 expect(ranked[0].sourceIds).toEqual([2]);
});
