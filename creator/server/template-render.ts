import {readFile,writeFile,mkdir,rename,unlink,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {readTemplatePlan} from './template-edit';
import {editSourceSchema,validateEditProposal} from '../src/domain/edit-templates';
import {mediaBinary} from './media-binaries';
import {editBrandSchema,defaultEditBrand} from '../src/domain/edit-brand';
import {editDimensions} from '../src/domain/edit-format';
const exec=promisify(execFile);
export const templateRenderRequest=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),version:z.number().int().positive(),mode:z.enum(['preview','final']),approvePreview:z.literal(true).optional()}).strict();
export function checkRenderApproval(input:z.infer<typeof templateRenderRequest>,plan:{version:number},receipt:{version:number}|null){
 if(input.version!==plan.version)throw Error('The edit plan changed. Reload and preview the current version.');
 if(input.mode==='final'&&(!input.approvePreview||receipt?.version!==input.version))throw Error('Preview and approve this version before exporting.');
}
export async function renderTemplatePlan(root:string,raw:unknown){
 const input=templateRenderRequest.parse(raw),plan=await readTemplatePlan(root,input.id);
 const folder=resolve(root,'edit/template-plans');
 let receipt=null;try{receipt=JSON.parse(await readFile(resolve(folder,`${input.id}.preview.json`),'utf8'));}catch{/* No preview yet. */}
 checkRenderApproval(input,plan,receipt);
 if(input.mode==='final')await stat(resolve(root,'edit/template-previews',`${z.string().regex(/^[a-f0-9]{64}$/).parse(receipt.exportId)}.mp4`));
 const revision=z.string().regex(/^[a-f0-9]{64}$/).parse(plan.proposal.sourceRevision);
 const source=editSourceSchema.parse(JSON.parse(await readFile(resolve(folder,`${revision}.source.json`),'utf8')));
 const proposal=validateEditProposal(plan.proposal,source,plan.proposal.templateId);
 if(proposal.beats.some(b=>b.visual!=='presenter'&&!b.graphics?.nodes.length))throw Error('This plan needs renderable graphics. Generate a new edit plan before previewing.');
 if(proposal.beats.some(b=>b.visual==='tier-board'&&b.graphics?.nodes.some(n=>!n.tier||b.graphics!.nodes.filter(other=>other.tier===n.tier).length>3)))throw Error('Tier scenes need explicit rankings and at most three items per row. Revise this plan before rendering.');
 const brand=editBrandSchema.parse(plan.brand??defaultEditBrand);
 const id=createHash('sha256').update(JSON.stringify([input.id,input.version,input.mode,proposal,brand,2])).digest('hex');
 const outputFolder=resolve(root,input.mode==='preview'?'edit/template-previews':'edit/compositions');await mkdir(outputFolder,{recursive:true});
 const output=resolve(outputFolder,`${id}.mp4`);
 const result={id,planId:input.id,version:input.version,mode:input.mode,duration:input.mode==='preview'?Math.min(8,source.duration):source.duration};
 try{await stat(output);if(input.mode==='preview')await writeFile(resolve(folder,`${input.id}.preview.json`),JSON.stringify({version:input.version,exportId:id}),{mode:0o600});return result;}catch{/* Not rendered yet. */}
 const work=randomUUID(),silent=resolve(folder,`${work}.silent.mp4`),muxed=resolve(folder,`${work}.mp4`),jobFile=resolve(folder,`${work}.job.json`);
 const sourceFile=resolve(folder,`${revision}.mp4`);
 try{
  await writeFile(jobFile,JSON.stringify({source,proposal,brand,sourceFile,preview:input.mode==='preview',output:silent}),{mode:0o600});
  await exec(process.execPath,[resolve(process.cwd(),'render/run.mjs'),jobFile],{timeout:1200000,maxBuffer:1024*1024});
  // Keep the original audio; never ask an avatar or voice provider to re-create it.
  await exec(mediaBinary('ffmpeg'),['-v','error','-y','-protocol_whitelist','file,pipe','-i',silent,'-protocol_whitelist','file,pipe','-i',sourceFile,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(result.duration),'-movflags','+faststart',muxed],{timeout:120000,maxBuffer:1024*1024});
  const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',muxed],{timeout:30000})).stdout);
  const video=probe.streams.find((s:{codec_type:string})=>s.codec_type==='video');
  const dimensions=editDimensions(proposal.aspectRatio),scale=input.mode==='preview'?.5:1;
  if(video?.width!==dimensions.width*scale||video?.height!==dimensions.height*scale||!probe.streams.some((s:{codec_type:string})=>s.codec_type==='audio')||Math.abs(Number(probe.format.duration)-result.duration)>.2)throw Error('Rendered media did not pass export checks.');
  // Reject a concurrently changed plan rather than attaching stale output.
  checkRenderApproval(input,await readTemplatePlan(root,input.id),receipt);
  await rename(muxed,output);
  if(input.mode==='preview')await writeFile(resolve(folder,`${input.id}.preview.json`),JSON.stringify({version:input.version,exportId:id}),{mode:0o600});
  return result;
 }finally{await Promise.all([jobFile,silent,muxed].map(p=>unlink(p).catch(()=>{})));}
}
