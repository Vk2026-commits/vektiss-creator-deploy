import {mkdtemp,open,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mediaBinary} from './media-binaries';
export const SOURCE_MAX_BYTES=500*1024*1024;
export const SOURCE_MAX_SECONDS=180;
const exec=promisify(execFile);
export async function prepareMedia(source:AsyncIterable<Uint8Array>,preserve?:(path:string)=>Promise<void>){
 const dir=await mkdtemp(join(tmpdir(),'creator-media-'));
 try{
  const input=join(dir,'source'),output=join(dir,'analysis.mp4');
  const file=await open(input,'wx',0o600);let bytes=0;
  try{for await(const chunk of source){bytes+=chunk.length;if(bytes>SOURCE_MAX_BYTES)throw Error('VIDEO_SIZE');await file.writeFile(chunk);}}finally{await file.close();}
  if(!bytes)throw Error('VIDEO_FORMAT');
  const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-protocol_whitelist','file,pipe','-show_format','-show_streams','-of','json',input],{timeout:30000,maxBuffer:1024*1024})).stdout);
  const duration=Number(probe.format?.duration);
  if(!Number.isFinite(duration)||duration<=0||duration>SOURCE_MAX_SECONDS||probe.streams.some((s:{duration?:string})=>Number(s.duration)>SOURCE_MAX_SECONDS))throw Error('VIDEO_LENGTH');
  if(!probe.streams.some((s:{codec_type:string})=>s.codec_type==='video'))throw Error('VIDEO_FORMAT');
  if(preserve){await preserve(input);return {body:Buffer.alloc(0),type:'video/mp4'};}
  await exec(mediaBinary('ffmpeg'),['-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-i',input,'-map','0:v:0','-map','0:a:0?','-vf','scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=15','-c:v','libx264','-preset','veryfast','-b:v','280k','-maxrate','280k','-bufsize','560k','-pix_fmt','yuv420p','-c:a','aac','-b:a','48k','-ac','1','-movflags','+faststart','-threads','2',output],{timeout:300000,maxBuffer:1024*1024});
  if((await stat(output)).size>10*1024*1024)throw Error('VIDEO_FORMAT');
  return {body:await readFile(output),type:'video/mp4'};
 }finally{await rm(dir,{recursive:true,force:true});}
}
