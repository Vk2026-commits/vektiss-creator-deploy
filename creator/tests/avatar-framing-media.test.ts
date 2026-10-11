import {it,expect} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {avatarFramingCrop} from '../src/domain/avatar-framing';
import {mediaBinary} from '../server/media-binaries';

it('exports only the upper crop, removing lower-body pixels without stretching',async()=>{
 const base={x:20,y:40,width:100,height:200};
 const crop=avatarFramingCrop(base,'head-shoulders',undefined);
 const result=await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=black:s=160x300,drawbox=x=20:y=40:w=100:h=110:color=red:t=fill,drawbox=x=20:y=150:w=100:h=90:color=blue:t=fill','-vf',`format=rgba,crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=100:110`,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{encoding:'buffer',maxBuffer:1024*1024});
 expect(result.stdout.length).toBe(100*110*3);
 for(const pixel of [0,99,100*109,100*110-1]){
  expect(result.stdout[pixel*3]).toBeGreaterThan(240);
  expect(result.stdout[pixel*3+2]).toBeLessThan(10);
 }
});
