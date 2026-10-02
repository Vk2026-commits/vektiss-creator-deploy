import {it,expect} from 'vitest';
import {extractVideoFrames,frameTimesHeader} from '../server/video-frames';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mediaBinary} from '../server/media-binaries';
import {createReadStream} from 'node:fs';
it('bounds, sorts and validates refinement timestamps',()=>{
 expect(frameTimesHeader('[2,1,2]')).toEqual([1,2]);expect(frameTimesHeader(undefined)).toBeUndefined();
 for(const invalid of ['[]','[-1]','[181]','["1"]','null','{}',JSON.stringify(Array(65).fill(1))])expect(()=>frameTimesHeader(invalid)).toThrow();
});
it('extracts timestamped JPEGs and duration without a browser, including a silent clip',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'creator-frames-test-'));
 try{
  const path=join(dir,'sample.mp4');
  await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=s=160x240:r=25:d=1','-c:v','libx264',path]);
  const blob=await readFile(path);const input=()=> (async function*(){yield blob;})();
  const result=await extractVideoFrames(input());expect(result.duration).toBe(1);expect(result.frames.length).toBeGreaterThanOrEqual(2);
  expect(result.frames.every(f=>f.time>=0&&f.time<1&&f.image.startsWith('data:image/jpeg;base64,/9j/'))).toBe(true);
  const refined=await extractVideoFrames(input(),[.25,.5]);expect(refined.frames.map(f=>f.time)).toEqual([.25,.5]);
  await expect(extractVideoFrames(input(),[2])).rejects.toThrow('outside');
  const tailPath=join(dir,'audio-tail.mp4');
  await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-i',path,'-f','lavfi','-i','sine=frequency=440:duration=1.2','-c:v','copy','-c:a','aac',tailPath]);
  const tail=await extractVideoFrames(createReadStream(tailPath));
  expect(tail.duration).toBeGreaterThan(1);expect(tail.frames.every(f=>f.time<1)).toBe(true);
 }finally{await rm(dir,{recursive:true,force:true});}
},30000);
it.runIf(Boolean(process.env.FRAME_SOURCE))('reads the supplied reaction example through the server extractor',async()=>{
 const result=await extractVideoFrames(createReadStream(process.env.FRAME_SOURCE!));
 expect(result.duration).toBeGreaterThan(1);expect(result.frames.length).toBeGreaterThan(10);expect(result.frames.length).toBeLessThanOrEqual(64);
 console.log('Server example extraction verified',{duration:result.duration,frames:result.frames.length});
},120000);
