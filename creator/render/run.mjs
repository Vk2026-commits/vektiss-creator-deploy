// Trusted composition only. Model output is validated data, never executable code.
import {createRequire} from 'node:module';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const require=createRequire(process.env.CREATOR_REMOTION_MODULES?resolve(process.env.CREATOR_REMOTION_MODULES,'../package.json'):import.meta.url);
const {bundle}=require('@remotion/bundler'),{selectComposition,renderMedia}=require('@remotion/renderer');
const job=JSON.parse(await readFile(process.argv[2],'utf8'));
const token=randomUUID(),temp=await mkdtemp(resolve(tmpdir(),'creator-edit-bundle-'));
const server=createServer((req,res)=>{if(req.url!==`/${token}`){res.writeHead(404).end();return;}res.setHeader('Content-Type','video/mp4');const stream=createReadStream(job.sourceFile);stream.on('error',()=>res.destroy());stream.pipe(res);});
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const sourceUrl=`http://127.0.0.1:${server.address().port}/${token}`;
 const serveUrl=await bundle({entryPoint:resolve(dirname(fileURLToPath(import.meta.url)),'index.tsx'),outDir:temp,publicDir:null,webpackOverride:config=>process.env.CREATOR_REMOTION_MODULES?{...config,resolve:{...config.resolve,modules:[process.env.CREATOR_REMOTION_MODULES,'node_modules']}}:config});
 const inputProps={sourceUrl,source:job.source,proposal:job.proposal,brand:job.brand};
 const browserExecutable=process.env.CREATOR_CHROMIUM_PATH||undefined;
 const composition=await selectComposition({serveUrl,id:'CreatorEdit',inputProps,browserExecutable});
 await renderMedia({serveUrl,composition,inputProps,browserExecutable,outputLocation:job.output,codec:'h264',pixelFormat:'yuv420p',concurrency:2,scale:job.preview?0.5:1,crf:job.preview?26:18,frameRange:job.preview?[0,Math.min(composition.durationInFrames-1,239)]:undefined});
}finally{server.close();await rm(temp,{recursive:true,force:true});}
