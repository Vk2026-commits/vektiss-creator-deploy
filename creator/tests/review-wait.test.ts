import {expect,it} from 'vitest';
import {reviewWaitExpired,contentReviewRecovery} from '../src/domain/review-wait';
it('bounds review waiting at three minutes',()=>{
 const start='2026-10-20T20:00:00Z',time=Date.parse(start);
 expect(reviewWaitExpired(start,time+179999)).toBe(false);
 expect(reviewWaitExpired(start,time+180000)).toBe(true);
 expect(reviewWaitExpired(start,time+600000)).toBe(true);
 expect(reviewWaitExpired(null,time)).toBe(false);
});

it('continues past one failed batch but bounds further provider failures',()=>{
 expect(contentReviewRecovery(undefined,'incomplete')).toEqual({failures:1,limited:false});
 expect(contentReviewRecovery(1,'completed')).toEqual({failures:1,limited:false});
 expect(contentReviewRecovery(1,'failed')).toEqual({failures:2,limited:true});
});
