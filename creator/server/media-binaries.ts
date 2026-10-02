import {homedir} from 'node:os';
import {resolve} from 'node:path';
export function mediaBinary(name:'ffmpeg'|'ffprobe'){
 return process.env.CREATOR_MEDIA_BIN?resolve(process.env.CREATOR_MEDIA_BIN,name):resolve(homedir(),'.codex/skills/video-use/bin',name);
}
