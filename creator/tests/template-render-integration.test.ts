import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {renderTemplatePlan} from '../server/template-render';
import {mediaBinary} from '../server/media-binaries';
it.skipIf(process.env.CREATOR_RENDER_QA!=='1')('renders a private synthetic preview with original audio and reuses it without rendering again',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'creator-render-integration-'));
 try{
  const folder=resolve(root,'edit/template-plans');await mkdir(folder,{recursive:true});
  const file=resolve(folder,'fixture.mp4');
  execFileSync(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=c=0x20384e:s=540x960:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  const bytes=await readFile(file),revision=createHash('sha256').update(bytes).digest('hex'),id='a'.repeat(64);
  await writeFile(resolve(folder,`${revision}.mp4`),bytes);
  await writeFile(resolve(folder,`${revision}.source.json`),JSON.stringify({assetId:'00000000-0000-4000-8000-000000000001',revision,kind:'upload',duration:2,words:[{start:0,end:1,text:'Value.'}]}));
  await writeFile(resolve(folder,`${id}.json`),JSON.stringify({id,version:1,proposal:{version:1,sourceRevision:revision,templateId:'premium-explainer',beats:[{firstWord:0,lastWord:0,layout:'presenter',visual:'diagram',headline:'Value',purpose:'Show value',illustration:'A useful solution',motion:'Reveal',graphics:{nodes:[{label:'Useful solution',shape:'box',x:50,y:50}],links:[]}}]}}));
  const input={id,version:1,mode:'preview'};
  const result=await renderTemplatePlan(root,input);
  expect(result.duration).toBe(2);expect(await renderTemplatePlan(root,input)).toEqual(result);
  expect((await readFile(resolve(root,'edit/template-previews',`${result.id}.mp4`))).length).toBeGreaterThan(1000);
  expect(await readFile(resolve(folder,`${revision}.mp4`))).toEqual(bytes);
  expect(JSON.parse(await readFile(resolve(folder,`${id}.preview.json`),'utf8')).version).toBe(1);
  const originalPlan=JSON.parse(await readFile(resolve(folder,`${id}.json`),'utf8'));
  const frameHashes=new Set<string>();
  for(const [index,captionStyle] of ['highlight','clean','bold','none'].entries()){
   const version=index+2;
   await writeFile(resolve(folder,`${id}.json`),JSON.stringify({...originalPlan,version,brand:{primary:'#A82958',background:'#FFF8EE',text:'#202030',captionStyle}}));
   const styled=await renderTemplatePlan(root,{id,version,mode:'preview'});
   expect(styled.id).not.toBe(result.id);
   const frame=resolve(root,`${captionStyle}.png`);
   execFileSync(mediaBinary('ffmpeg'),['-v','error','-ss','0.5','-i',resolve(root,'edit/template-previews',`${styled.id}.mp4`),'-frames:v','1',frame]);
   frameHashes.add(createHash('sha256').update(await readFile(frame)).digest('hex'));
   if(process.env.CREATOR_RENDER_QA_STILLS)await writeFile(resolve(process.env.CREATOR_RENDER_QA_STILLS,`${captionStyle}.png`),await readFile(frame));
  }
  expect(frameHashes.size).toBe(4);
 }finally{await rm(root,{recursive:true,force:true});}
},300000);
