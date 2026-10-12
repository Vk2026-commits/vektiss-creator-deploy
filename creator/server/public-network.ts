import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import ipaddr from 'ipaddr.js';
import type {IncomingMessage} from 'node:http';

// Stream large video bodies with the same DNS pinning used by article imports.
export async function publicVideo<T>(value:string,consume:(body:AsyncIterable<Uint8Array>)=>Promise<T>,signal:AbortSignal,redirects=0):Promise<T>{
 const url=captureUrl(value),addresses=await lookup(url.hostname,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('VIDEO_EXTRACT');
 const address=addresses[0];
 const res=await new Promise<IncomingMessage>((resolve,reject)=>{
  const req=request(url,{signal,family:address.family,lookup:(_h,_o,cb)=>cb(null,address.address,address.family),headers:{'accept-encoding':'identity'}},resolve);req.on('error',reject);req.end();
 });
 try{
  if(res.statusCode&&res.statusCode>=300&&res.statusCode<400&&res.headers.location){
   if(redirects>=4)throw Error('VIDEO_EXTRACT');
   res.destroy();return await publicVideo(new URL(res.headers.location,url).href,consume,signal,redirects+1);
  }
  if(res.statusCode!==200||!['video/mp4','video/webm'].includes(res.headers['content-type']?.split(';')[0]??''))throw Error('VIDEO_FORMAT');
  return await consume(res);
 }finally{res.destroy();}
}

export function publicAddress(address:string){
 try{return ipaddr.process(address).range()==='unicast';}catch{return false;}
}
export function captureUrl(value:string){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||url.hostname.endsWith('.')||/(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname))throw Error('Use a public HTTPS article link.');
 url.hash='';return url;
}
const publicBrowserHeaders={
 'accept-encoding':'identity',
 'accept':'*/*',
 'accept-language':'en-US,en;q=0.9',
 // Some publishers rate-limit old/mobile crawler signatures even when the same
 // page is public in a current browser. Keep this aligned with the Chromium
 // version in the hosted capture image instead of impersonating Mobile Safari.
 'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
} as const;
// All browser network traffic is fulfilled here. DNS is checked and the selected
// public IP is pinned to the TLS request; redirects are checked again, not followed blindly.
export async function publicResource(value:string,signal:AbortSignal,redirects=0,maxBytes=8*1024*1024):Promise<{status:number;headers:Record<string,string>;body:Buffer}>{
 const url=captureUrl(value);
 const addresses=await lookup(url.hostname,{all:true});
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Private network addresses are not supported.');
 const address=addresses[0];
 const result=await new Promise<{status:number;headers:Record<string,string>;body:Buffer}>((resolve,reject)=>{
  const req=request(url,{signal,family:address.family,lookup:(_host,_options,cb)=>cb(null,address.address,address.family),headers:publicBrowserHeaders},res=>{
   const chunks:Buffer[]=[];let size=0;
   res.on('data',(part:Buffer)=>{size+=part.length;if(size>maxBytes){res.destroy(Error('Resource too large.'));return;}chunks.push(part);});
   res.on('error',reject);
   res.on('end',()=>{const headers:Record<string,string>={};for(const name of ['content-type','content-encoding','location','access-control-allow-origin']){const v=res.headers[name];if(typeof v==='string')headers[name]=v;}resolve({status:res.statusCode??502,headers,body:Buffer.concat(chunks)});});
  });req.on('error',reject);req.end();
 });
 if(result.status>=300&&result.status<400&&result.headers.location){if(redirects>=4)throw Error('Too many redirects.');return publicResource(new URL(result.headers.location,url).href,signal,redirects+1,maxBytes);}
 return result;
}
