import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {presenterPositions,freePlacementSchema,type VideoPlan} from '../src/domain/video-plan';
import {presenterLayout} from '../src/domain/presenter-layout';
import {backgroundFramingSchema} from '../src/domain/background-framing';
const exec=promisify(execFile);
export const composeSchema=z.object({capture_id:z.string().uuid(),position:z.enum(presenterPositions),format:z.enum(['portrait','landscape','square']),size:z.number().min(15).max(90).default(28),placement:freePlacementSchema.optional(),background_framing:backgroundFramingSchema.optional()}).strict();
export function compositionFilter(position:typeof presenterPositions[number],format:'portrait'|'landscape'|'square',size=28,placement?:VideoPlan['presenter_placement']){
 const {w,h,width,height,x,y}=presenterLayout(format,position,size,placement);
 // Only removes transparent padding around this verified test presenter, not speech.
 return `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:0:color=0xe8edf4,setsar=1[article];[1:v]crop=328:426:214:426,scale=${width}:${height},format=yuva420p,setpts=PTS-STARTPTS[presenter];[article][presenter]overlay=x=${x}:y=${y}:shortest=1,format=yuv420p[out]`;
}
export async function composeVideo(root:string,input:unknown){
 const command=composeSchema.parse(input);
 const screenshot=resolve(root,'.local-captures',`${command.capture_id}.png`);
 const presenter=resolve(root,'edit/presenter-test/presenter-cleaned.webm');
 await Promise.all([access(screenshot),access(presenter)]);
 const directory=resolve(root,'edit/compositions');await mkdir(directory,{recursive:true});const id=randomUUID();
 const output=resolve(directory,`${id}.mp4`);
 console.info('creator-composition', {id,status:'started',size:command.size,position:command.position,format:command.format});
 const ffmpeg=resolve(homedir(),'.codex/skills/video-use/bin/ffmpeg');
 await exec(ffmpeg,['-hide_banner','-loglevel','error','-n','-loop','1','-framerate','25','-i',screenshot,'-c:v','libvpx-vp9','-i',presenter,'-filter_complex',compositionFilter(command.position,command.format,command.size,command.placement),'-map','[out]','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',output],{timeout:120000,maxBuffer:1024*1024});
 console.info('creator-composition', {id,status:'completed',size:command.size});
 return {id,size:command.size,position:command.position,format:command.format};
}
