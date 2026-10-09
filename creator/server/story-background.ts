import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import type {ScreenshotStory} from '../src/domain/screenshot-story';
import {alignStory,timedWordsSchema} from './story-alignment';
import {mediaBinary} from './media-binaries';
import {DraftError} from './script-draft';
const exec=promisify(execFile);
export async function storyBackground(args:{root:string;folder:string;id:string;jobId:string;source:string;story:ScreenshotStory;duration:number;w:number;h:number;profileId:string;projectId:string;authorization:string;env:Record<string,string>}){
 const {root,folder,id,jobId,source,story,duration,w,h,authorization,env}=args;
 // Files are resolved only beneath the authenticated user's media root.
 for(const image of story.images)await readFile(resolve(root,'.local-captures',`${image.id}.png`));
 const cache=resolve(folder,`${jobId}.story-words-v1.json`);let words;
 try{words=timedWordsSchema.parse(JSON.parse(await readFile(cache,'utf8')));}catch{
  const audio=resolve(folder,`${jobId}.story-audio.mp3`);
  await exec(mediaBinary('ffmpeg'),['-v','error','-y','-i',source,'-vn','-ac','1','-ar','16000','-b:a','32k',audio],{timeout:120000});
  const form=new FormData();form.set('action','story-alignment');form.set('profileId',args.profileId);form.set('projectId',args.projectId);form.set('file',new Blob([await readFile(audio)],{type:'audio/mpeg'}),'narration.mp3');
  const response=await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/script-assistant`,{method:'POST',headers:{Authorization:authorization,apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY},body:form,signal:AbortSignal.timeout(150000)});
  if(!response.ok)throw new DraftError('Narration timing could not finish. Retry loading your video; the completed avatar is saved and no new paid render is needed.');
  words=timedWordsSchema.parse((await response.json()).words);await writeFile(cache,JSON.stringify(words),{mode:0o600});
 }
 let timing;try{timing=alignStory(story,words,duration);}catch(e){
  // A deliberate assembly retry may obtain fresh timestamps; never regenerate the avatar.
  await unlink(cache).catch(()=>undefined);
  throw new DraftError(e instanceof Error?e.message:'Could not align narration.');
 }
 const inputs=story.images.flatMap((image,i)=>['-loop','1','-framerate','25','-t',String(timing[i].end-timing[i].start),'-i',resolve(root,'.local-captures',`${image.id}.png`)]);
 const filters=story.images.map((_,i)=>`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0xe8edf4,setsar=1,fps=25,setpts=PTS-STARTPTS[v${i}]`).join(';')+';'+story.images.map((_,i)=>`[v${i}]`).join('')+`concat=n=${story.images.length}:v=1:a=0[out]`;
 const path=resolve(folder,`${id}.story-background.mp4`);
 await exec(mediaBinary('ffmpeg'),['-v','error','-y',...inputs,'-filter_complex',filters,'-map','[out]','-an','-t',String(duration),'-c:v','libx264','-preset','fast','-pix_fmt','yuv420p',path],{timeout:600000,maxBuffer:1024*1024});
 return {path,timing};
}
