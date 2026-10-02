import {expect,it} from 'vitest';
import {automaticEnd,boundarySchema,sourceCutSchema} from '../src/domain/source-cut';
import {cutEndHeader,prepareMedia} from '../server/prepare-media';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mediaBinary} from '../server/media-binaries';
it('only auto-cuts a confident separate reaction within the source',()=>{
 const result={status:'separate' as const,end:56,confidence:'high' as const,reason:'Visual transition'};
 expect(automaticEnd(result,130)).toBe(56);
 for(const status of ['overlap','uncertain'] as const)expect(automaticEnd({...result,status},130)).toBeNull();
 expect(automaticEnd({...result,confidence:'low'},130)).toBeNull();
 expect(automaticEnd({...result,end:131},130)).toBeNull();
 expect(automaticEnd({...result,end:0},130)).toBeNull();
 expect(automaticEnd({...result,status:'none',end:null},130)).toBe(130);
});
it('validates saved clips and rejects unsafe cut headers',()=>{
 for(const bad of ['','NaN','Infinity','0','181',['56']])expect(()=>cutEndHeader(bad)).toThrow();
 expect(cutEndHeader('56.25')).toBe(56.25);expect(cutEndHeader(undefined)).toBeUndefined();
 expect(boundarySchema.safeParse({status:'separate',end:Infinity,confidence:'high',reason:''}).success).toBe(false);
 expect(sourceCutSchema.safeParse({original_id:'00000000-0000-4000-8000-000000000001',selected_id:'00000000-0000-4000-8000-000000000002',duration:10,end:11,reason:''}).success).toBe(false);
});
it('saves an actual trimmed video with audio, leaving the original unchanged',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'creator-cut-test-'));const exec=promisify(execFile);
 try{
  const input=join(dir,'original.mp4'),output=join(dir,'selected.mp4');
  await exec(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=c=blue:s=160x240:r=25:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-c:a','aac',input]);
  const original=await readFile(input);
  await prepareMedia((async function*(){yield original;})(),path=>copyFile(path,output),1.2);
  const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',output])).stdout);
  expect(Number(probe.format.duration)).toBeCloseTo(1.2,1);expect(probe.streams.some((s:{codec_type:string})=>s.codec_type==='audio')).toBe(true);
  expect(await readFile(input)).toEqual(original);
  await expect(prepareMedia((async function*(){yield original;})(),path=>copyFile(path,output),4)).rejects.toThrow('VIDEO_LENGTH');
 }finally{await rm(dir,{recursive:true,force:true});}
},30000);
