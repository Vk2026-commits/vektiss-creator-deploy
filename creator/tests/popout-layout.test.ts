import {expect,it} from 'vitest';
import {popoutLayout as l,popoutBeatIndex} from '../src/domain/popout-layout';
it('reserves disjoint title, artwork and caption regions',()=>{
 expect(l.title.top+l.title.height).toBeLessThan(l.artwork.top);
 expect(l.artwork.top+l.artwork.height).toBeLessThanOrEqual(l.graphics.height);
 expect(l.graphics.height).toBeLessThan(l.captions.top);
 expect(l.captions.top+l.captions.height).toBeLessThan(1050);
});
it('uses the spoken beat at boundaries and holds the final beat through trailing silence',()=>{
 const beats=[{start:0,end:3},{start:3,end:5}];
 expect([0,2.99,3,5,6].map(t=>popoutBeatIndex(beats,t))).toEqual([0,0,1,1,1]);
});
