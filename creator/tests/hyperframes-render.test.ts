import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {renderTemplatePlan} from '../server/template-render';
import {mediaBinary} from '../server/media-binaries';
it.skipIf(process.env.CREATOR_HYPERFRAMES_QA!=='1')('exports both formats with original audio, caching and unchanged source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creator-hyperframes-'));
 try{
  const folder=join(root,'edit/template-plans');await mkdir(folder,{recursive:true});
  const fixture=join(folder,'fixture.mp4');
  execFileSync(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=c=blue:s=540x960:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',fixture]);
  const bytes=await readFile(fixture),revision=createHash('sha256').update(bytes).digest('hex'),id='b'.repeat(64);
  await writeFile(join(folder,revision+'.mp4'),bytes);
  await writeFile(join(folder,revision+'.source.json'),JSON.stringify({assetId:'00000000-0000-4000-8000-000000000001',revision,kind:'upload',duration:2,words:[{start:0,end:1,text:'Value'}]}));
  for(const [i,aspectRatio] of ['9:16','16:9'].entries()){
   const version=i+1;
   await writeFile(join(folder,id+'.json'),JSON.stringify({id,version,proposal:{version:1,rendererVersion:2,aspectRatio,templateId:'hyperframes-motion',sourceRevision:revision,beats:[{firstWord:0,lastWord:0,layout:'bottom-presenter',visual:'diagram',headline:'Create value',purpose:'Explain',illustration:'',motion:'',graphics:{nodes:[{label:'Solve a problem',shape:'box',x:50,y:50}],links:[]}}]}}));
   const request={id,version,mode:'final'};
   const result=await renderTemplatePlan(root,request);
   expect(result.duration).toBe(2);expect(await renderTemplatePlan(root,request)).toEqual(result);
   expect(await readFile(join(folder,revision+'.mp4'))).toEqual(bytes);
  }
 }finally{await rm(root,{recursive:true,force:true});}
},180000);
