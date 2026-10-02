import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {prepareMedia} from './prepare-media';
import {mediaBinary} from './media-binaries';
import {sampleTimes,refinementTimes} from '../src/lib/video-sampling';
const exec=promisify(execFile);
export function frameTimesHeader(value:unknown):number[]|undefined{
 if(value===undefined)return undefined;
 if(typeof value!=='string'||value.length>4096)throw Error('Invalid frame times.');
 const times=JSON.parse(value);
 if(!Array.isArray(times)||!times.length||times.length>64||times.some(t=>typeof t!=='number'||!Number.isFinite(t)||t<0||t>180))throw Error('Invalid frame times.');
 return [...new Set(times)].sort((a,b)=>a-b);
}
// Decode on the worker, not a detached mobile Safari video element. The same
// validated media path and private job queue are used as all other media work.
export async function extractVideoFrames(source:AsyncIterable<Uint8Array>,times?:number[]){
 const frames:{time:number;image:string}[]=[];let duration=0;
 await prepareMedia(source,async path=>{
  const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-protocol_whitelist','file,pipe','-show_format','-show_streams','-of','json',path],{timeout:30000,maxBuffer:1024*1024})).stdout);
  duration=Number(probe.format.duration);
  const videoDuration=Number(probe.streams.find((s:{codec_type:string})=>s.codec_type==='video')?.duration);
  const visualEnd=Number.isFinite(videoDuration)&&videoDuration>0?Math.min(duration,videoDuration):duration;
  const selected=times?frameTimesHeader(JSON.stringify(times))!:sampleTimes(duration);
  if(selected.some(t=>t>=duration))throw Error('Frame time is outside the source.');
  let bytes=0;const changes:number[]=[];let previous:Buffer|undefined;
  const started=Date.now();
  async function capture(requested:number,measure=false){
   if(Date.now()-started>300000)throw Error('Frame extraction timed out.');
   const time=Math.min(requested,Math.max(0,visualEnd-.1));
   const {stdout}=await exec(mediaBinary('ffmpeg'),['-v','error','-protocol_whitelist','file,pipe','-ss',String(time),'-i',path,'-frames:v','1','-vf','scale=768:768:force_original_aspect_ratio=decrease','-threads','1','-q:v','5','-f','image2pipe','-vcodec','mjpeg','pipe:1',...(measure?['-frames:v','1','-vf','scale=32:32,format=gray','-threads','1','-f','rawvideo','-y',path+'.thumb']:[])],{timeout:15000,maxBuffer:1024*1024,encoding:'buffer'});
   if(!stdout.length)throw Error('Could not extract source frames.');
   const image=`data:image/jpeg;base64,${stdout.toString('base64')}`;bytes+=image.length;
   if(bytes>9*1024*1024)throw Error('Video frames are too large to analyze.');
   frames.push({time,image});
   if(measure){const pixels=await readFile(path+'.thumb');let change=0;if(previous)for(let i=0;i<pixels.length;i++)change+=Math.abs(pixels[i]-previous[i]);changes.push(change/(pixels.length*255));previous=pixels;}
  }
  for(const time of selected)await capture(time,!times);
  if(!times)for(const time of refinementTimes(selected,changes))await capture(time);
  frames.sort((a,b)=>a.time-b.time);
 });
 return {duration,frames};
}
