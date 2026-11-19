import {it,expect} from 'vitest';
import {rankingFlight} from '../src/domain/ranking-flight';
it('pops at the label, waits for the rating, travels visibly, and stays landed',()=>{
 expect(rankingFlight(.9,1,2).visible).toBe(false);
 expect(rankingFlight(1.24,1,2)).toMatchObject({visible:true,pop:1,travel:0});
 expect(rankingFlight(2.425,1,2).travel).toBeCloseTo(.5);
 expect(rankingFlight(3,1,2)).toMatchObject({travel:1,landed:true});
 expect(rankingFlight(100,1,2)).toEqual(rankingFlight(3,1,2));
});
it('allows a visible pop for a first-word rating, and deterministic backwards seeks',()=>{
 expect(rankingFlight(0,0,0).travel).toBe(0);
 expect(rankingFlight(.2,0,0).pop).toBeGreaterThan(.9);
 const before=rankingFlight(.7,0,0);rankingFlight(20,0,0);expect(rankingFlight(.7,0,0)).toEqual(before);
 expect(rankingFlight(1,-1,2).visible).toBe(false);
});
