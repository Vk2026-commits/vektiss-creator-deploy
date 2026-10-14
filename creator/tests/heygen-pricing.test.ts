import {it,expect} from 'vitest';
import {heygenPrice} from '../src/domain/heygen-pricing';
it('prices each published avatar category by seconds',()=>{
 expect(heygenPrice('avatar_iv','photo_avatar',60)).toBe(2.31);
 expect(heygenPrice('avatar_iv','digital_twin',30)).toBe(2.415);
 expect(heygenPrice('avatar_v','digital_twin',60)).toBe(7.2);
 expect(heygenPrice('avatar_iii','studio_avatar',60)).toBe(.99);
 expect(heygenPrice('avatar_v','photo_avatar',60)).toBeNull();
 expect(heygenPrice('avatar_iv','photo_avatar',NaN)).toBeNull();
});
