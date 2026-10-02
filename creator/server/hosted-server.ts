import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,open,unlink,readdir,stat,statfs} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {prepareMedia,SOURCE_MAX_BYTES,cutEndHeader} from './prepare-media';
import {importVideo,importMessages} from './social-video';
import {fullComposition} from './full-composition';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const prefix='/api/local-capture';
export type HostingConfig={origin:string;data:string;dist:string;supabaseUrl:string;publicKey:string;users:string[]};
export function validateHostingConfig(c:HostingConfig){
 if(new URL(c.origin).origin!==c.origin||!c.origin.startsWith('https://'))throw Error('Set the exact HTTPS Creator origin.');
 if(!c.supabaseUrl.startsWith('https://')||!c.publicKey||!c.users.length||c.users.some(id=>!uuid.test(id)))throw Error('Hosted pilot requires Supabase configuration and explicit allowed user IDs.');
 if(resolve(c.data)===resolve(c.dist))throw Error('Media storage must be separate from public files.');
 return c;
}
type Job={state:'running'|'done'|'failed';route:string;created:string;result?:unknown;file?:string;type?:string;error?:string};
function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}
async function bytesUsed(dir:string):Promise<number>{
 const entries=await readdir(dir,{withFileTypes:true}).catch(()=>[]);
 let bytes=0;for(const entry of entries){const path=resolve(dir,entry.name);bytes+=entry.isDirectory()?await bytesUsed(path):(await stat(path)).size;}return bytes;
}
export function hostedHandler(c:HostingConfig){
 let activeJob='';
 return async(req:IncomingMessage,res:ServerResponse)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Cache-Control','private, no-store');
  const path=new URL(req.url??'/',c.origin).pathname;
  try{
   if(path==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
   if(!path.startsWith('/api/')){
    if(!['GET','HEAD'].includes(req.method??''))return json(res,405,{error:'Method not allowed'});
    const name=path==='/'?'index.html':decodeURIComponent(path).slice(1);
    const file=resolve(c.dist,name);
    if(!file.startsWith(resolve(c.dist)+sep)||name.split('/').some(p=>p.startsWith('.'))||!['.html','.js','.css','.png','.jpg','.jpeg','.svg','.webp','.woff2','.ico'].includes(extname(file)))return json(res,404,{error:'Not found'});
    const body=await readFile(file);const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
    res.setHeader('Content-Type',types[extname(file)]);return res.end(req.method==='HEAD'?undefined:body);
   }
   if(!path.startsWith(prefix)||req.headers['x-creator-capture']!=='1'||(req.headers.origin&&req.headers.origin!==c.origin))return json(res,403,{error:'Request not allowed'});
   const authorization=req.headers.authorization??'';
   if(!authorization.startsWith('Bearer '))return json(res,401,{error:'Sign in to access your media.'});
   const auth=await fetch(`${c.supabaseUrl}/auth/v1/user`,{headers:{Authorization:authorization,apikey:c.publicKey},signal:AbortSignal.timeout(15000)});
   if(!auth.ok)return json(res,401,{error:'Your session expired. Sign in again.'});
   const user=await auth.json();if(!uuid.test(user.id??'')||!c.users.includes(user.id))return json(res,403,{error:'This hosted pilot is limited to approved accounts.'});
   // Every filename is resolved beneath the verified user's directory, never a client-supplied owner.
   const root=resolve(c.data,user.id),media=resolve(root,'.local-captures'),jobs=resolve(root,'jobs');
   await mkdir(jobs,{recursive:true,mode:0o700});await mkdir(media,{recursive:true,mode:0o700});
   const jobMatch=path.match(/^\/api\/local-capture\/jobs\/([a-f0-9-]{36})$/);
   if(req.method==='GET'&&jobMatch){
    const id=jobMatch[1];if(!uuid.test(id))return json(res,404,{error:'Not found'});
    const job:Job=JSON.parse(await readFile(resolve(jobs,`${id}.json`),'utf8'));
    if(job.state==='running')return activeJob===id?json(res,202,{poll:`${prefix}/jobs/${id}`}):json(res,409,{error:'Processing was interrupted by a restart. Retry; saved sources and paid renders are preserved.'});
    if(job.state==='failed')return json(res,422,{error:job.error});
    if(job.file){res.setHeader('Content-Type',job.type??'video/mp4');const stream=createReadStream(resolve(jobs,`${id}.mp4`));stream.on('error',()=>res.destroy());stream.pipe(res);return;}
    return json(res,200,job.result);
   }
   const mediaMatch=path.match(/^\/api\/local-capture\/(video-background|exports)\/([a-f0-9-]{36}|[a-f0-9]{64})$/);
   if(req.method==='GET'&&mediaMatch){
    const [,kind,id]=mediaMatch;if(kind==='video-background'&&!uuid.test(id))return json(res,404,{error:'Not found'});
    const file=kind==='exports'?resolve(root,'edit/compositions',`${id}.mp4`):resolve(media,`${id}.video`);
    const info=await stat(file);res.setHeader('Content-Length',info.size);res.setHeader('Content-Type',kind==='exports'?'video/mp4':await readFile(resolve(media,`${id}.mime`),'utf8'));
    const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);return;
   }
   if(req.method==='GET'&&path===`${prefix}/exports`){const folder=resolve(root,'edit/compositions');const names=await readdir(folder).catch(()=>[]);return json(res,200,await Promise.all(names.filter(n=>/^(?:[a-f0-9-]{36}|[a-f0-9]{64})\.mp4$/.test(n)).map(async n=>({id:n.slice(0,-4),created_at:(await stat(resolve(folder,n))).mtime.toISOString()}))));}
   if(req.method!=='POST')return json(res,404,{error:'Not found'});
   if(!['/prepare-video','/video-import','/video-background','/full-compose'].some(route=>path===prefix+route))return json(res,422,{error:'The hosted pilot currently supports video sources. Article screenshot composition is still local-only.'});
   if(activeJob)return json(res,429,{error:'A video is already processing. Please wait and retry.'});
   const id=randomUUID();activeJob=id;
   let inputFile='';let detached=false;
   try{
    // Fixed one-worker pilot: reserve headroom for input, conversion and final composition.
    const disk=await statfs(c.data);
    if(disk.bavail*disk.bsize<2*1024**3||await bytesUsed(c.data)>7*1024**3)return json(res,507,{error:'Pilot storage is nearly full. Download your work and contact the owner before adding more media.'});
    const today=new Date().toISOString().slice(0,10);let count=0;
    for(const file of await readdir(jobs)){if(file.endsWith('.json')&&(await readFile(resolve(jobs,file),'utf8')).includes(`"created":"${today}`))count++;}
    if(count>=60)return json(res,429,{error:'Daily pilot media-processing limit reached. Try again tomorrow.'});
    const type=req.headers['content-type']?.split(';')[0]??'';
    const binary=path.endsWith('/prepare-video')||path.endsWith('/video-background');
    const sourceEnd=cutEndHeader(req.headers['x-source-end']);
    if(binary&&!['video/mp4','video/webm'].includes(type)||!binary&&type!=='application/json')return json(res,415,{error:'Unsupported upload type.'});
    const limit=binary?SOURCE_MAX_BYTES:4096;
    if(Number(req.headers['content-length'])>limit)return json(res,413,{error:'Upload is too large.'});
    inputFile=resolve(jobs,`${id}.input`);const handle=await open(inputFile,'wx',0o600);let size=0;
    req.setTimeout(600000,()=>req.destroy());
    try{for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('VIDEO_SIZE');await handle.writeFile(chunk);}}finally{await handle.close();}
    const input=binary?null:JSON.parse(await readFile(inputFile,'utf8'));
    const job:Job={state:'running',route:path,created:new Date().toISOString()};
    const metadata=resolve(jobs,`${id}.json`);await writeFile(metadata,JSON.stringify(job),{mode:0o600});
    const savedInput=inputFile;inputFile='';detached=true;
    // Persist status, not bearer tokens. Work survives a disconnected phone; never starts a paid render.
    void(async()=>{
     try{
      if(path.endsWith('/full-compose'))job.result=await fullComposition(root,input,authorization,{VITE_SUPABASE_URL:c.supabaseUrl,VITE_SUPABASE_PUBLISHABLE_KEY:c.publicKey});
      else if(path.endsWith('/video-background')){const mediaId=randomUUID();await prepareMedia(createReadStream(savedInput),p=>copyFile(p,resolve(media,`${mediaId}.video`)),sourceEnd);await writeFile(resolve(media,`${mediaId}.mime`),sourceEnd?'video/mp4':type,{mode:0o600});job.result={id:mediaId};}
      else{const result=path.endsWith('/video-import')?await importVideo(root,input.url,prepareMedia):await prepareMedia(createReadStream(savedInput));await writeFile(resolve(jobs,`${id}.mp4`),result.body,{mode:0o600});job.file=id;job.type=result.type;}
      job.state='done';
     }catch(e){job.state='failed';job.error=importMessages[e instanceof Error?e.message:'']??'Media processing failed. Your saved source and existing paid render are preserved; retry or upload the original video.';}
     finally{await unlink(savedInput).catch(()=>{});try{await writeFile(metadata,JSON.stringify(job),{mode:0o600});}finally{activeJob='';}}
    })().catch(()=>{activeJob='';});
    return json(res,202,{poll:`${prefix}/jobs/${id}`});
   }finally{if(inputFile)await unlink(inputFile).catch(()=>{});if(!detached&&activeJob===id)activeJob='';}
  }catch(e){if(!res.headersSent)json(res,(e as NodeJS.ErrnoException).code==='ENOENT'?404:400,{error:'Could not process this media request.'});else res.destroy();}
 };
}

export function startHosted(){
 const c=validateHostingConfig({origin:process.env.CREATOR_ORIGIN??'',data:process.env.CREATOR_DATA_DIR??'/data',dist:resolve('dist'),supabaseUrl:process.env.VITE_SUPABASE_URL??'',publicKey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY??'',users:(process.env.CREATOR_ALLOWED_USERS??'').split(',').filter(Boolean)});
 process.umask(0o077);
 const server=createServer(hostedHandler(c));server.requestTimeout=600000;server.headersTimeout=30000;
 server.listen(Number(process.env.PORT??8080),'0.0.0.0',()=>console.log('Creator hosted pilot listening'));
 return server;
}
