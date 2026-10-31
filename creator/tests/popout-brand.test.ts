import {expect,it} from 'vitest';
import {popoutBrand} from '../src/domain/popout-brand';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {popoutLayout} from '../src/domain/popout-layout';
it('locks a light canvas and readable ink without changing stored defaults',()=>{
 const input={...defaultEditBrand,background:'#000000',text:'#FFFFFF',primary:'#FF2600'};
 const result=popoutBrand(input);
 expect(result.background).toBe('#FFFFFF');expect(result.text).toBe('#171717');expect(input.background).toBe('#000000');expect(result.primary).not.toBe('#FF2600');
});
it('reserves clearance above every presenter frame for captions and motion',()=>{
 expect(popoutLayout.presenter.top-8).toBeGreaterThan(popoutLayout.captions.top+popoutLayout.captions.height);
});
