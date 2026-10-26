import type {Plugin} from 'vite';
import {mkdir,readFile,writeFile,readdir,stat,copyFile,unlink} from 'node:fs/promises';
import {graphicSource} from './graphic-source';
import {resolveSource} from './source-resolve';
import {sourceWorkflow} from './source-workflow';
import {templateEdit,readTemplatePlan,saveTemplatePlan} from './template-edit';
import {renderTemplatePlan} from './template-render';
import {readEditBrand,saveEditBrand} from './edit-brand';
import {readStudio,saveStudio} from './studio-setting';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {captureArticle} from './article-capture';
import {composeVideo} from './compose-video';
import {fullComposition} from './full-composition';
import {exportPoster} from './export-poster';
import {importVideo,importMessages} from './social-video';
import {prepareMedia,SOURCE_MAX_BYTES,cutEndHeader} from './prepare-media';
import {extractVideoFrames,frameTimesHeader} from './video-frames';

export function capturePlugin():Plugin{
 let active=false;
 return {name:'local-article-capture',apply:'serve',configureServer(server){
  const directory=resolve(server.config.root,'.local-captures');
  server.middlewares.use(async(req,res,next)=>{
   const path=req.url?.split('?')[0]??'';if(path.startsWith('/edit/compositions')||path.startsWith('/.local-captures')){res.statusCode=403;res.end();return;}if(!path.startsWith('/api/local-capture'))return next();
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
   const host=req.headers.host;const origin=req.headers.origin;
   if(host!=='127.0.0.1:5178'||(origin&&origin!=='http://127.0.0.1:5178')||req.headers['x-creator-capture']!=='1'||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')){res.statusCode=403;res.end();return;}
   try{
    if(path.startsWith('/api/local-capture/template-')){
     if(process.env.CREATOR_EDIT_STUDIO!=='true'){res.statusCode=503;res.end(JSON.stringify({error:'Edit Studio is not enabled on this server.'}));return;}
     if(path.endsWith('/template-studio')&&(req.method==='GET'||req.method==='PUT')){
      const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('Studio settings are too large.');chunks.push(chunk);}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='GET'?await readStudio(server.config.root):await saveStudio(server.config.root,JSON.parse(Buffer.concat(chunks).toString()))));return;
     }
     if(path.endsWith('/template-brand')&&(req.method==='GET'||req.method==='PUT')){
      const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('Brand settings are too large.');chunks.push(chunk);}
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='GET'?await readEditBrand(server.config.root):await saveEditBrand(server.config.root,JSON.parse(Buffer.concat(chunks).toString()))));return;
     }
     const match=path.match(/^\/api\/local-capture\/template-plans\/([a-f0-9]{64})$/);
     const preview=path.match(/^\/api\/local-capture\/template-previews\/([a-f0-9]{64})$/);
     if(req.method==='GET'&&preview){res.setHeader('Content-Type','video/mp4');res.end(await readFile(resolve(server.config.root,'edit/template-previews',`${preview[1]}.mp4`)));return;}
     if(req.method==='GET'&&match){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await readTemplatePlan(server.config.root,match[1])));return;}
     if(req.method==='POST'&&(path.endsWith('/template-plan-save')||path.endsWith('/template-render'))){
      if(active){res.statusCode=429;res.end();return;}
      active=true;
      try{const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>512*1024)throw Error('Plan is too large.');chunks.push(chunk);}const handler=path.endsWith('/template-render')?renderTemplatePlan:saveTemplatePlan;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await handler(server.config.root,JSON.parse(Buffer.concat(chunks).toString()))));}
      finally{active=false;}
      return;
     }
    }
    const posterMatch=path.match(/^\/api\/local-capture\/export-poster\/([a-f0-9-]{36}|[a-f0-9]{64})$/);
    if(req.method==='GET'&&posterMatch){res.setHeader('Content-Type','image/jpeg');res.end(await exportPoster(server.config.root,posterMatch[1]));return;}
    if(req.method==='GET'&&/^\/api\/local-capture\/graphic\/[a-f0-9-]{36}$/.test(path)){res.setHeader('Content-Type','image/png');res.end(await readFile(resolve(directory,`${path.split('/').pop()}.png`)));return;}
    if(req.method==='POST'&&['/api/local-capture/graphic-source','/api/local-capture/source-resolve','/api/local-capture/source-workflow','/api/local-capture/template-edit'].includes(path)){
     if(path.endsWith('/template-edit')&&process.env.CREATOR_EDIT_STUDIO!=='true'){res.statusCode=503;res.end(JSON.stringify({error:'Edit Studio is not enabled on this server.'}));return;}
     if(active){res.statusCode=429;res.end(JSON.stringify({error:'Media is already processing. Please wait.'}));return;}
     const type=req.headers['content-type']?.split(';')[0]??'';
     if(!['application/json','image/png','image/jpeg','image/webp',...(path.endsWith('/graphic-source')?[]:['video/mp4','video/webm'])].includes(type)){res.statusCode=415;res.end(JSON.stringify({error:'Choose a supported video or screenshot.'}));return;}
     active=true;const file=resolve(directory,`${randomUUID()}.upload`);
     try{
      const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(type==='application/json'?32*1024:type.startsWith('video/')?SOURCE_MAX_BYTES:10*1024*1024))throw Error('Source is too large.');chunks.push(chunk);}
      await mkdir(directory,{recursive:true});const body=Buffer.concat(chunks);await writeFile(file,body,{mode:0o600});
      const handler=path.endsWith('/source-resolve')?resolveSource:path.endsWith('/source-workflow')?sourceWorkflow:graphicSource;
      const config={supabaseUrl:server.config.env.VITE_SUPABASE_URL,publicKey:server.config.env.VITE_SUPABASE_PUBLISHABLE_KEY};
      const result=path.endsWith('/template-edit')?await templateEdit(server.config.root,file,type,type==='application/json'?JSON.parse(body.toString()):{template:req.headers['x-edit-template'],profileId:req.headers['x-profile-id'],aspectRatio:req.headers['x-edit-aspect-ratio'],brand:req.headers['x-edit-brand']?JSON.parse(String(req.headers['x-edit-brand'])):undefined},req.headers.authorization??'',config):await handler(server.config.root,file,type,type==='application/json'?JSON.parse(body.toString()):null,req.headers['x-profile-id'],req.headers.authorization??'',config);
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
     }catch(e){res.statusCode=422;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e instanceof Error?e.message:'Could not save graphic.'}));}
     finally{active=false;await unlink(file).catch(()=>{});}return;
    }
    if(req.method==='POST'&&['/api/local-capture/prepare-video','/api/local-capture/video-frames'].includes(path)){
     if(active){res.statusCode=429;res.end(JSON.stringify({error:'A video is already processing. Please wait.'}));return;}
     if(!['video/mp4','video/webm'].includes(req.headers['content-type']?.split(';')[0]??'')){res.statusCode=415;res.end(JSON.stringify({error:'Choose an MP4 or WebM video.'}));return;}
     if(Number(req.headers['content-length'])>SOURCE_MAX_BYTES){res.statusCode=413;res.end(JSON.stringify({error:importMessages.VIDEO_SIZE}));return;}
     active=true;req.setTimeout(600000,()=>req.destroy());
     try{if(path.endsWith('/video-frames')){const result=await extractVideoFrames(req,frameTimesHeader(req.headers['x-frame-times']));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}else{const media=await prepareMedia(req);res.setHeader('Content-Type',media.type);res.end(media.body);}}
     catch(e){const code=e instanceof Error?e.message:'';res.statusCode=422;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:importMessages[code]??'Could not prepare this video. Try an MP4 or WebM file.'}));}
     finally{active=false;}
     return;
    }
    if(req.method==='POST'&&path==='/api/local-capture/video-background'){
     const type=req.headers['content-type']?.split(';')[0];
     if(!['video/mp4','video/webm'].includes(type??''))throw Error('Unsupported video.');
     if(active){res.statusCode=429;res.end(JSON.stringify({error:'A video is already processing. Please wait.'}));return;}
     const id=randomUUID();await mkdir(directory,{recursive:true});
     active=true;
     try{await prepareMedia(req,path=>copyFile(path,resolve(directory,`${id}.video`),1),cutEndHeader(req.headers['x-source-end']));}
     catch(e){res.statusCode=422;res.end(JSON.stringify({error:importMessages[e instanceof Error?e.message:'']??'Could not save this video.'}));return;}
     finally{active=false;}
     await writeFile(resolve(directory,`${id}.mime`),req.headers['x-source-end']?'video/mp4':type!,{flag:'wx',mode:0o600});
     res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id}));return;
    }
    if(req.method==='GET'&&/^\/api\/local-capture\/video-background\/[a-f0-9-]{36}$/.test(path)){
     const id=path.split('/').pop();const media=await readFile(resolve(directory,`${id}.video`));const type=await readFile(resolve(directory,`${id}.mime`),'utf8');res.setHeader('Content-Type',type==='video/webm'?'video/webm':'video/mp4');res.end(media);return;
    }
    if(req.method==='GET'&&path==='/api/local-capture/exports'){
     const folder=resolve(server.config.root,'edit/compositions');
     const names=await readdir(folder).catch(()=>[]);
     const items=await Promise.all(names.filter(name=>/^[a-f0-9-]{36}\.mp4$/.test(name)).map(async name=>({id:name.slice(0,-4),created_at:(await stat(resolve(folder,name))).mtime.toISOString()})));
     res.setHeader('Content-Type','application/json');res.end(JSON.stringify(items.sort((a,b)=>b.created_at.localeCompare(a.created_at))));return;
    }
    if(req.method==='GET'&&/^\/api\/local-capture\/exports\/(?:[a-f0-9-]{36}|[a-f0-9]{64})$/.test(path)){
     const video=await readFile(resolve(server.config.root,'edit/compositions',`${path.split('/').pop()}.mp4`));res.setHeader('Content-Type','video/mp4');res.end(video);return;
    }
    if(req.method==='GET'&&/^\/api\/local-capture\/[a-f0-9-]{36}$/.test(path)){
     const png=await readFile(resolve(directory,`${path.split('/').pop()}.png`));res.setHeader('Content-Type','image/png');res.end(png);return;
    }
    if(req.method!=='POST'||!['/api/local-capture','/api/local-capture/video-import','/api/local-capture/compose','/api/local-capture/full-compose'].includes(path)){res.statusCode=405;res.end();return;}
    if(active){res.statusCode=429;res.end(JSON.stringify({error:'A capture is already running. Please wait.'}));return;}
    if(!req.headers['content-type']?.startsWith('application/json'))throw Error('Send an article link.');
    active=true;
    try{
     const parts:Buffer[]=[];let size=0;for await(const part of req){size+=part.length;if(size>4096)throw Error('Article link is too long.');parts.push(part);}
     const input=JSON.parse(Buffer.concat(parts).toString());
     if(path==='/api/local-capture/video-import'){
      if(typeof input.url!=='string'||input.url.length>2000)throw Error('Invalid video link.');
      try{const media=await importVideo(server.config.root,input.url,prepareMedia);res.setHeader('Content-Type',media.type);res.end(media.body);}catch(e){const code=e instanceof Error&&importMessages[e.message]?e.message:'VIDEO_EXTRACT';console.warn('creator-video-import',{code});res.statusCode=422;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:importMessages[code]}));}return;
     }
     if(path==='/api/local-capture/full-compose'){const result=await fullComposition(server.config.root,input,req.headers.authorization??'',server.config.env);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}
     if(path==='/api/local-capture/compose'){const result=await composeVideo(server.config.root,input);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;}
     if(typeof input.url!=='string'||input.url.length>2000)throw Error('Enter an article link.');
     const result=await captureArticle(input.url);const id=randomUUID();await mkdir(directory,{recursive:true});
     await writeFile(resolve(directory,`${id}.png`),result.png,{flag:'wx',mode:0o600});
     res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id,title:result.title,source_url:result.source_url}));
    }finally{active=false;}
   }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');const message=error instanceof Error?error.message:'';const fullError=/^(Sign in|Could not verify|A completed|Unsupported presenter|Presenter download|Transparent VP9|No transparent|The presenter)/.test(message)?message:'Assembly failed while processing the presenter or screenshot. Your existing HeyGen render is preserved.';res.end(JSON.stringify({error:path==='/api/local-capture/full-compose'?fullError:path.includes('/compose')?'Video export could not finish. Check that the captured image and cleaned presenter test are still on this computer.':/^(Use a public|The article|This page|No visible|Could not identify|The whole|Enter an article|Article link)/.test(message)?message:'Capture could not finish. Check that Chrome is installed and the article is public, or upload a screenshot.'}));}
  });
 }};
}
