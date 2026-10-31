import {expect,it} from 'vitest';
import {popoutBrand} from '../src/domain/popout-brand';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {popoutLayout} from '../src/domain/popout-layout';
it('preserves dark brand backgrounds with readable white text',()=>{
 const input={...defaultEditBrand,background:'#000000',text:'#FFFFFF',primary:'#FF2600'};
 const result=popoutBrand(input);
 expect(result.background).toBe('#000000');expect(result.text).toBe('#FFFFFF');expect(input.background).toBe('#000000');expect(result.primary).toBe('#FF2600');
});
it('reserves clearance above every presenter frame for captions and motion',()=>{
 expect(popoutLayout.presenter.top-8).toBeGreaterThan(popoutLayout.captions.top+popoutLayout.captions.height);
});
