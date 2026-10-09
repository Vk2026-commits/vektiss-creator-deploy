import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {publicResource} from './public-network';
import {mediaBinary} from './media-binaries';
import {alphaBounds} from './full-composition';
const exec=promisify(execFile);
const inFlight=new Map<string,Promise<unknown>>();
export const VERIFICATION_VERSION=1;
export function validateVerificationJob(job:any,id:string,userId:string){
 if(job.id!==id||job.user_id!==userId||job.status!=='completed'||job.snapshot?.scope!=='test'||!job.video_url)throw Error('Complete a short avatar test first.');
}
export function validateAlphaStream(stream:any,duration:number){
 if(stream?.codec_name!=='vp9'||String(stream.tags?.alpha_mode??stream.tags?.ALPHA_MODE)!=='1')throw Error('This avatar video has no transparent background. Choose another look.');
 if(!Number.isFinite(duration)||duration<=0||duration>60)throw Error('The short test has an unsupported duration.');
 if(!Number.isInteger(stream.width)||!Number.isInteger(stream.height)||stream.width<32||stream.height<32||stream.width>2048||stream.height>2048)throw Error('Unsupported test video dimensions.');
}
export function validateAlphaSamples(bytes:Uint8Array){
 const size=64,frameSize=size*size;
 if(!bytes.length||bytes.length%frameSize)throw Error('Could not inspect the avatar background. Retry verification.');
 for(let offset=0;offset<bytes.length;offset+=frameSize){
  let minX=size,minY=size,maxX=-1,maxY=-1,filled=0;
  for(let i=0;i<frameSize;i++)if(bytes[offset+i]>16){const x=i%size,y=Math.floor(i/size);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);filled++;}
  const area=(maxX-minX+1)*(maxY-minY+1);
  if(filled<32||filled/frameSize>.96||filled/area>.98)throw Error('The background could not be verified as a clean cutout. Choose another avatar look or inspect your saved test. No new render was started.');
 }
}
// Source URLs come only from an authenticated, owner-scoped saved render.
export async function verifyAvatarMedia(root:string,id:string,userId:string,authorization:string,config:{supabaseUrl:string;publicKey:string}){
 const response=await fetch(`${config.supabaseUrl}/functions/v1/avatar-manager`,{method:'POST',headers:{Authorization:authorization,apikey:config.publicKey,'Content-Type':'application/json'},body:JSON.stringify({action:'test_status',test_id:id}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Could not load your saved test. Retry verification; no paid render is needed.');
 const job=await response.json();validateVerificationJob(job,id,userId);
 const folder=resolve(root,'avatar-previews');await mkdir(folder,{recursive:true,mode:0o700});
 const metadata=resolve(folder,`${id}.json`),poster=resolve(folder,`${id}.png`);
 try{const cached=JSON.parse(await readFile(metadata,'utf8'));await readFile(poster);if(cached.verification_version===VERIFICATION_VERSION)return cached;}catch{/* generate once */}
 const key=`${root}:${id}`;if(inFlight.has(key))return inFlight.get(key)!;
 if(inFlight.size>=1)throw Error('Another background check is running. Retry shortly; no new paid render is needed.');
 const work=(async()=>{
  const source=resolve(folder,`${id}.webm`),temp=resolve(folder,`${id}.partial.png`);
  try{
   const url=new URL(job.video_url);
   if(url.protocol!=='https:'||url.username||url.password||!['heygen.ai','heygen.com',new URL(config.supabaseUrl).hostname].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw Error('Unsupported avatar media host.');
   const media=await publicResource(url.href,AbortSignal.timeout(30000),0,50*1024*1024);
   if(media.status!==200)throw Error('The test video could not load. Refresh test status and retry verification.');
   await writeFile(source,media.body,{mode:0o600});
   const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-show_streams','-show_format','-of','json',source],{timeout:10000})).stdout);
   const stream=probe.streams.find((s:any)=>s.codec_type==='video'),duration=Number(probe.format.duration);
   validateAlphaStream(stream,duration);
   const samples=await exec(mediaBinary('ffmpeg'),['-v','error','-c:v','libvpx-vp9','-i',source,'-an','-vf','fps=2,format=rgba,alphaextract,scale=64:64:flags=neighbor','-f','rawvideo','-pix_fmt','gray','pipe:1'],{timeout:45000,maxBuffer:1024*1024,encoding:'buffer'});
   validateAlphaSamples(samples.stdout);
   const bounds=await exec(mediaBinary('ffmpeg'),['-hide_banner','-c:v','libvpx-vp9','-i',source,'-an','-vf','format=rgba,alphaextract,bbox=min_val=16','-f','null','-'],{timeout:45000,maxBuffer:8*1024*1024});
   const crop=alphaBounds(bounds.stderr,stream.width,stream.height,0);
   await exec(mediaBinary('ffmpeg'),['-v','error','-y','-c:v','libvpx-vp9','-i',source,'-ss',String(Math.min(.5,duration/2)),'-vf',`format=rgba,crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,'-frames:v','1',temp],{timeout:15000});
   await rename(temp,poster);
   const result={test_id:id,user_id:userId,verification_version:VERIFICATION_VERSION,crop,source_width:stream.width,source_height:stream.height};
   await writeFile(metadata,JSON.stringify(result),{mode:0o600});return result;
  }finally{await unlink(source).catch(()=>{});await unlink(temp).catch(()=>{});}
 })();inFlight.set(key,work);try{return await work;}finally{inFlight.delete(key);}
}
