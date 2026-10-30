import {it,expect} from 'vitest';
import {popoutPresenterMotion} from '../src/domain/popout-motion';
it('enters, holds and exits at scene boundaries without restarting footage',()=>{
 expect(popoutPresenterMotion(0,0,4).opacity).toBe(0);
 expect(popoutPresenterMotion(.4,0,4)).toEqual({opacity:1,translateY:0,scale:1});
 expect(popoutPresenterMotion(3.8,0,4).translateY).toBeGreaterThan(0);
 expect(popoutPresenterMotion(4,0,4).opacity).toBe(0);
 expect(popoutPresenterMotion(2,0,4)).toEqual(popoutPresenterMotion(2,0,4));
});
