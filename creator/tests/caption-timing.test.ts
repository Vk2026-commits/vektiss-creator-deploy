import {it,expect} from 'vitest';
import {captionWordAt} from '../src/domain/caption-timing';
const words=[{start:.2,end:.6},{start:.7,end:1},{start:2,end:2.3}];
it('holds captions through short inter-word gaps',()=>{expect(captionWordAt(words,.65)).toBe(0);expect(captionWordAt(words,.7)).toBe(1);});
it('clears during genuine silence and before speech',()=>{expect(captionWordAt(words,0)).toBe(-1);expect(captionWordAt(words,1.5)).toBe(-1);expect(captionWordAt([],2)).toBe(-1);});
it('is deterministic when seeking backwards',()=>{expect(captionWordAt(words,2.1)).toBe(2);expect(captionWordAt(words,.4)).toBe(0);});
