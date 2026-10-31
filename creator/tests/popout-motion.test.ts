import {it,expect} from 'vitest';
import {popoutPresenterMotion} from '../src/domain/popout-motion';
it('keeps the presenter visible and continuous through every scene boundary',()=>{
 for(const t of [0,3.8,3.99,4,4.01,7,32]){
  const a=popoutPresenterMotion(t,0,4),b=popoutPresenterMotion(t,4,8);
  expect(a).toEqual(b);expect(a.opacity).toBe(1);expect(Math.abs(a.translateY)).toBeLessThanOrEqual(8);expect(a.scale).toBeGreaterThan(.99);
 }
});
