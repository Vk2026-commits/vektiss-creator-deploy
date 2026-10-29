import {execFile} from 'node:child_process';
// Trusted composition only. Model output is validated data, never executable code.
import {createRequire} from 'node:module';
import {readFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const require=createRequire(process.env.CREATOR_REMOTION_MODULES?resolve(process.env.CREATOR_REMOTION_MODULES,'../package.json'):import.meta.url);
const {bundle}=require('@remotion/bundler'),{selectComposition,renderMedia}=require('@remotion/renderer');
const job=JSON.parse(await readFile(process.argv[2],'utf8'));
const isPopout=job.proposal.templateId==='popout-explainer'&&job.proposal.aspectRatio!=='16:9';
const matte=job.sourceFile+'.presenter-clean-v1.webm';
if(isPopout){let cached=false;try{cached=(await stat(matte)).size>0}catch{}
 if(!cached){const child=execFile(process.env.CREATOR_PYTHON??'python3',[resolve('render/prepare-presenter-matte.py'),job.sourceFile,matte,'--no-outline'],{timeout:1200000,maxBuffer:1024*1024});child.stdout?.on('data',chunk=>{for(const line of String(chunk).split('\n')){try{const p=JSON.parse(line);if(p.duration>0)process.stdout.write(JSON.stringify({stage:'separating',percent:Math.floor(100*p.seconds/p.duration)})+'\n')}catch{}}});await new Promise((ok,fail)=>{child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error('Presenter preparation failed')))});}
}
const token=randomUUID(),temp=await mkdtemp(resolve(tmpdir(),'creator-edit-bundle-'));
const server=createServer((req,res)=>{if(req.url!==`/${token}`&&!(isPopout&&req.url===`/${token}/matte`)){res.writeHead(404).end();return;}const isMatte=req.url.endsWith('/matte');res.setHeader('Content-Type',isMatte?'video/webm':'video/mp4');const stream=createReadStream(isMatte?matte:job.sourceFile);stream.on('error',()=>res.destroy());stream.pipe(res);});
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const sourceUrl=`http://127.0.0.1:${server.address().port}/${token}`;
 const serveUrl=await bundle({entryPoint:resolve(dirname(fileURLToPath(import.meta.url)),'index.tsx'),outDir:temp,publicDir:null,webpackOverride:config=>process.env.CREATOR_REMOTION_MODULES?{...config,resolve:{...config.resolve,modules:[process.env.CREATOR_REMOTION_MODULES,'node_modules']}}:config});
 const inputProps={sourceUrl,presenterUrl:isPopout?sourceUrl+'/matte':undefined,source:job.source,illustrations:job.illustrations??[],proposal:job.proposal,brand:job.brand};
 const browserExecutable=process.env.CREATOR_CHROMIUM_PATH||undefined;
 const composition=await selectComposition({serveUrl,id:'CreatorEdit',inputProps,browserExecutable});
 await renderMedia({onProgress:p=>process.stdout.write(JSON.stringify({stage:'rendering',percent:Math.floor(p.progress*100)})+'\n'),serveUrl,composition,inputProps,browserExecutable,outputLocation:job.output,codec:'h264',pixelFormat:'yuv420p',concurrency:2,scale:job.preview?0.5:1,crf:job.preview?26:18});
}finally{server.close();await rm(temp,{recursive:true,force:true});}
