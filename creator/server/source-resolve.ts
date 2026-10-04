import {createReadStream} from 'node:fs';
import {copyFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {captureUrl,publicResource} from './public-network';
import {cobaltMedia} from './cobalt';
import {graphicSource,graphicMetadata,socialGraphicHost} from './graphic-source';
import {prepareMedia} from './prepare-media';
import {importVideo} from './social-video';
import {DraftError} from './script-draft';
import {youtubePostImage} from './youtube-post';

// A provider-confirmed image is safe to use; og:image alone is not evidence
// that a social post is a graphic (videos also expose cover images).
export async function resolveSource(root:string,file:string,type:string,input:unknown,profile:unknown,authorization:string,config:{supabaseUrl:string;publicKey:string}){
 const options=type==='application/json'?z.object({url:z.string().max(2000)}).strict().parse(input):null;
 const url=options?captureUrl(options.url):null;
 const saveVideo=async(body?:Buffer,mime=type)=>{
  const id=randomUUID(),target=resolve(root,'.local-captures',`${id}.video`);
  if(body)await writeFile(target,body,{mode:0o600});
  else await prepareMedia(createReadStream(file),path=>copyFile(path,target));
  await writeFile(resolve(root,'.local-captures',`${id}.mime`),mime,{mode:0o600});
  return {kind:'video' as const,original_id:id};
 };
 if(!url){
  if(['video/mp4','video/webm'].includes(type))return saveVideo();
  if(!['image/png','image/jpeg','image/webp'].includes(type))throw new DraftError('Choose an MP4, WebM, PNG, JPEG or WebP file.');
  return {kind:'graphic',capture:await graphicSource(root,file,type,null,profile,authorization,config)};
 }
 if(socialGraphicHost(url.hostname)){
  if(/(^|\.)youtube\.com$/.test(url.hostname)&&url.pathname.startsWith('/post/')){
   const page=await publicResource(url.href,AbortSignal.timeout(25000),0,4*1024*1024);
   const post=page.status===200?youtubePostImage(page.body.toString(),url.pathname.split('/')[2]):null;
   if(!post)throw new DraftError('This YouTube post does not expose a readable public graphic. Attach a screenshot instead.');
   const image=await publicResource(new URL(post.image,url).href,AbortSignal.timeout(25000),0,10*1024*1024);
   if(image.status!==200||!/^image\/(png|jpeg|webp)(;|$)/i.test(image.headers['content-type']??''))throw new DraftError('Could not read this post image. Attach a screenshot instead.');
   return {kind:'graphic',firstOnly:post.firstOnly,capture:await graphicSource(root,file,'image/png',null,profile,authorization,config,{body:image.body,title:'YouTube post',source_url:url.href,caption:post.caption})};
  }
  // Pass canonical and share links to our trusted extractor. No thumbnail fallback.
  const media=await cobaltMedia(url.href,prepareMedia);
  if(media.type.startsWith('video/'))return {...await saveVideo(media.body,media.type),firstOnly:media.firstOnly};
  let title='Social post graphic',caption='';
  try{const page=await publicResource(url.href,AbortSignal.timeout(15000),0,2*1024*1024);if(page.status===200){const meta=graphicMetadata(page.body.toString());title=meta.title;caption=meta.caption??'';}}catch{/* Caption is optional; never invent it. */}
  const capture=await graphicSource(root,file,'image/png',null,profile,authorization,config,{body:media.body,title,source_url:url.href,caption});
  return {kind:'graphic',capture,firstOnly:media.firstOnly};
 }
 if(/\.(mp4|webm)$/i.test(url.pathname)){
  const media=await importVideo(root,url.href,prepareMedia);return saveVideo(media.body,media.type);
 }
 return {kind:'article',capture:await graphicSource(root,file,'application/json',{url:url.href},profile,authorization,config)};
}
