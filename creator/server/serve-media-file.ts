import type {IncomingMessage,ServerResponse} from 'node:http';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';

// Called only after authentication and owner-scoped path resolution.
export async function serveMediaFile(req:IncomingMessage,res:ServerResponse,file:string,type:string){
 const {size}=await stat(file);res.setHeader('Content-Type',type);res.setHeader('Accept-Ranges','bytes');
 let start=0,end=size-1;
 const range=req.headers['x-creator-range']??req.headers.range;
 if(range){
  const match=/^bytes=(\d+)-(\d*)$/.exec(typeof range==='string'?range:'');
  start=match?Number(match[1]):NaN;end=match&&match[2]?Math.min(Number(match[2]),size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
  res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
 }
 res.setHeader('Content-Length',Math.max(0,end-start+1));
 const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
