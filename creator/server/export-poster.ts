import {readFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mediaBinary} from './media-binaries';
const pending=new Map<string,Promise<Buffer>>();
export async function exportPoster(root:string,id:string):Promise<Buffer>{
 if(!/^(?:[a-f0-9-]{36}|[a-f0-9]{64})$/.test(id))throw Error('Invalid export');
 const folder=resolve(root,'edit/compositions'),file=resolve(folder,`${id}.poster.jpg`);
 try{return await readFile(file);}catch{/* Older exports receive a poster on demand. */}
 const existing=pending.get(file);if(existing)return existing;
 const task=(async()=>{
  const temp=resolve(folder,`${id}.${randomUUID()}.jpg`);
  try{
   await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-ss','0','-i',resolve(folder,`${id}.mp4`),'-frames:v','1','-vf','scale=480:-2','-q:v','3',temp],{timeout:15000,maxBuffer:1024*1024});
   await rename(temp,file);return await readFile(file);
  }finally{await unlink(temp).catch(()=>{});}
 })();
 pending.set(file,task);try{return await task;}finally{pending.delete(file);}
}
