import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {publicResource} from './public-network';
const exec=promisify(execFile);
const pending=new Map<string,Promise<Buffer>>();
export function thumbnailKey(avatar:{id:string;connection_id:string;thumbnail_url:string}){
 const url=new URL(avatar.thumbnail_url);
 if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname==='heygen.ai'||url.hostname.endsWith('.heygen.ai')||url.hostname==='heygen.com'||url.hostname.endsWith('.heygen.com')))throw Error('Unsupported avatar thumbnail');
 // Signed URL renewals do not invalidate unchanged artwork.
 return createHash('sha256').update(JSON.stringify([1,avatar.id,avatar.connection_id,url.origin,url.pathname])).digest('hex');
}
export async function avatarThumbnail(root:string,id:string,owner:string,authorization:string,config:{supabaseUrl:string;publicKey:string}){
 const response=await fetch(`${config.supabaseUrl}/rest/v1/avatar_profiles?id=eq.${id}&user_id=eq.${owner}&select=id,connection_id,thumbnail_url`,{headers:{Authorization:authorization,apikey:config.publicKey},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Avatar lookup failed');
 const [avatar]=await response.json();if(!avatar?.thumbnail_url)throw Error('Avatar not found');
 const key=thumbnailKey(avatar),folder=resolve(root,'avatar-thumbnails'),output=resolve(folder,`${key}.png`);
 await mkdir(folder,{recursive:true,mode:0o700});
 try{return await readFile(output);}catch{/* First preview for this look. */}
 const identity=`${root}:${key}`;
 if(pending.has(identity))return pending.get(identity)!;
 if(pending.size)throw Error('Preview processor busy');
 const work=(async()=>{
  const temp=resolve(folder,`${key}.${randomUUID()}`),input=`${temp}.input`,result=`${temp}.png`;
  try{
   const media=await publicResource(avatar.thumbnail_url,AbortSignal.timeout(20000),0,10*1024*1024);
   if(media.status!==200||!/^image\/(png|jpeg|webp)(;|$)/.test(media.headers['content-type']??''))throw Error('Thumbnail unavailable');
   await writeFile(input,media.body,{mode:0o600});
   await exec(process.env.CREATOR_PYTHON??'python3',[resolve('server/avatar-thumbnail.py'),input,result],{timeout:45000,maxBuffer:1024*1024});
   const png=await readFile(result);if(png.length>12*1024*1024||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid preview');
   await rename(result,output);return png;
  }finally{await unlink(input).catch(()=>{});await unlink(result).catch(()=>{});}
 })();pending.set(identity,work);try{return await work;}finally{pending.delete(identity);}
}
