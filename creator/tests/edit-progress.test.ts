import {expect,it} from 'vitest';
import {parseEditProgress} from '../src/domain/edit-progress';
it('accepts measured stage progress and clamps percentages',()=>{
 expect(parseEditProgress('{"stage":"separating","percent":42.8}')).toEqual({stage:'separating',percent:42});
 expect(parseEditProgress('{"stage":"rendering","percent":101}')).toEqual({stage:'rendering',percent:100});
 expect(parseEditProgress('{"stage":"finishing"}')).toEqual({stage:'finishing'});
});
it('ignores unrelated renderer output and unknown stages',()=>{
 expect(parseEditProgress('starting chromium')).toBeNull();
 expect(parseEditProgress('{"stage":"secret","percent":50}')).toBeNull();
 expect(parseEditProgress('{"stage":"rendering","percent":"50"}')).toEqual({stage:'rendering'});
});
