import {expect,it} from 'vitest';
import {directVideoUrl,mergeSearchRound} from '../src/domain/search-rounds';
it('retains prior clips and remaps colliding source ids in later rounds',()=>{
 const source={providerSourceId:1,title:'Incident',url:'https://www.instagram.com/reel/abc/',snippet:'',publishedAt:null,sourceType:'web'};
 const candidate={title:'Incident',factualSummary:'Footage',whyAudienceCares:'Safety',creatorConnection:'Security',recommendedAngle:'Explain',suggestedHook:'',category:'Safety',publishedAt:null,timelinessScore:50,relevanceScore:90,sourceIds:[1],uncertainty:'Watch'};
 const result=mergeSearchRound({sources:[source],candidates:[candidate]},{sources:[{...source,url:'https://www.instagram.com/reel/xyz/'}],candidates:[candidate]});
 expect(result.sources.map(s=>s.providerSourceId)).toEqual([1,2]);
 expect(result.candidates.map(c=>c.sourceIds)).toEqual([[1],[2]]);
 expect(candidate.sourceIds).toEqual([1]);
});
it('requires actual social video URLs, not keyword landing pages or profiles',()=>{
 expect(directVideoUrl('https://www.instagram.com/reel/abc/')).toBe(true);
 expect(directVideoUrl('https://www.instagram.com/popular/security/')).toBe(false);
 expect(directVideoUrl('https://www.instagram.com/steve/')).toBe(false);
 expect(directVideoUrl('https://example.com/reel/abc/')).toBe(false);
 expect(directVideoUrl('https://www.tiktok.com/@example/video/123')).toBe(true);
});
