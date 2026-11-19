import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {renderTemplatePlan} from '../server/template-render';
import {mediaBinary} from '../server/media-binaries';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
it.skipIf(process.env.CREATOR_HYPERFRAMES_QA!=='1')('renders reduced capture and quick cuts with audio; keeps final full size',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creator-quick-preview-'));
 try{
 const folder=join(root,'edit/template-plans');await mkdir(folder,{recursive:true});
 const fixture=join(folder,'fixture.mp4');
 execFileSync(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=s=540x960:r=30:d=12','-f','lavfi','-i','sine=frequency=440:duration=12','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest',fixture]);
 const bytes=await readFile(fixture),revision=createHash('sha256').update(bytes).digest('hex'),id='c'.repeat(64);
 await writeFile(join(folder,revision+'.mp4'),bytes);
 const source={...templateSampleSource,revision,duration:12,words:'Solve needs S tier Build skills A tier Chase trends F tier'.split(' ').map((text,i)=>({text,start:i,end:i+1}))};
 await writeFile(join(folder,revision+'.source.json'),JSON.stringify(source));
 const proposal=templateSample('tier-list');proposal.beats[0].lastWord=11;proposal.beats[0].graphics!.nodes.forEach((n,i)=>{n.label=['Solve needs','Build skills','Chase trends'][i];n.revealWord=i*4+2;});
 await writeFile(join(folder,id+'.json'),JSON.stringify({id,version:1,proposal:{...proposal,sourceRevision:revision,aspectRatio:'9:16'}}));
 for(const request of [{id,version:1,mode:'preview',previewScope:'quick'},{id,version:1,mode:'preview'},{id,version:1,mode:'final'}]){
 const started=Date.now();const result=await renderTemplatePlan(root,request);console.log(request,'elapsed',Date.now()-started,'duration',result.duration);
 expect(result.duration).toBeCloseTo(request.previewScope==='quick'?7:12);
 const output=join(root,request.mode==='preview'?'edit/template-previews':'edit/compositions',result.id+'.mp4');
 const probe=JSON.parse(execFileSync(mediaBinary('ffprobe'),['-v','error','-show_streams','-of','json',output],{encoding:'utf8'}));
 expect(probe.streams.find((s:any)=>s.codec_type==='video').width).toBe(request.mode==='preview'?540:1080);
 expect(probe.streams.some((s:any)=>s.codec_type==='audio')).toBe(true);
 expect(await renderTemplatePlan(root,request)).toEqual(result);
 }
 expect(await readFile(join(folder,revision+'.mp4'))).toEqual(bytes);
 }finally{await rm(root,{recursive:true,force:true});}
},300000);
