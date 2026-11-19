import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {renderTemplatePlan} from '../server/template-render';
import {mediaBinary} from '../server/media-binaries';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
it.skipIf(process.env.CREATOR_EXPORT_BENCH!=='1')('compares single and parallel exports across ranking reveal boundaries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creator-export-bench-')),old=process.env.CREATOR_RANKING_RENDER_WORKERS;
 try{
 const folder=join(root,'edit/template-plans');await mkdir(folder,{recursive:true});
 const fixture=join(folder,'fixture.mp4');
 execFileSync(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=s=540x960:r=30:d=24','-f','lavfi','-i','sine=frequency=440:duration=24','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest',fixture]);
 const bytes=await readFile(fixture),revision=createHash('sha256').update(bytes).digest('hex'),id='d'.repeat(64);
 await writeFile(join(folder,revision+'.mp4'),bytes);
 const source={...templateSampleSource,revision,duration:24,words:'Solve needs S tier Build skills A tier Chase trends F tier'.split(' ').map((text,i)=>({text,start:i*2,end:(i+1)*2}))};
 await writeFile(join(folder,revision+'.source.json'),JSON.stringify(source));
 const proposal=templateSample('tier-list');proposal.beats[0].lastWord=11;proposal.beats[0].graphics!.nodes.forEach((n,i)=>{n.label=['Solve needs','Build skills','Chase trends'][i];n.revealWord=i*4+2;});
 const outputs:string[]=[];
 for(const workers of [1,2]){
 process.env.CREATOR_RANKING_RENDER_WORKERS=String(workers);
 await writeFile(join(folder,id+'.json'),JSON.stringify({id,version:workers,proposal:{...proposal,sourceRevision:revision,aspectRatio:'9:16'}}));
 const started=Date.now();const result=await renderTemplatePlan(root,{id,version:workers,mode:'final'});console.log(JSON.stringify({workers,elapsedMs:Date.now()-started,duration:result.duration}));
 const output=join(root,'edit/compositions',result.id+'.mp4');outputs.push(output);
 const probe=JSON.parse(execFileSync(mediaBinary('ffprobe'),['-v','error','-show_streams','-of','json',output],{encoding:'utf8'}));
 const video=probe.streams.find((s:any)=>s.codec_type==='video');expect(video.width).toBe(1080);expect(video.height).toBe(1920);expect(Number(video.nb_frames)).toBe(720);
 expect(probe.streams.some((s:any)=>s.codec_type==='audio')).toBe(true);
 }
 const compared=spawnSync(mediaBinary('ffmpeg'),['-i',outputs[0],'-i',outputs[1],'-lavfi','ssim','-an','-f','null','-'],{encoding:'utf8'});
 expect(compared.status).toBe(0);const ssim=Number(compared.stderr.match(/All:([0-9.]+)/)?.[1]);expect(ssim).toBeGreaterThan(.99);console.log('FRAME_SSIM',ssim);
 const audio=outputs.map(output=>execFileSync(mediaBinary('ffmpeg'),['-v','error','-i',output,'-map','0:a:0','-c:a','pcm_s16le','-f','hash','-hash','sha256','-'],{encoding:'utf8'}));
 expect(audio[0]).toBe(audio[1]);
 expect(await readFile(join(folder,revision+'.mp4'))).toEqual(bytes);
 console.log('BENCH_OUTPUT',root);
 }finally{if(old===undefined)delete process.env.CREATOR_RANKING_RENDER_WORKERS;else process.env.CREATOR_RANKING_RENDER_WORKERS=old;if(process.env.CREATOR_KEEP_BENCH!=='1')await rm(root,{recursive:true,force:true});}
},300000);
