import {expect,it} from 'vitest';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serveMediaFile} from '../server/serve-media-file';
import {loadMediaBlob} from '../src/lib/load-media-blob';

it('reassembles a large export through bounded range responses and retries a broken body',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'media-range-')),file=join(dir,'video.mp4');
 const source=Buffer.alloc(9*1024*1024+17);for(let i=0;i<source.length;i++)source[i]=i%251;
 await writeFile(file,source);const server=createServer((req,res)=>void serveMediaFile(req,res,file,'video/mp4'));
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;let calls=0;const progress:number[]=[];
 try{
  const blob=await loadMediaBlob(url,async(path,init)=>{
   const response=await fetch(path,init);calls++;
   if(calls===2){await response.body?.cancel();return new Response(new ReadableStream({start(c){c.error(new TypeError('network'));}}),{status:206,headers:response.headers});}
   return response;
  },p=>progress.push(p));
  expect(Buffer.from(await blob.arrayBuffer()).equals(source)).toBe(true);expect(calls).toBe(4);expect(progress.at(-1)).toBe(100);
  const invalid=await fetch(url,{headers:{Range:'bytes=999999999-'}});expect(invalid.status).toBe(416);
  expect((await fetch(url,{headers:{Range:'bytes=0-1,3-4'}})).status).toBe(416);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}
});
