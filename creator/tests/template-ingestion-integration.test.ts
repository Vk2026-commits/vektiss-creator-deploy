import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {templateEdit} from '../server/template-edit';
import {mediaBinary} from '../server/media-binaries';
afterEach(()=>vi.unstubAllGlobals());
it.skipIf(process.env.CREATOR_MEDIA_QA!=='1')('ingests real media, retains speech after planner failure, and retries without another transcription',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'creator-ingestion-'));
 try{
  const file=resolve(root,'source.mp4');
  execFileSync(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=c=blue:s=160x240:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  let transcriptions=0,plans=0;
  const request=vi.fn(async(url:string,init?:RequestInit)=>{
   if(url.includes('/rest/v1/'))return new Response('[{"id":"owned"}]');
   const body=init!.body as FormData;
   if(body.get('action')==='story-alignment'){
    transcriptions++;
    return Response.json({words:[{word:'Create',start:0,end:.4},{word:'value',start:.39,end:.39}]});
   }
   plans++;
   if(plans===1)return new Response('{}',{status:503});
   const source=JSON.parse(String(body.get('source')));
   return Response.json({proposal:{version:1,sourceRevision:source.revision,templateId:'walkthrough',beats:[{firstWord:0,lastWord:1,layout:'presenter',visual:'typography',headline:'Value',purpose:'Show the spoken idea',illustration:'Value',motion:'Reveal'}]}});
  });
  vi.stubGlobal('fetch',request);
  const options={profileId:'00000000-0000-4000-8000-000000000001',template:'walkthrough'};
  const config={supabaseUrl:'https://example.invalid',publicKey:'public'};
  await expect(templateEdit(root,file,'video/mp4',options,'Bearer test',config)).rejects.toThrow('edit plan could not finish');
  const result=await templateEdit(root,file,'video/mp4',options,'Bearer test',config);
  expect(result.storyboard[0].spokenText).toBe('Create value');
  expect(transcriptions).toBe(1);expect(plans).toBe(2);
  const saved=await templateEdit(root,file,'video/mp4',options,'Bearer test',config);
  expect(saved.id).toBe(result.id);expect(plans).toBe(2);
  expect((await readFile(file)).length).toBeGreaterThan(1000);
 }finally{await rm(root,{recursive:true,force:true});}
},30000);
