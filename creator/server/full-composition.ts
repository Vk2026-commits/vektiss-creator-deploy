import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mediaBinary} from './media-binaries';
import {z} from 'zod';
import {composeSchema} from './compose-video';
import {publicResource} from './public-network';
import {presenterCleanup,repairedCompositionId} from './presenter-cleanup';
import {presenterLayout} from '../src/domain/presenter-layout';
import {avatarFramingSchema,avatarFramingCrop,fixedPresenterCrop,STEPHEN_FRAMING} from '../src/domain/avatar-framing';
import {renderReactionSequence,REACTION_SEQUENCE_VERSION} from './reaction-sequence';
import {screenshotStorySchema,validateStoryScript,storyRevisionInput,type ScreenshotStory} from '../src/domain/screenshot-story';
import {STORY_COMPOSITION_VERSION} from './story-alignment';
import {storyBackground} from './story-background';
import {backgroundFilter} from '../src/domain/background-framing';
const exec=promisify(execFile);
export const fullCompositionSchema=composeSchema.extend({capture_id:z.string().uuid().optional(),video_id:z.string().uuid().optional(),presenter_only:z.literal(true).optional(),story:z.literal(true).optional(),story_revision:z.string().regex(/^[a-f0-9]{64}$/).optional(),job_id:z.string().uuid(),script_id:z.string().uuid(),framing:z.literal(STEPHEN_FRAMING).optional(),presenter_framing:avatarFramingSchema.optional(),presenter_framing_amount:z.number().int().min(30).max(100).optional(),presenter_framing_position:z.number().int().min(0).max(100).optional()}).strict().refine(c=>[c.capture_id,c.video_id,c.presenter_only,c.story].filter(Boolean).length===1,'Choose one background or explicit presenter-only export');
export function alphaBounds(log:string,w:number,h:number,padding=8){
 const boxes=[...log.matchAll(/x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+)/g)].map(m=>m.slice(1).map(Number));
 if(!boxes.length)throw Error('No transparent presenter detected.');
 const x=Math.max(0,Math.floor((Math.min(...boxes.map(b=>b[0]))-padding)/2)*2);
 const y=Math.max(0,Math.floor((Math.min(...boxes.map(b=>b[2]))-padding)/2)*2);
 const right=Math.min(w,Math.ceil((Math.max(...boxes.map(b=>b[1]))+padding+1)/2)*2);
 const bottom=Math.min(h,Math.ceil((Math.max(...boxes.map(b=>b[3]))+padding+1)/2)*2);
 if(right-x>w*.98&&bottom-y>h*.98)throw Error('The presenter has no usable transparent background.');
 return {x,y,width:right-x,height:bottom-y};
}
export async function fullComposition(root:string,input:unknown,authorization:string,env:Record<string,string>){
 const c=fullCompositionSchema.parse(input);
 if(c.background_framing&&(c.video_id||c.story||c.presenter_only))throw Error('Background framing is available for a single screenshot only.');
 let story:ScreenshotStory|undefined,profileId='';
 if(!authorization.startsWith('Bearer '))throw Error('Sign in before creating a video.');
 const response=await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/avatar-manager`,{method:'POST',headers:{Authorization:authorization,apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:'test_status',test_id:c.job_id}),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Could not verify your completed presenter.');
 const job=await response.json();
 if(c.story){
  const saved=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/creator_scripts?id=eq.${c.script_id}&select=content_profile_id,brief`,{headers:{Authorization:authorization,apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(30000)});
  if(!saved.ok)throw Error('Could not verify the screenshot story.');const [script]=await saved.json();
  story=screenshotStorySchema.parse(script?.brief?.production?.screenshot_story);profileId=script.content_profile_id;
  validateStoryScript(story,job.snapshot?.script??'');
  if(c.story_revision!==createHash('sha256').update(storyRevisionInput(story)).digest('hex'))throw Error('The screenshot story changed. Reopen it before exporting.');
  for(const image of story.images)await readFile(resolve(root,'.local-captures',`${image.id}.png`));
 }
 if(job.script_id!==c.script_id||job.status!=='completed'||job.snapshot?.scope!=='full'||typeof job.video_url!=='string')throw Error('A completed full-script presenter is required.');
 const baseId=createHash('sha256').update(JSON.stringify({user:job.user_id,...c,...(story?{story,story_version:STORY_COMPOSITION_VERSION}:{}),...(c.video_id?{sequence:REACTION_SEQUENCE_VERSION}:{})})).digest('hex');
 const id=repairedCompositionId(baseId,c.job_id);
 const folder=resolve(root,'edit/compositions');await mkdir(folder,{recursive:true});
 const output=resolve(folder,`${id}.mp4`);const meta=resolve(folder,`${id}.json`);
 try{const saved=JSON.parse(await readFile(meta,'utf8'));await readFile(output);return saved;}catch{/* assemble once */}
 const url=new URL(job.video_url);
 if(url.protocol!=='https:'||!['heygen.ai','heygen.com',new URL(env.VITE_SUPABASE_URL).hostname].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw Error('Unsupported presenter media host.');
 let source=resolve(folder,`${baseId}.webm`);
 let sourceBytes:Buffer|undefined;
 if(id!==baseId){try{sourceBytes=await readFile(source);}catch{/* download if not cached */}}
 if(!sourceBytes){
  const media=await publicResource(url.href,AbortSignal.timeout(120000),0,200*1024*1024);
  if(media.status!==200)throw Error('Presenter download failed. Refresh its status and retry.');
  sourceBytes=Buffer.from(media.body);source=resolve(folder,`${id}.webm`);
  await writeFile(source,sourceBytes,{mode:0o600});
 }
 const ffmpeg=mediaBinary('ffmpeg');const ffprobe=mediaBinary('ffprobe');
 const probe=JSON.parse((await exec(ffprobe,['-v','error','-show_streams','-show_format','-of','json',source])).stdout);
 const stream=probe.streams.find((s:{codec_type:string})=>s.codec_type==='video');
 if(stream?.codec_name!=='vp9'||String(stream.tags?.alpha_mode??stream.tags?.ALPHA_MODE)!=='1')throw Error('Transparent VP9 presenter required; no new paid render was started.');
 const cleanup=presenterCleanup(c.job_id,sourceBytes,stream.width,stream.height);
 const duration=Number(probe.format.duration);if(!Number.isFinite(duration)||duration<=0||duration>1200)throw Error('Unsupported presenter duration.');
 const bounds=await exec(ffmpeg,['-hide_banner','-c:v','libvpx-vp9','-i',source,'-an','-vf',`${c.placement?cleanup:''}format=rgba,alphaextract,bbox=min_val=16`,'-f','null','-'],{timeout:240000,maxBuffer:32*1024*1024});
 const detected=alphaBounds(bounds.stderr,stream.width,stream.height,c.placement?0:8);
 const verified=job.snapshot?.verified_frame;
 if(verified&&(verified.source_width!==stream.width||verified.source_height!==stream.height))throw Error('The avatar framing changed. Your paid render is saved; contact support before retrying assembly.');
	 const crop=avatarFramingCrop(fixedPresenterCrop(c.framing,stream.width,stream.height)??verified?.crop??detected,c.presenter_framing,c.presenter_framing_amount,c.presenter_framing_position);
 const [w,h]=c.format==='portrait'?[720,1280]:c.format==='landscape'?[1280,720]:[720,720];
 const {width,height,x,y}=presenterLayout(c.format,c.position,c.size,c.placement,crop.width/crop.height);
 const filter=`[0:v]${backgroundFilter(w,h,c.background_framing)},setsar=1,fps=25,setpts=PTS-STARTPTS[bg];[1:v]${cleanup}crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},despill=type=green:mix=0.5:green=-1,scale=${width}:${height},setsar=1,setpts=PTS-STARTPTS[fg];[bg][fg]overlay=${x}:${y}:shortest=1,format=yuv420p[out]`;
 const temp=resolve(folder,`${id}.partial.mp4`);
 let background=resolve(root,'.local-captures',c.video_id?`${c.video_id}.video`:`${c.capture_id}.png`);
 let totalDuration=duration;
 let storyTiming; if(story){const rendered=await storyBackground({root,folder,id,jobId:c.job_id,source,story,duration,w,h,profileId,projectId:c.script_id,authorization,env});background=rendered.path;storyTiming=rendered.timing;}
 if(c.video_id){
  const info=JSON.parse((await exec(ffprobe,['-v','error','-show_format','-show_streams','-of','json',background],{timeout:15000})).stdout);
  const sourceDuration=Number(info.format.duration);
  if(!info.streams.some((s:{codec_type:string})=>s.codec_type==='video')||!Number.isFinite(sourceDuration)||sourceDuration<=0||sourceDuration>600)throw Error('Unsupported presenter background video.');
  totalDuration=await renderReactionSequence({ffmpeg,background,source,output:temp,filter,w,h,sourceDuration,reactionDuration:duration,hasSourceAudio:info.streams.some((s:{codec_type:string})=>s.codec_type==='audio')});
 }else await exec(ffmpeg,['-hide_banner','-loglevel','error','-y',...(story?['-i',background]:c.presenter_only?['-f','lavfi','-i',`color=c=0xe8edf4:s=${w}x${h}:r=25`]:['-loop','1','-framerate','25','-i',background]),'-c:v','libvpx-vp9','-i',source,'-filter_complex',filter,'-map','[out]','-map','1:a:0','-t',String(duration),'-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-movflags','+faststart','-shortest',temp],{timeout:600000,maxBuffer:1024*1024});
 await rename(temp,output);
 const result={id,...(storyTiming?{story_timing:storyTiming,story_version:STORY_COMPOSITION_VERSION}:{}),script_id:c.script_id,job_id:c.job_id,size:c.size,position:c.position,placement:c.placement,framing:c.framing,crop,format:c.format,created_at:new Date().toISOString(),duration:totalDuration,reaction_duration:duration,sequence:c.video_id?REACTION_SEQUENCE_VERSION:undefined};
 await writeFile(meta,JSON.stringify(result),{mode:0o600});return result;
}
