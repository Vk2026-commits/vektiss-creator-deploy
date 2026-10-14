import {describe,it,expect} from 'vitest';
import {costTotals,allocatedShared,priceForMargin,type CostEvent} from '../src/domain/usage-dashboard';
describe('cost accounting',()=>{
 it('does not add an estimate to an already reported charge or treat unknown as free',()=>{
  const result=costTotals([{reported:2,estimate:3,status:'completed'},{reported:null,estimate:4,status:'completed'},{reported:null,estimate:null,status:'failed'},{reported:0,estimate:5,status:'completed'}] as CostEvent[]);
  expect(result).toEqual({reported:2,estimated:4,unknown:1,attempts:4,failed:1});
 });
 it('allocates overlapping shared bills once',()=>{
  expect(allocatedShared({period_start:'2026-10-01',period_end:'2026-10-10',amount_usd:100} as any,'2026-10-05T00:00:00Z','2026-10-07T00:00:00Z')).toBe(20);
 });
 it('uses gross margin, not markup',()=>{expect(priceForMargin(3,70)).toBeCloseTo(10);expect(priceForMargin(3,100)).toBeNull();});
});
