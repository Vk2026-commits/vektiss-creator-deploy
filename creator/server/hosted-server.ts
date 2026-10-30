import {importCreativeVideo} from './creative-import';
import {generateTemplateIllustrations} from './template-illustrations';
import {serveMediaFile} from './serve-media-file';
import type {EditProgress} from '../src/domain/edit-progress';
import {reviewDiscovery} from './discovery-review';
import {templateEdit,readTemplatePlan,saveTemplatePlan,listTemplatePlans} from './template-edit';
import {readStudio,saveStudio} from './studio-setting';
import {renderTemplatePlan} from './template-render';
import {logoBytes} from './logo-assets';
import {readEditBrand,saveEditBrand} from './edit-brand';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,open,unlink,readdir,stat,statfs,rename} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {prepareMedia,SOURCE_MAX_BYTES,cutEndHeader} from './prepare-media';
import {importVideo,importMessages} from './social-video';
import {fullComposition} from './full-composition';
import {exportPoster} from './export-poster';
import {extractVideoFrames,frameTimesHeader} from './video-frames';
import {createSavedDraft,DraftError} from './script-draft';
import {sourceWorkflow} from './source-workflow';
import {graphicSource} from './graphic-source';
import {resolveSource} from './source-resolve';
import {reportProcessing,mediaInventory} from './project-usage';
import {verifyAvatarMedia} from './avatar-verification';
import {avatarThumbnail} from './avatar-thumbnail';
import {sendVideoReadyEmail,type VideoReadyNotification} from './resend-notifications';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const prefix='/api/local-capture';
const compositionId=/^[a-f0-9]{64}$/;
export type HostingConfig={origin:string;webOrigin?:string;data:string;dist:string;supabaseUrl:string;publicKey:string;users:string[];resendApiKey?:string;resendFrom?:string};
export function validateHostingConfig(c:HostingConfig){
 if(new URL(c.origin).origin!==c.origin||!c.origin.startsWith('https://'))throw Error('Set the exact HTTPS Creator origin.');
 if(c.webOrigin&&(new URL(c.webOrigin).origin!==c.webOrigin||!c.webOrigin.startsWith('https://')))throw Error('Set the exact HTTPS website origin.');
 if(!c.supabaseUrl.startsWith('https://')||!c.publicKey||!c.users.length||c.users.some(id=>!uuid.test(id)))throw Error('Hosted pilot requires Supabase configuration and explicit allowed user IDs.');
 if(Boolean(c.resendApiKey)!==Boolean(c.resendFrom))throw Error('Configure both Resend runtime settings or neither.');
 if(resolve(c.data)===resolve(c.dist))throw Error('Media storage must be separate from public files.');
 return c;
}
type Job={progress?:EditProgress;state:'running'|'done'|'failed';route:string;created:string;result?:unknown;file?:string;type?:string;error?:string;cost?:Record<string,unknown>;costSynced?:boolean;notification?:VideoReadyNotification};
async function saveJob(path:string,job:Job){const temp=`${path}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(job),{mode:0o600});await rename(temp,path);}
function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}
async function notifyVideoReady(c:HostingConfig,user:{id?:unknown;email?:unknown},root:string,job:Job){
 if(job.route!==`${prefix}/full-compose`||job.state!=='done'||job.notification?.state==='sent'||job.notification?.state==='skipped')return;
 const exportId=(job.result as {id?:unknown}|undefined)?.id;
 if(typeof user.id!=='string'||typeof exportId!=='string'||!compositionId.test(exportId))return;
 try{await stat(resolve(root,'edit/compositions',`${exportId}.mp4`));}catch{return;}
 job.notification=await sendVideoReadyEmail({apiKey:c.resendApiKey,from:c.resendFrom,to:typeof user.email==='string'?user.email:'',webOrigin:c.webOrigin??c.origin,exportId,idempotencyKey:`creator-video-ready-${user.id}-${exportId}`});
}
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
   if(!path.startsWith(prefix)||req.headers['x-creator-capture']!=='1'||(req.headers.origin&&req.headers.origin!==c.origin&&req.headers.origin!==c.webOrigin))return json(res,403,{error:'Request not allowed'});
   const authorization=req.headers.authorization??'';
   if(!authorization.startsWith('Bearer '))return json(res,401,{error:'Sign in to access your media.'});
   const auth=await fetch(`${c.supabaseUrl}/auth/v1/user`,{headers:{Authorization:authorization,apikey:c.publicKey},signal:AbortSignal.timeout(15000)});
   if(!auth.ok)return json(res,401,{error:'Your session expired. Sign in again.'});
   const user=await auth.json();if(!uuid.test(user.id??'')||!c.users.includes(user.id))return json(res,403,{error:'This hosted pilot is limited to approved accounts.'});
   // Every filename is resolved beneath the verified user's directory, never a client-supplied owner.
   const root=resolve(c.data,user.id),media=resolve(root,'.local-captures'),jobs=resolve(root,'jobs');
   await mkdir(jobs,{recursive:true,mode:0o700});await mkdir(media,{recursive:true,mode:0o700});
   const thumbnail=path.match(/^\/api\/local-capture\/avatar-thumbnail\/([a-f0-9-]{36})$/);
   if(req.method==='GET'&&thumbnail&&uuid.test(thumbnail[1])){
    try{const png=await avatarThumbnail(root,thumbnail[1],user.id,authorization,c);res.setHeader('Content-Type','image/png');return res.end(png);}
    catch{return json(res,422,{error:'We could not prepare a clean placement preview. Retry or choose another look. No paid video was started.'});}
   }
   const avatarCheck=path.match(/^\/api\/local-capture\/avatar-verification\/([a-f0-9-]{36})$/);
   if(req.method==='GET'&&avatarCheck&&uuid.test(avatarCheck[1])){
    try{return json(res,200,await verifyAvatarMedia(root,avatarCheck[1],user.id,authorization,c));}
    catch(e){const message=e instanceof Error?e.message:'';return json(res,422,{error:/^(Complete a short|Could not load your saved test|This avatar video|The short test|Unsupported test video|Could not inspect the avatar|The background could not|Another background check|Unsupported avatar media|The test video could not)/.test(message)?message:'Background check failed. Retry verification; no paid render was started.'});}
   }
   const avatarPoster=path.match(/^\/api\/local-capture\/avatar-preview\/([a-f0-9-]{36})$/);
   if(req.method==='GET'&&avatarPoster&&uuid.test(avatarPoster[1])){
    const id=avatarPoster[1],poster=resolve(root,'avatar-previews',`${id}.png`);
    try{
     // Container files are ephemeral. If a rollout removed the cached cutout,
     // rebuild it only from this owner's already completed, verified short test.
     // This never submits a new paid HeyGen render.
     let png:Buffer;
     try{png=await readFile(poster);}catch{await verifyAvatarMedia(root,id,user.id,authorization,c);png=await readFile(poster);}
     res.setHeader('Content-Type','image/png');return res.end(png);
    }catch{return json(res,422,{error:'We could not restore this clean placement preview. Retry or choose another look. No paid video was started.'});}
   }
   const jobMatch=path.match(/^\/api\/local-capture\/jobs\/([a-f0-9-]{36})$/);
	   if(req.method==='GET'&&jobMatch){
	    const id=jobMatch[1];if(!uuid.test(id))return json(res,404,{error:'Not found'});
	    const job:Job=JSON.parse(await readFile(resolve(jobs,`${id}.json`),'utf8'));
	    if(job.state==='done'&&job.notification?.state!=='sent'&&job.notification?.state!=='skipped'){await notifyVideoReady(c,user,root,job);await saveJob(resolve(jobs,`${id}.json`),job);}
	    if(job.cost){
     if(job.state==='running'&&activeJob!==id&&job.cost.status!=='interrupted'){job.cost={...job.cost,status:'interrupted',finished_at:new Date().toISOString()};job.costSynced=false;}
     if(!job.costSynced&&(job.state!=='running'||activeJob!==id)){
      try{await reportProcessing(c,authorization,job.cost);job.costSynced=true;
       // Do not overwrite a concurrently completed worker's metadata with running state.
       const latest:Job=JSON.parse(await readFile(resolve(jobs,`${id}.json`),'utf8'));
       if(latest.state===job.state)await saveJob(resolve(jobs,`${id}.json`),job);
      }catch{console.error('cost-telemetry-retry',id);}
     }
    }
    if(job.state==='running')return activeJob===id?json(res,202,{poll:`${prefix}/jobs/${id}`,created:job.created,progress:job.progress}):json(res,409,{error:'Processing was interrupted by a restart. Retry; saved sources and paid renders are preserved.'});
    if(job.state==='failed')return json(res,422,{error:job.error});
    if(job.file){res.setHeader('Content-Type',job.type??'video/mp4');const stream=createReadStream(resolve(jobs,`${id}.mp4`));stream.on('error',()=>res.destroy());stream.pipe(res);return;}
    return json(res,200,job.result);
   }
   const posterMatch=path.match(/^\/api\/local-capture\/export-poster\/([a-f0-9-]{36}|[a-f0-9]{64})$/);
   if(req.method==='GET'&&posterMatch){const body=await exportPoster(root,posterMatch[1]);res.setHeader('Content-Type','image/jpeg');return res.end(body);}
   const graphicMatch=path.match(/^\/api\/local-capture\/graphic\/([a-f0-9-]{36})$/);
   if(req.method==='GET'&&graphicMatch&&uuid.test(graphicMatch[1])){res.setHeader('Content-Type','image/png');return res.end(await readFile(resolve(media,`${graphicMatch[1]}.png`)));}
   const mediaMatch=path.match(/^\/api\/local-capture\/(video-background|exports)\/([a-f0-9-]{36}|[a-f0-9]{64})$/);
   if(req.method==='GET'&&mediaMatch){
    const [,kind,id]=mediaMatch;if(kind==='video-background'&&!uuid.test(id))return json(res,404,{error:'Not found'});
    const file=kind==='exports'?resolve(root,'edit/compositions',`${id}.mp4`):resolve(media,`${id}.video`);
    return await serveMediaFile(req,res,file,kind==='exports'?'video/mp4':await readFile(resolve(media,`${id}.mime`),'utf8'));
   }
   if(req.method==='GET'&&path===`${prefix}/exports`){const folder=resolve(root,'edit/compositions');const names=await readdir(folder).catch(()=>[]);return json(res,200,await Promise.all(names.filter(n=>/^(?:[a-f0-9-]{36}|[a-f0-9]{64})\.mp4$/.test(n)).map(async n=>({id:n.slice(0,-4),created_at:(await stat(resolve(folder,n))).mtime.toISOString()}))));}
   if(path.startsWith(`${prefix}/template-`)&&process.env.CREATOR_EDIT_STUDIO!=='true')return json(res,503,{error:'Edit Studio is not enabled on this server.'});
   if(path===`${prefix}/template-studio`){
    if(req.method==='GET')return json(res,200,await readStudio(root));
    if(req.method==='PUT'){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)return json(res,413,{error:'Studio settings are too large.'});chunks.push(chunk);}try{return json(res,200,await saveStudio(root,JSON.parse(Buffer.concat(chunks).toString())));}catch{return json(res,400,{error:'Studio could not save. Reload and select an uploaded image owned by this account.'});}}
    return json(res,405,{error:'Method not allowed'});
   }
   if(path===`${prefix}/template-brand`){
    if(req.method==='GET')return json(res,200,await readEditBrand(root));
    if(req.method==='PUT'){
     const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)return json(res,413,{error:'Brand settings are too large.'});chunks.push(chunk);}
     try{return json(res,200,await saveEditBrand(root,JSON.parse(Buffer.concat(chunks).toString())));}catch(error){return json(res,400,{error:error instanceof Error?error.message:'Could not save brand settings.'});}
    }
    return json(res,405,{error:'Method not allowed'});
   }
   const logoMatch=path.match(/^\/api\/local-capture\/template-logos\/([a-f0-9]{64})$/);
   if(req.method==='GET'&&logoMatch){res.setHeader('Content-Type','image/png');return res.end(await logoBytes(root,logoMatch[1]));}
   const templatePreview=path.match(/^\/api\/local-capture\/template-previews\/([a-f0-9]{64})$/);
   if(req.method==='GET'&&templatePreview){const file=resolve(root,'edit/template-previews',`${templatePreview[1]}.mp4`);return await serveMediaFile(req,res,file,'video/mp4');}
   if(req.method==='GET'&&path===`${prefix}/template-plans`)return json(res,200,await listTemplatePlans(root));
   const templatePlan=path.match(/^\/api\/local-capture\/template-plans\/([a-f0-9]{64})$/);
   if(req.method==='GET'&&templatePlan)return json(res,200,await readTemplatePlan(root,templatePlan[1]));
   if(req.method!=='POST')return json(res,404,{error:'Not found'});
   if(!['/creative-import','/template-illustrations','/template-render','/template-edit','/template-plan-save','/discovery-review','/source-resolve','/graphic-source','/prepare-video','/video-import','/video-background','/video-frames','/full-compose','/script-draft','/source-workflow'].some(route=>path===prefix+route))return json(res,422,{error:'Unsupported media operation.'});
   const requestedId=req.headers['x-creator-job'];
   if(requestedId!==undefined&&(typeof requestedId!=='string'||!uuid.test(requestedId)))return json(res,400,{error:'Invalid job identifier.'});
   if(typeof requestedId==='string'){
    const previous=await readFile(resolve(jobs,`${requestedId}.json`),'utf8').catch(()=>null);
    if(previous){
     if((JSON.parse(previous) as Job).route!==path)return json(res,409,{error:'Job identifier belongs to another operation.'});
     return json(res,202,{poll:`${prefix}/jobs/${requestedId}`});
    }
   }
   if(activeJob)return json(res,429,{error:'A video is already processing. Please wait and retry.'});
   const id=typeof requestedId==='string'?requestedId:randomUUID();activeJob=id;
   let inputFile='';let detached=false;
   try{
    // Fixed one-worker pilot: reserve headroom for input, conversion and final composition.
    const disk=await statfs(c.data);
    if(disk.bavail*disk.bsize<2*1024**3||await bytesUsed(c.data)>7*1024**3)return json(res,507,{error:'Pilot storage is nearly full. Download your work and contact the owner before adding more media.'});
    const today=new Date().toISOString().slice(0,10);let count=0;
    for(const file of await readdir(jobs)){if(file.endsWith('.json')&&(await readFile(resolve(jobs,file),'utf8')).includes(`"created":"${today}`))count++;}
    if(count>=60)return json(res,429,{error:'Daily pilot media-processing limit reached. Try again tomorrow.'});
    const type=req.headers['content-type']?.split(';')[0]??'';
    const resolving=path.endsWith('/source-resolve');
    const graphic=path.endsWith('/graphic-source')||(resolving&&type.startsWith('image/'));
    const binary=path.endsWith('/prepare-video')||path.endsWith('/video-background')||path.endsWith('/video-frames')||((path.endsWith('/template-edit')||path.endsWith('/source-workflow')||graphic||resolving)&&type!=='application/json');
    const frameTimes=frameTimesHeader(req.headers['x-frame-times']);
    const sourceEnd=cutEndHeader(req.headers['x-source-end']);
    if(binary&&!(graphic?['image/png','image/jpeg','image/webp']:['video/mp4','video/webm']).includes(type)||!binary&&type!=='application/json')return json(res,415,{error:'Unsupported upload type.'});
    const limit=binary?(graphic?10*1024*1024:SOURCE_MAX_BYTES):path.endsWith('/template-plan-save')?512*1024:(graphic?32*1024:4096);
    if(Number(req.headers['content-length'])>limit)return json(res,413,{error:'Upload is too large.'});
    inputFile=resolve(jobs,`${id}.input`);const handle=await open(inputFile,'wx',0o600);let size=0;
    req.setTimeout(600000,()=>req.destroy());
    try{for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('VIDEO_SIZE');await handle.writeFile(chunk);}}finally{await handle.close();}
    const input=binary?null:JSON.parse(await readFile(inputFile,'utf8'));
    let projectId=req.headers['x-cost-project'];
    if(projectId!==undefined&&(typeof projectId!=='string'||!uuid.test(projectId)))return json(res,400,{error:'Invalid project identifier.'});
    if(input?.script_id&&uuid.test(input.script_id)){
     const checked=await fetch(`${c.supabaseUrl}/rest/v1/creator_scripts?id=eq.${input.script_id}&select=id,brief`,{headers:{Authorization:authorization,apikey:c.publicKey},signal:AbortSignal.timeout(15000)});
     if(!checked.ok)return json(res,403,{error:'Could not verify this project.'});
     const [script]=await checked.json();if(!script)return json(res,403,{error:'Project not found.'});
     projectId=script.brief?.cost_project_id??script.id;
    }
    const context={...c,costProjectId:typeof projectId==='string'?projectId:undefined};
    const retryOf=req.headers['x-creator-retry-of'];
    if(retryOf!==undefined){
     if(typeof retryOf!=='string'||!uuid.test(retryOf))return json(res,400,{error:'Invalid retry identifier.'});
     const prior:Job=JSON.parse(await readFile(resolve(jobs,`${retryOf}.json`),'utf8'));
     if(prior.route!==path||prior.cost?.project_id!==(projectId??null)||prior.state==='done')return json(res,409,{error:'Retry does not match the failed operation.'});
    }
    const before=new Map((await mediaInventory(root)).map(asset=>[asset.key,asset.modified]));
    const started=Date.now();
    const job:Job={state:'running',route:path,created:new Date().toISOString()};
    job.cost={id,user_id:user.id,project_id:projectId??null,retry_of:retryOf??null,operation:path,status:'running',started_at:job.created,upload_bytes:size};
    const metadata=resolve(jobs,`${id}.json`);await saveJob(metadata,job);
    try{await reportProcessing(c,authorization,job.cost);job.costSynced=true;await saveJob(metadata,job);}catch{console.error('cost-telemetry-start',id);}
    const savedInput=inputFile;inputFile='';detached=true;
    // Persist status, not bearer tokens. Work survives a disconnected phone; never starts a paid render.
    void(async()=>{
     let progressWrites=Promise.resolve(),lastProgress='';
     const reportProgress=(progress:EditProgress)=>{const key=JSON.stringify(progress);if(key===lastProgress)return;lastProgress=key;job.progress=progress;progressWrites=progressWrites.then(()=>saveJob(metadata,{...job,progress})).catch(()=>{});};
     try{
      if(path.endsWith('/template-render'))job.result=await renderTemplatePlan(root,input,reportProgress);
      else if(path.endsWith('/creative-import'))job.result=await importCreativeVideo(root,input,authorization,c);
      else if(path.endsWith('/template-illustrations'))job.result=await generateTemplateIllustrations(root,input,authorization,c,undefined,reportProgress);
      else if(path.endsWith('/template-plan-save'))job.result=await saveTemplatePlan(root,input);
      else if(path.endsWith('/template-edit'))job.result=await templateEdit(root,savedInput,type,input??{instructions:req.headers['x-edit-instructions']?decodeURIComponent(String(req.headers['x-edit-instructions'])):undefined,template:req.headers['x-edit-template'],profileId:req.headers['x-profile-id'],aspectRatio:req.headers['x-edit-aspect-ratio'],brand:req.headers['x-edit-brand']?JSON.parse(String(req.headers['x-edit-brand'])):undefined},authorization,c,reportProgress);
      else if(path.endsWith('/discovery-review'))job.result=await reviewDiscovery(root,input,authorization,c);
      else if(resolving)job.result=await resolveSource(root,savedInput,type,input,req.headers['x-profile-id'],authorization,context);
      else if(graphic)job.result=await graphicSource(root,savedInput,type,input,req.headers['x-profile-id'],authorization,context);
      else if(path.endsWith('/source-workflow'))job.result=await sourceWorkflow(root,savedInput,type,input,req.headers['x-profile-id'],authorization,context);
      else if(path.endsWith('/script-draft'))job.result=await createSavedDraft(input,authorization,c);
      else if(path.endsWith('/full-compose'))job.result=await fullComposition(root,input,authorization,{VITE_SUPABASE_URL:c.supabaseUrl,VITE_SUPABASE_PUBLISHABLE_KEY:c.publicKey});
      else if(path.endsWith('/video-frames'))job.result=await extractVideoFrames(createReadStream(savedInput),frameTimes);
	      else if(path.endsWith('/video-background')){const mediaId=randomUUID();await prepareMedia(createReadStream(savedInput),p=>copyFile(p,resolve(media,`${mediaId}.video`)),sourceEnd);await writeFile(resolve(media,`${mediaId}.mime`),sourceEnd?'video/mp4':type,{mode:0o600});job.result={id:mediaId};}
	      else{const result=path.endsWith('/video-import')?await importVideo(root,input.url,prepareMedia):await prepareMedia(createReadStream(savedInput));await writeFile(resolve(jobs,`${id}.mp4`),result.body,{mode:0o600});job.file=id;job.type=result.type;}
	      job.state='done';
	      await notifyVideoReady(c,user,root,job);
	     }catch(e){job.state='failed';job.error=e instanceof DraftError?e.message:importMessages[e instanceof Error?e.message:'']??'Media processing failed. Your saved source and existing paid render are preserved; retry or upload the original video.';}
     finally{
      await progressWrites;
      const assets=(await mediaInventory(root).catch(()=>[])).filter(asset=>before.get(asset.key)!==asset.modified).map(({key,bytes})=>({key,bytes}));
      job.cost={...job.cost,status:job.state,finished_at:new Date().toISOString(),elapsed_ms:Date.now()-started,retained_bytes:assets.reduce((n,a)=>n+a.bytes,0),assets};
      job.costSynced=false;
      await unlink(savedInput).catch(()=>{});
      try{await saveJob(metadata,job);try{await reportProcessing(c,authorization,job.cost);job.costSynced=true;await saveJob(metadata,job);}catch{console.error('cost-telemetry-finish',id);}}finally{activeJob='';}
     }
    })().catch(()=>{activeJob='';});
    return json(res,202,{poll:`${prefix}/jobs/${id}`});
   }finally{if(inputFile)await unlink(inputFile).catch(()=>{});if(!detached&&activeJob===id)activeJob='';}
  }catch(e){if(!res.headersSent)json(res,(e as NodeJS.ErrnoException).code==='ENOENT'?404:400,{error:'Could not process this media request.'});else res.destroy();}
 };
}

export function startHosted(){
	 const c=validateHostingConfig({origin:process.env.CREATOR_ORIGIN??'',webOrigin:process.env.CREATOR_WEB_ORIGIN??'https://creator.vektiss.com',data:process.env.CREATOR_DATA_DIR??'/data',dist:resolve('dist'),supabaseUrl:process.env.VITE_SUPABASE_URL??'',publicKey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY??'',users:(process.env.CREATOR_ALLOWED_USERS??'').split(',').filter(Boolean),resendApiKey:process.env.RESEND_API_KEY??'',resendFrom:process.env.RESEND_FROM_EMAIL??''});
 process.umask(0o077);
 const server=createServer(hostedHandler(c));server.requestTimeout=600000;server.headersTimeout=30000;
 server.listen(Number(process.env.PORT??8080),'0.0.0.0',()=>console.log('Creator hosted pilot listening'));
 return server;
}
