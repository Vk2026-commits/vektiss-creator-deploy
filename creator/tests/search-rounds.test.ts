import {expect,it} from 'vitest';
import {directVideoUrl,mergeSearchRound,needsFilteredRefill,pendingReviewBatches} from '../src/domain/search-rounds';
it('launches independent review batches without losing or repeating partial failures',()=>{
 const batches=[[1,2],[3,4],[5,6]];
 expect(pendingReviewBatches(batches,[true,true])).toEqual([[5,6]]);
 expect(pendingReviewBatches(batches,[false,true])).toEqual([[1,2],[5,6]]);
 expect(pendingReviewBatches(batches,[true,false])).toEqual([[3,4],[5,6]]);
 expect(pendingReviewBatches(batches,[false,false])).toEqual(batches);
 expect(pendingReviewBatches(batches.slice(0,2),[true,true])).toEqual([]);
});
it('refills Stephen-style filtered shortfalls without bypassing bounded or pilot flows',()=>{
 const input={pilot:false,filtered:true,sourceMode:'videos',accepted:1,requested:5,round:1,reviewLimited:false};
 expect(needsFilteredRefill(input)).toBe(true);
 expect(needsFilteredRefill({...input,accepted:0,round:2})).toBe(true);
 for(const override of [{round:3},{accepted:5},{pilot:true},{filtered:false},{sourceMode:'articles'},{reviewLimited:true}])expect(needsFilteredRefill({...input,...override})).toBe(false);
});
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
