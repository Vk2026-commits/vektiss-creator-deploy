import {it,expect,vi} from 'vitest';
import {orderResearch,type ResearchSort} from '../src/domain/research-sort';
it.each(['recommended','match','newest','oldest','discovered'] as ResearchSort[])('orders %s with stable tie breakers',sort=>{
 const query={order:vi.fn().mockReturnThis()};orderResearch(query,sort);
 const calls=query.order.mock.calls;
 expect(calls.slice(-2)).toEqual([['created_at',{ascending:false}],['id',{ascending:false}]]);
 if(sort==='recommended')expect(calls[0]).toEqual(['rank_score',{ascending:false,nullsFirst:false}]);
 if(sort==='match')expect(calls[0]).toEqual(['relevance_score',{ascending:false,nullsFirst:false}]);
 if(sort==='newest'||sort==='oldest')expect(calls[0]).toEqual(['published_at',{ascending:sort==='oldest',nullsFirst:false}]);
 if(sort==='discovered')expect(calls).toHaveLength(2);
});
