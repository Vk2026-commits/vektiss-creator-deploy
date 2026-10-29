import {it,expect} from 'vitest';
import {editorialCaptions} from '../src/domain/editorial-captions';
it('does not carry a phrase across a spoken pause or punctuation',()=>{
 const words=[{text:'Your',start:0,end:.2},{text:'skills.',start:.2,end:.6},{text:'Record',start:1,end:1.3},{text:'them',start:1.3,end:1.5},{text:'Next',start:2,end:2.2}];
 const phrases=editorialCaptions(words);
 expect(phrases.map(p=>p.text)).toEqual(['Your skills.','Record them','Next']);
 expect(phrases[0].end).toBe(.85);
 expect(phrases[1].end).toBe(1.75);
});
