import {it,expect} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mediaBinary} from '../server/media-binaries';
import {endingAudioFilter,endingVideoFilter} from '../server/narration-ending';

it('preserves the last audio samples and holds a shorter picture through one second of silence',async()=>{
 const result=await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=red:s=32x32:r=25:d=1.8','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=2','-filter_complex',`[0:v]null${endingVideoFilter(2,1)}[v];[1:a]${endingAudioFilter(3)}[a]`,'-map','[v]','-t','3','-f','null','-','-map','[a]','-t','3','-f','f32le','-acodec','pcm_f32le','pipe:1'],{encoding:'buffer',maxBuffer:3*1024*1024});
 const floats=new Float32Array(result.stdout.buffer,result.stdout.byteOffset,result.stdout.length/4);
 expect(floats.length).toBe(3*48000*2);
 const peak=(start:number,end:number)=>{let max=0;for(let i=Math.floor(start*96000);i<Math.floor(end*96000);i++)max=Math.max(max,Math.abs(floats[i]));return max;};
 expect(peak(1.95,1.999)).toBeGreaterThan(.05);
 expect(peak(2.01,2.99)).toBe(0);
},30000);
