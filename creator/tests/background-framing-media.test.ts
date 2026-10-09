import {it,expect} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {backgroundFilter,fillBackground} from '../src/domain/background-framing';
import {mediaBinary} from '../server/media-binaries';
it('exports filled pixels edge to edge without side bars at every zoom and position',async()=>{
 for(const framing of [fillBackground,{...fillBackground,zoom:1.65,x:1,y:1}]){
  const result=await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=red:s=100x300','-vf',backgroundFilter(180,320,framing),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{encoding:'buffer',maxBuffer:1024*1024});
  expect(result.stdout.length).toBe(180*320*3);
  for(const i of [0,179,180*319,180*320-1]){expect(result.stdout[i*3]).toBeGreaterThan(240);expect(result.stdout[i*3+1]).toBeLessThan(10);}
 }
});
