// Decode a still from the already-downloaded MP4, without playing audio or
// seeking the user's player. A separate decoder also works before first play.
export function createVideoPoster(src:string,onReady:(poster:string)=>void){
 const media=document.createElement('video');
 let disposed=false;
 media.muted=true;media.playsInline=true;media.preload='auto';
 const cleanup=()=>{
  if(disposed)return;
  disposed=true;clearTimeout(timeout);
  media.onloadedmetadata=null;media.onseeked=null;media.onerror=null;
  media.removeAttribute('src');media.load();
 };
 const timeout=setTimeout(cleanup,15000);
 media.onloadedmetadata=()=>{media.currentTime=Math.min(0.1,Number.isFinite(media.duration)?media.duration/2:0.1);};
 media.onseeked=()=>{
  if(disposed||!media.videoWidth||!media.videoHeight)return;
  try{
   const canvas=document.createElement('canvas');
   const scale=Math.min(1,720/media.videoWidth);
   canvas.width=Math.round(media.videoWidth*scale);canvas.height=Math.round(media.videoHeight*scale);
   const context=canvas.getContext('2d');
   if(context){context.drawImage(media,0,0,canvas.width,canvas.height);onReady(canvas.toDataURL('image/jpeg',0.85));}
  }catch{/* Thumbnail failure must never block playback or downloading. */}
  cleanup();
 };
 media.onerror=cleanup;media.src=src;media.load();
 return cleanup;
}
