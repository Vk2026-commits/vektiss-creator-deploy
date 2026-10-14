import {describe,it,expect} from 'vitest';
import {costTotals,allocatedShared,priceForMargin,globalSpending,coverage,costReason,priceHeygenEvents,engineName,type CostEvent,type DashboardData} from '../src/domain/usage-dashboard';
describe('cost accounting',()=>{
 it('keeps 113 hosting activities visible without counting them as missing charges',()=>{
  const rows=Array.from({length:113},()=>({provider:'Bunny processing',status:'done',reported:null,estimate:null} as CostEvent));
  expect(costTotals(rows).unknown).toBe(0);expect(costTotals(rows).attempts).toBe(113);expect(coverage(rows).hosting).toBe(113);
 });
 it('separates running requests, unresolved failures and non-billable fixtures',()=>{
  const rows=[{status:'pending'},{status:'failed'},{status:'completed',fixture:true}].map(e=>({...e,provider:'HeyGen',reported:null,estimate:null} as CostEvent));
  expect(coverage(rows)).toEqual({review:1,running:1,hosting:0,fixtures:1});expect(costTotals(rows).unknown).toBe(1);
  expect(costReason(rows[1])).toContain('does not mean free');
 });
 it('prices actual engine usage without replacing reported charges or inventing unsupported rates',()=>{
  const base={provider:'HeyGen',avatar:'Rose',status:'completed',reported:null,estimate:null,seconds:60,avatar_type:'digital_twin'};
  const data=priceHeygenEvents({events:[{...base,engine:'avatar_iii'},{...base,engine:'avatar_iv'},{...base,engine:'avatar_v'},{...base,engine:'avatar_v',avatar_type:'photo_avatar'},{...base,engine:'avatar_v',reported:4}]} as DashboardData);
  expect(data.events.map(e=>e.estimate)).toEqual([.6,4.83,7.2,null,null]);expect(costTotals(data.events).reported).toBe(4);expect(engineName('avatar_iv')).toBe('Avatar IV');
 });
 it('adds global recorded costs, estimates and shared bills exactly once',()=>{
  const data={events:[{reported:2,estimate:5,status:'completed'},{reported:null,estimate:3,status:'completed'},{reported:null,estimate:null,status:'failed'}],shared:[{period_start:'2026-10-01',period_end:'2026-10-10',amount_usd:10}]} as DashboardData;
  expect(globalSpending(data,'2026-10-01T00:00:00Z','2026-10-11T00:00:00Z')).toEqual({recorded:2,estimated:3,bills:10,total:15,missing:1});
 });
 it('does not add an estimate to an already reported charge or treat unknown as free',()=>{
  const result=costTotals([{reported:2,estimate:3,status:'completed'},{reported:null,estimate:4,status:'completed'},{reported:null,estimate:null,status:'failed'},{reported:0,estimate:5,status:'completed'}] as CostEvent[]);
  expect(result).toEqual({reported:2,estimated:4,unknown:1,attempts:4,failed:1});
 });
 it('allocates overlapping shared bills once',()=>{
  expect(allocatedShared({period_start:'2026-10-01',period_end:'2026-10-10',amount_usd:100} as any,'2026-10-05T00:00:00Z','2026-10-07T00:00:00Z')).toBe(20);
 });
 it('uses gross margin, not markup',()=>{expect(priceForMargin(3,70)).toBeCloseTo(10);expect(priceForMargin(3,100)).toBeNull();});
});
