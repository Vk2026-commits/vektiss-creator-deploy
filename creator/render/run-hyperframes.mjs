import {readFile,writeFile,mkdtemp,copyFile,rm,stat} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const progress=(stage,percent)=>process.stdout.write(JSON.stringify({stage,...(Number.isFinite(percent)?{percent}: {})})+'\n');
async function tracked(file,args,options,onLine){
 const run=exec(file,args,options);let pending='';
 run.child.stdout?.on('data',chunk=>{pending+=String(chunk);const lines=pending.split('\n');pending=lines.pop()??'';for(const line of lines)onLine(line);});
 return await run;
}
const job=JSON.parse(await readFile(process.argv[2],'utf8'));
// HTML is created by the trusted server factory, never supplied by a user or model.
const folder=await mkdtemp(join(dirname(process.argv[2]),'hyperframes-'));
try{
 await copyFile(job.sourceFile,join(folder,'source.mp4'));
 if(['paper-cutout','popout-explainer'].includes(job.proposal?.templateId)){
  // Source paths are assigned by the server after ownership and revision checks.
  // Keep the expensive matte across retries and brand/style changes.
  const popout=job.proposal.templateId==='popout-explainer';
  const matte=job.sourceFile+(popout?'.presenter-clean-v1.webm':'.presenter-v2.webm');
  let cached=false;try{cached=(await stat(matte)).size>0;}catch{}
  if(!cached){progress('separating',0);await tracked(process.env.CREATOR_PYTHON??'python3',[resolve('render/prepare-presenter-matte.py'),job.sourceFile,matte,...(popout?['--no-outline']:[])],{timeout:1200000,maxBuffer:1024*1024},line=>{try{const p=JSON.parse(line);if(p.stage==='presenter-matte'&&p.duration>0)progress('separating',100*p.seconds/p.duration);}catch{}});}
  await copyFile(matte,join(folder,'presenter.webm'));
 }
 await writeFile(join(folder,'index.html'),job.html,{mode:0o600});
 const rendered=join(folder,'rendered.mp4');
 const env={PATH:process.env.PATH,HOME:folder,DO_NOT_TRACK:'1',HYPERFRAMES_NO_TELEMETRY:'1',HYPERFRAMES_BROWSER_PATH:process.env.CREATOR_CHROMIUM_PATH};
 progress('rendering',0);
 await tracked(process.execPath,[process.env.CREATOR_HYPERFRAMES_CLI??resolve('node_modules/hyperframes/bin/hyperframes.mjs'),'render',folder,'--quality',job.preview?'draft':'delivery','--workers','1','--experimental-fast-capture=false','--no-browser-gpu','--output',rendered],{env,timeout:1100000,maxBuffer:8*1024*1024},line=>{if(line.startsWith('@hf-progress ')){try{progress('rendering',JSON.parse(line.slice(13)).pct);}catch{}}else{const match=line.replace(/\x1b\[[0-9;]*m/g,'').match(/(?:^|\s)(\d{1,3})%/);if(match)progress('rendering',Number(match[1]));}});
 progress('finishing');
 const ffmpeg=process.env.CREATOR_MEDIA_BIN?join(process.env.CREATOR_MEDIA_BIN,'ffmpeg'):'ffmpeg';
 await exec(ffmpeg,['-v','error','-y','-i',rendered,'-an',...(job.preview?['-vf','scale=iw/2:ih/2','-c:v','libx264','-crf','26']:['-c:v','copy']),'-movflags','+faststart',job.output],{timeout:120000,maxBuffer:1024*1024});
}finally{await rm(folder,{recursive:true,force:true});}
