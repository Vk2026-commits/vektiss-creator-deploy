import {captureUrl,publicResource,publicVideo} from './public-network';
import {cobaltVideo} from './cobalt';
export function importFailure(error:unknown){
 const e=error as {message?:string;stderr?:string;code?:string;killed?:boolean};
 if(e.code==='ENOENT')return 'VIDEO_SETUP';
 if(e.killed)return 'VIDEO_TIMEOUT';
 if(/log in for access|login required|sign in to confirm|private video/i.test(e.stderr??''))return 'VIDEO_LOGIN';
 return 'VIDEO_EXTRACT';
}
export const importMessages:Record<string,string>={
 VIDEO_SETUP:'The video importer needs setup on this computer.',
 VIDEO_TIMEOUT:'The video site took too long to respond. Try again shortly.',
 VIDEO_LOGIN:'This import route received a login requirement from the video site. That does not mean the video is unavailable elsewhere. Choose Upload file to use your downloaded copy.',
 VIDEO_EXTRACT:'Our importer could not read this page. The link may still work in your browser. Try again or choose Upload file.',
 VIDEO_LENGTH:'Choose a recorded source video up to 3 minutes long.',
 VIDEO_SIZE:'Choose a source video up to 500 MB.',
 VIDEO_FORMAT:'Could not prepare this video for analysis. Choose an MP4 or WebM file up to 3 minutes and 500 MB.',
};
export function socialVideoUrl(value:string):string|null{
 const u=captureUrl(value),h=u.hostname.replace(/^www\./,'');
 if(h==='youtube.com'||h==='m.youtube.com'){
  const id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})\/?$/)?.[1];
  if(!id||!/^[-\w]{11}$/.test(id))throw Error('VIDEO_LINK');
  return `https://www.youtube.com/watch?v=${id}`;
 }
 if(h==='youtu.be'){const id=u.pathname.slice(1);if(!/^[-\w]{11}$/.test(id))throw Error('VIDEO_LINK');return `https://www.youtube.com/watch?v=${id}`;}
 if(h==='instagram.com'){const path=u.pathname.match(/^\/(?:reel|reels|p)\/([\w-]+)\/?$/);if(!path)throw Error('VIDEO_LINK');return `https://www.instagram.com${path[0]}`;}
 if(h==='tiktok.com'){const path=u.pathname.match(/^\/@[\w.-]+\/video\/\d+\/?$/);if(!path)throw Error('VIDEO_LINK');return `https://www.tiktok.com${path[0]}`;}
 return null;
}
export async function importVideo(root:string,value:string,consume?:(source:AsyncIterable<Uint8Array>)=>Promise<{body:Buffer;type:string}>){
 const social=socialVideoUrl(value);
 if(social)return cobaltVideo(social,consume);
 if(consume)return publicVideo(value,consume,AbortSignal.timeout(600000));
 const media=await publicResource(value,AbortSignal.timeout(60000),0,10*1024*1024);
 const type=media.headers['content-type']?.split(';')[0];
 if(media.status!==200||!['video/mp4','video/webm','audio/mp4','audio/webm','audio/x-m4a'].includes(type)||!media.body.length)throw Error('VIDEO_FORMAT');
 return {body:media.body,type};
}
