import {expect,it} from 'vitest';
import {resolveEditStyle} from '../src/domain/edit-style';
it('resolves video over campaign over creator and records the origin without mutating defaults',()=>{
 const creator={primary:'#671816',fontFamily:'Georgia' as const};
 const a=resolveEditStyle(creator,{primary:'#00AA11'},{primary:'#AA0000'});
 expect(a.brand.primary).toBe('#AA0000');expect(a.origins.primary).toBe('video');
 expect(a.brand.fontFamily).toBe('Georgia');expect(a.origins.fontFamily).toBe('creator');
 expect(a.origins.background).toBe('fallback');expect(creator.primary).toBe('#671816');
 expect(resolveEditStyle({primary:'#111111'}).brand.primary).toBe('#111111');
 expect(resolveEditStyle().brand.primary).toBe('#1688FF');
});
it('rejects unsafe style values',()=>{
 expect(()=>resolveEditStyle({primary:'url(secret)'})).toThrow();
});
