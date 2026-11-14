import {describe,it,expect} from 'vitest';
import {providerLimitCode} from '../src/domain/provider-limit';
describe('provider billing versus temporary limits',()=>{
 it.each(['insufficient_quota','credit_balance_exhausted'])('identifies billing exhaustion: %s',code=>expect(providerLimitCode(code)).toBe('PROVIDER_QUOTA'));
 it.each(['rate_limit_exceeded',undefined,null])('preserves temporary or unknown 429 handling',code=>expect(providerLimitCode(code)).toBe('PROVIDER_RATE_LIMIT'));
});
