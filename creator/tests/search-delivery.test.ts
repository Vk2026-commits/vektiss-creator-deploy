import {expect,it} from 'vitest';
import {deliveryProgress,refillDecision} from '../src/domain/search-delivery';
it('reports delivered results, not pretend stage or time percentages',()=>{
 const job={requested_count:5,delivered_count:3,created_at:'2026-10-30T10:00:00Z'};
 expect(deliveryProgress(job,Date.parse('2026-10-30T10:01:12Z'))).toEqual({percent:60,delivered:3,remaining:2,elapsed:'1m 12s'});
 expect(deliveryProgress({...job,delivered_count:0}).percent).toBe(0);
 expect(deliveryProgress({...job,delivered_count:5}).percent).toBe(100);
});
it('continues through review rounds until full count or independent budget interruption',()=>{
 const base={delivered:4,requested:5,reviewed:70,requests:40,unused:8,canRetrieve:true,providerLimited:false,reviewLimited:false};
 expect(refillDecision(base)).toBe('review'); // retrieval exhausted, cached candidates remain
 expect(refillDecision({...base,unused:0})).toBe('retrieval_budget');
 expect(refillDecision({...base,requests:8,unused:0})).toBe('retrieve');
 expect(refillDecision({...base,reviewed:120})).toBe('review_budget');
 expect(refillDecision({...base,delivered:5,reviewed:120})).toBe('complete');
 expect(refillDecision({...base,reviewLimited:true})).toBe('review_provider_limited');
 expect(refillDecision({...base,unused:0,providerLimited:true})).toBe('retrieval_provider_limited');
});
it('does not relax filters to reach the target and keeps reviewing after four results',()=>{
 const input={delivered:0,requested:5,reviewed:0,requests:3,unused:10,canRetrieve:true,providerLimited:false,reviewLimited:false};
 const seen=new Set<string>();
 for(const batch of [['a','b','a'],['c','bad','d'],['d','e']]){
  for(const id of batch){input.reviewed++;if(id!=='bad')seen.add(id);}
  input.delivered=seen.size;
  expect(refillDecision(input)).toBe(seen.size===5?'complete':'review');
 }
 expect(input.delivered).toBe(5);
});
