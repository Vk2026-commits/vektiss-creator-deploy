import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {publicResource,captureUrl} from './public-network';
import {mediaBinary} from './media-binaries';
import {DraftError} from './script-draft';
import {captureArticle} from './article-capture';
const exec=promisify(execFile);
const decode=(s:string)=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
export function socialGraphicUrl(value:string){
 const url=captureUrl(value);
 return url;
}
export function socialGraphicHost(host:string){return ['instagram.com','tiktok.com','youtube.com','youtu.be'].some(h=>host===h||host.endsWith('.'+h));}
export function graphicMetadata(html:string){
 const tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>{
  const attrs:Record<string,string>={};for(const a of m[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs))attrs[a[1].toLowerCase()]=decode(a[3]);return attrs;
 });
 const get=(key:string)=>tags.find(t=>(t.property??t.name)?.toLowerCase()===key)?.content;
 const image=get('og:image')??get('twitter:image');
 if(!image)throw new DraftError('This post does not expose a public graphic. Upload a screenshot instead.');
 const caption=(get('og:description')??get('twitter:description')??get('description')??'').trim().slice(0,2000);
 return {image,title:(get('og:title')??'Social post graphic').slice(0,2000),...(caption?{caption}:{})};
}
export async function graphicSource(root:string,file:string,type:string,input:unknown,profile:unknown,authorization:string,config:{supabaseUrl:string;publicKey:string},prepared?:{body:Buffer;title:string;source_url:string;caption?:string}){
 const media=resolve(root,'.local-captures');
 const options=type==='application/json'?z.object({url:z.string().max(2000).optional(),id:z.string().uuid().optional(),analyze:z.boolean().optional(),caption:z.string().max(2000).optional(),context:z.string().max(4000).optional()}).strict().parse(input):{};
 if(options.analyze){
  const id=z.string().uuid().parse(options.id),profileId=z.string().uuid().parse(profile);
  const png=await readFile(resolve(media,`${id}.png`));
  if(png.length>6*1024*1024)throw new DraftError('This graphic is too detailed to analyze. Upload a smaller screenshot.');
  const form=new FormData();form.set('action','graphic-analysis');form.set('profileId',profileId);form.set('frames',JSON.stringify([`data:image/png;base64,${png.toString('base64')}`]));
  form.set('caption',options.caption??'');form.set('context',options.context??'');
  const response=await fetch(`${config.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers:{Authorization:authorization,apikey:config.publicKey},body:form,signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new DraftError('Could not analyze the graphic. Your image is saved; please retry.');
  return z.object({text:z.string().min(40).max(12000)}).parse(await response.json());
 }
 let bytes:Buffer,title='Uploaded screenshot',source_url='',caption='';
 if(prepared){bytes=prepared.body;title=prepared.title;source_url=prepared.source_url;caption=prepared.caption??'';}
 else if(type==='application/json'){
  const url=socialGraphicUrl(z.string().parse(options.url));source_url=url.href;
  if(!socialGraphicHost(url.hostname)){
   try{const article=await captureArticle(source_url);bytes=article.png;title=article.title;caption=article.caption;}
   catch{throw new DraftError('This page could not be captured publicly. Upload a screenshot instead.');}
  }else{
  const page=await publicResource(source_url,AbortSignal.timeout(25000),0,2*1024*1024);
  if(page.status!==200||!page.headers['content-type']?.includes('text/html'))throw new DraftError('This post could not be opened publicly. Upload a screenshot instead.');
  const meta=graphicMetadata(page.body.toString('utf8'));title=meta.title;caption=meta.caption??'';
  const image=await publicResource(new URL(meta.image,source_url).href,AbortSignal.timeout(25000),0,10*1024*1024);
  if(image.status!==200||!/^image\/(png|jpeg|webp)(;|$)/i.test(image.headers['content-type']??''))throw new DraftError('The post graphic could not be captured. Upload a screenshot instead.');
  bytes=image.body;
  }
 }else bytes=await readFile(file);
 if(!bytes.length||bytes.length>10*1024*1024)throw new DraftError('Choose a PNG, JPEG or WebP image under 10 MB.');
 const folder=await mkdtemp(resolve(tmpdir(),'creator-graphic-'));
 try{
  const original=resolve(folder,'input');await writeFile(original,bytes);
  const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-protocol_whitelist','file,pipe','-show_streams','-of','json',original],{timeout:10000,maxBuffer:1024*1024})).stdout);
  const stream=probe.streams?.[0];
  if(!['png','mjpeg','webp'].includes(stream?.codec_name)||stream.width*stream.height>40000000)throw new DraftError('Choose a supported screenshot smaller than 40 megapixels.');
  const id=randomUUID(),output=resolve(media,`${id}.png`);
  await exec(mediaBinary('ffmpeg'),['-v','error','-protocol_whitelist','file,pipe','-i',original,'-frames:v','1','-vf','scale=1080:1920:force_original_aspect_ratio=decrease','-threads','1',output],{timeout:20000});
  return {id,title,source_url,...(caption?{caption}:{})};
 }finally{await rm(folder,{recursive:true,force:true});}
}
