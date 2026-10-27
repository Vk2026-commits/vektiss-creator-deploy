import {mkdir,readFile,writeFile,rename,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {publicResource,captureUrl} from './public-network';
import {mediaBinary} from './media-binaries';
import {mentionedBrands,type LogoSuggestion,logoSuggestionSchema,type RenderLogo} from '../src/domain/logo-assets';
const exec=promisify(execFile);
export function officialIconCandidates(html:string,site:string){
 const host=new URL(site).hostname.replace(/^www\./,'');
 return [...html.matchAll(/<link\b[^>]*>/gi)].flatMap(match=>{
  const attrs:Record<string,string>={};for(const a of match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs))attrs[a[1].toLowerCase()]=a[3].replaceAll('&amp;','&');
  if(!/(^|\s)(apple-touch-icon|icon)(\s|$)/i.test(attrs.rel??'')||!attrs.href)return [];
  try{const url=captureUrl(new URL(attrs.href,site).href);const target=url.hostname.replace(/^www\./,'');const officialCdn=host==='gemini.google.com'&&url.hostname==='www.gstatic.com';if(!officialCdn&&target!==host&&!target.endsWith('.'+host))return [];return [{url:url.href,size:Number((attrs.sizes??'').split('x')[0])||(/apple-touch-icon/.test(attrs.rel)?180:0)}];}catch{return [];}
 }).sort((a,b)=>b.size-a.size).map(x=>x.url).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);
}
export async function discoverLogos(root:string,words:readonly {text:string}[]):Promise<LogoSuggestion[]>{
 const folder=resolve(root,'edit/logo-assets');await mkdir(folder,{recursive:true,mode:0o700});
 const brands=mentionedBrands(words),results:LogoSuggestion[]=[];
 // Two downloads at a time keep this bounded and avoid a serial per-brand delay.
 for(let i=0;i<brands.length;i+=2)results.push(...await Promise.all(brands.slice(i,i+2).map(async brand=>{
  const base={brandId:brand.id,name:brand.name,site:brand.site,firstWord:brand.firstWord};
  const cache=resolve(folder,brand.id+'.json');
  try{const cached=logoSuggestionSchema.parse(JSON.parse(await readFile(cache,'utf8')));if(cached.assetId){await readFile(resolve(folder,cached.assetId+'.png'));return {...cached,...base,status:'pending' as const};}}catch{}
  const signal=AbortSignal.timeout(12000);
  try{
   const candidates:string[]='iconUrls' in brand?[...brand.iconUrls]:[];
   try{const page=await publicResource(brand.site,signal,0,2*1024*1024);if(page.status===200)candidates.push(...officialIconCandidates(page.body.toString('utf8'),brand.site));}catch{if(!candidates.length)throw Error('unavailable');}
   for(const sourceUrl of [...new Set(candidates)]){
    let temp='';try{
     const image=await publicResource(sourceUrl,signal,0,2*1024*1024);
     if(image.status!==200||!/^image\/(png|webp|jpeg)(;|$)/i.test(image.headers['content-type']??''))continue;
     temp=await mkdtemp(resolve(tmpdir(),'creator-logo-'));const input=resolve(temp,'input');await writeFile(input,image.body);
     const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-protocol_whitelist','file,pipe','-show_streams','-of','json',input],{timeout:5000})).stdout).streams?.[0];
     if(!probe||Math.min(probe.width,probe.height)<128||Math.max(probe.width,probe.height)>4096||!['png','webp','mjpeg'].includes(probe.codec_name))continue;
     const out=resolve(temp,'logo.png');await exec(mediaBinary('ffmpeg'),['-v','error','-y','-protocol_whitelist','file,pipe','-i',input,'-frames:v','1','-vf','scale=512:512:force_original_aspect_ratio=decrease',out],{timeout:5000});
     const bytes=await readFile(out),assetId=createHash('sha256').update(bytes).digest('hex');await writeFile(resolve(folder,assetId+'.png'),bytes,{mode:0o600});
     const result:LogoSuggestion={...base,sourceUrl,assetId,status:'pending'};const pending=cache+'.'+randomUUID();await writeFile(pending,JSON.stringify(result),{mode:0o600});await rename(pending,cache);return result;
    }catch{/* Try the next official icon; never substitute an unrelated image. */}finally{if(temp)await rm(temp,{recursive:true,force:true});}
   }
  }catch{}
  return {...base,status:'unavailable' as const,message:'No suitable official image was retrieved. Continue without it or choose another supported brand.'};
 })));
 return results;
}
export async function logoBytes(root:string,id:string){if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid logo');return readFile(resolve(root,'edit/logo-assets',id+'.png'));}
export async function approvedRenderLogos(root:string,raw:unknown):Promise<RenderLogo[]>{
 const logos=logoSuggestionSchema.array().max(8).parse(raw??[]);
 if(logos.some(l=>l.status==='pending'))throw Error('Review suggested logos before exporting.');
 if(logos.some(l=>l.status==='approved'&&!l.assetId))throw Error('Approved logo asset is missing.');
 return Promise.all(logos.filter(l=>l.status==='approved'&&l.assetId).map(async l=>({name:l.name,firstWord:l.firstWord,image:'data:image/png;base64,'+(await logoBytes(root,l.assetId!)).toString('base64')})));
}
