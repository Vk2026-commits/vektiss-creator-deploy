import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
const exec=promisify(execFile);
export const REACTION_SEQUENCE_VERSION='source-then-reaction-v1';
export function segmentAudio(duration:number){
 return `aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.03,afade=t=out:st=${Math.max(0,duration-.03)}:d=0.03`;
}
export async function renderReactionSequence({ffmpeg,background,source,output,filter,w,h,sourceDuration,reactionDuration,hasSourceAudio}:{ffmpeg:string;background:string;source:string;output:string;filter:string;w:number;h:number;sourceDuration:number;reactionDuration:number;hasSourceAudio:boolean}){
 const introDuration=Math.ceil(sourceDuration*25)/25;
 const tailDuration=Math.ceil(reactionDuration*25)/25;
 const intro=output.replace(/\.mp4$/,'.intro.mp4'),reaction=output.replace(/\.mp4$/,'.reaction.mp4');
 const codecs=['-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-r','25','-video_track_timescale','12800','-c:a','aac','-ar','48000','-ac','2'];
 const run=(args:string[])=>exec(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{timeout:600000,maxBuffer:1024*1024});
 // Independent segments start at zero; concat shifts the entire reaction (both
 // image and voice) to the end of the source. No avatar frames/audio in intro.
 const introFilter=`[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:0:color=0xe8edf4,setsar=1,fps=25,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=0.04[v];[${hasSourceAudio?'0':'1'}:a]${segmentAudio(introDuration)}[a]`;
 await run(['-i',background,...(hasSourceAudio?[]:['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']),'-filter_complex',introFilter,'-map','[v]','-map','[a]','-t',String(introDuration),...codecs,intro]);
 await run(['-stream_loop','-1','-i',background,'-c:v','libvpx-vp9','-i',source,'-filter_complex',`${filter};[1:a]${segmentAudio(tailDuration)}[a]`,'-map','[out]','-map','[a]','-t',String(tailDuration),...codecs,reaction]);
 const list=output.replace(/\.mp4$/,'.concat.txt');
 const quote=(path:string)=>path.replace(/'/g,"'\\''");
 await writeFile(list,`file '${quote(intro)}'\nfile '${quote(reaction)}'\n`,{mode:0o600});
 await run(['-f','concat','-safe','0','-i',list,'-map','0:v:0','-map','0:a:0','-c','copy','-movflags','+faststart',output]);
 return introDuration+tailDuration;
}
