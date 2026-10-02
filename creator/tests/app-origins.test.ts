import {describe,it,expect} from 'vitest';
import {isAllowedAppOrigin} from '../supabase/functions/_shared/app-origins';
describe('Creator exact origin allowlist',()=>{
 it('preserves local access and permits the specific hosted origin',()=>{
  const primary='http://127.0.0.1:5178', hosted='https://mc-zdnmms5ls0.bunny.run';
  expect(isAllowedAppOrigin(primary,primary,hosted)).toBe(true);
  expect(isAllowedAppOrigin(hosted,primary,hosted)).toBe(true);
  for(const bad of ['https://other.bunny.run',hosted+'.evil.test','null',hosted+'/'])expect(isAllowedAppOrigin(bad,primary,hosted)).toBe(false);
 });
 it('fails closed with missing configuration',()=>expect(isAllowedAppOrigin('https://example.com',undefined)).toBe(false));
});
