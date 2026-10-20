import {expect,it} from 'vitest';
import {reviewWaitExpired} from '../src/domain/review-wait';
it('bounds review waiting at three minutes',()=>{
 const start='2026-10-20T20:00:00Z',time=Date.parse(start);
 expect(reviewWaitExpired(start,time+179999)).toBe(false);
 expect(reviewWaitExpired(start,time+180000)).toBe(true);
 expect(reviewWaitExpired(start,time+600000)).toBe(true);
 expect(reviewWaitExpired(null,time)).toBe(false);
});
