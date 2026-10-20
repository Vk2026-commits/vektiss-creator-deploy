import {expect,it} from 'vitest';
import {providerText} from '../src/domain/provider-text';
it('keeps caption truncation safe for JSONB at every emoji boundary',()=>{
 for(const limit of [300,1200,5000]){
  expect(providerText('x'.repeat(limit-1)+'😀 caption',limit)).toBe('x'.repeat(limit-1));
  expect(providerText('x'.repeat(limit-2)+'😀 caption',limit)).toBe('x'.repeat(limit-2)+'😀');
 }
});
it('removes unsupported provider characters without losing valid emoji',()=>{
 expect(providerText('a\u0000b\ud800c\udfff😀',100)).toBe('abc😀');
});
