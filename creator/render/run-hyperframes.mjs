import {readFile,writeFile,mkdtemp,copyFile,rm,stat} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const job=JSON.parse(await readFile(process.argv[2],'utf8'));
// HTML is created by the trusted server factory, never supplied by a user or model.
const folder=await mkdtemp(join(dirname(process.argv[2]),'hyperframes-'));
try{
 await copyFile(job.sourceFile,join(folder,'source.mp4'));
 if(job.proposal?.templateId==='paper-cutout'){
  // Source paths are assigned by the server after ownership and revision checks.
  // Keep the expensive matte across retries and brand/style changes.
  const matte=job.sourceFile+'.presenter-v2.webm';
  let cached=false;try{cached=(await stat(matte)).size>0;}catch{}
  if(!cached)await exec(process.env.CREATOR_PYTHON??'python3',[resolve('render/prepare-presenter-matte.py'),job.sourceFile,matte],{timeout:1200000,maxBuffer:1024*1024});
  await copyFile(matte,join(folder,'presenter.webm'));
 }
 await writeFile(join(folder,'index.html'),job.html,{mode:0o600});
 const rendered=join(folder,'rendered.mp4');
 const env={PATH:process.env.PATH,HOME:folder,DO_NOT_TRACK:'1',HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_BROWSER_PATH:process.env.CREATOR_CHROMIUM_PATH};
 await exec(process.execPath,[process.env.CREATOR_HYPERFRAMES_CLI??resolve('node_modules/hyperframes/bin/hyperframes.mjs'),'render',folder,'--quality',job.preview?'draft':'delivery','--workers','1','--experimental-fast-capture=false','--no-browser-gpu','--output',rendered],{env,timeout:1100000,maxBuffer:2*1024*1024});
 const ffmpeg=process.env.CREATOR_MEDIA_BIN?join(process.env.CREATOR_MEDIA_BIN,'ffmpeg'):'ffmpeg';
 await exec(ffmpeg,['-v','error','-y','-i',rendered,'-an',...(job.preview?['-vf','scale=iw/2:ih/2','-c:v','libx264','-crf','26']:['-c:v','copy']),'-movflags','+faststart',job.output],{timeout:120000,maxBuffer:1024*1024});
}finally{await rm(folder,{recursive:true,force:true});}
