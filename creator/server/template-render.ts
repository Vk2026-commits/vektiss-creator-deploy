import {renderIllustrations} from './template-illustrations';
import {EDIT_RENDER_VERSION} from '../src/domain/edit-planner-version';
import {parseEditProgress,type EditProgress} from '../src/domain/edit-progress';
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
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {approvedRenderLogos} from './logo-assets';
const exec=promisify(execFile);
export const templateRenderRequest=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),version:z.number().int().positive(),mode:z.enum(['preview','final']),approvePreview:z.literal(true).optional()}).strict();
export function checkRenderApproval(input:z.infer<typeof templateRenderRequest>,plan:{version:number},_receipt?:{version:number}|null){
 if(input.version!==plan.version)throw Error('The edit plan changed. Reload the current version before exporting.');
}
export async function renderTemplatePlan(root:string,raw:unknown,onProgress?:(progress:EditProgress)=>void){
 onProgress?.({stage:'preparing'});
 const input=templateRenderRequest.parse(raw),plan=await readTemplatePlan(root,input.id);
 const folder=resolve(root,'edit/template-plans');
 checkRenderApproval(input,plan);
 const revision=z.string().regex(/^[a-f0-9]{64}$/).parse(plan.proposal.sourceRevision);
 const source=editSourceSchema.parse(JSON.parse(await readFile(resolve(folder,`${revision}.source.json`),'utf8')));
 const proposal=validateEditProposal(plan.proposal,source,plan.proposal.templateId);
 if(proposal.beats.some(b=>b.visual!=='presenter'&&!b.graphics?.nodes.length&&!b.graphics?.chart&&!(b.visual==='typography'&&b.headline.trim())))throw Error('This plan needs renderable graphics. Generate a new edit plan before previewing.');
 if(proposal.beats.some(b=>b.visual==='tier-board'&&b.graphics?.nodes.some(n=>!n.tier||b.graphics!.nodes.filter(other=>other.tier===n.tier).length>3)))throw Error('Tier scenes need explicit rankings and at most three items per row. Revise this plan before rendering.');
 const brand=editBrandSchema.parse(plan.brand??defaultEditBrand);
 const illustrations=await renderIllustrations(root,plan);
 const logos=proposal.templateId==='clean-tech'?await approvedRenderLogos(root,plan.logos):[];
 const id=createHash('sha256').update(JSON.stringify([input.id,input.version,input.mode,proposal,brand,plan.logos??[],plan.illustrations??[],EDIT_RENDER_VERSION])).digest('hex');
 const outputFolder=resolve(root,input.mode==='preview'?'edit/template-previews':'edit/compositions');await mkdir(outputFolder,{recursive:true});
 const output=resolve(outputFolder,`${id}.mp4`);
 const result={id,planId:input.id,version:input.version,mode:input.mode,duration:source.duration};
 try{await stat(output);if(input.mode==='preview')await writeFile(resolve(folder,`${input.id}.preview.json`),JSON.stringify({version:input.version,exportId:id}),{mode:0o600});return result;}catch{/* Not rendered yet. */}
 const work=randomUUID(),silent=resolve(folder,`${work}.silent.mp4`),muxed=resolve(folder,`${work}.mp4`),jobFile=resolve(folder,`${work}.job.json`);
 const sourceFile=resolve(folder,`${revision}.mp4`);
 try{
  const hyperframes=['tier-list','hyperframes-motion','phone-mockup','paper-cutout','clean-tech','glass-cards','popout-explainer','animated-explainer','charts-comparisons'].includes(proposal.templateId);
  await writeFile(jobFile,JSON.stringify({source,proposal,brand,sourceFile,preview:input.mode==='preview',output:silent,...(hyperframes?{html:hyperframesProject(source,proposal,brand,false,logos,illustrations)}:{})}),{mode:0o600});
  const rendering=exec(process.execPath,[resolve(process.cwd(),hyperframes?'render/run-hyperframes.mjs':'render/run.mjs'),jobFile],{timeout:['paper-cutout','popout-explainer'].includes(proposal.templateId)?2400000:1200000,maxBuffer:8*1024*1024});
  let pending='';rendering.child.stdout?.on('data',chunk=>{pending+=String(chunk);const lines=pending.split('\n');pending=lines.pop()??'';for(const line of lines){const p=parseEditProgress(line);if(p)onProgress?.(p);}});
  await rendering;
  onProgress?.({stage:'finishing'});
  // Keep the original audio; never ask an avatar or voice provider to re-create it.
  await exec(mediaBinary('ffmpeg'),['-v','error','-y','-protocol_whitelist','file,pipe','-i',silent,'-protocol_whitelist','file,pipe','-i',sourceFile,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(result.duration),'-movflags','+faststart',muxed],{timeout:120000,maxBuffer:1024*1024});
  const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',muxed],{timeout:30000})).stdout);
  const video=probe.streams.find((s:{codec_type:string})=>s.codec_type==='video');
  const dimensions=editDimensions(proposal.aspectRatio),scale=input.mode==='preview'?.5:1;
  if(video?.width!==dimensions.width*scale||video?.height!==dimensions.height*scale||!probe.streams.some((s:{codec_type:string})=>s.codec_type==='audio')||Math.abs(Number(probe.format.duration)-result.duration)>.2)throw Error('Rendered media did not pass export checks.');
  // Reject a concurrently changed plan rather than attaching stale output.
  checkRenderApproval(input,await readTemplatePlan(root,input.id));
  await rename(muxed,output);
  if(input.mode==='preview')await writeFile(resolve(folder,`${input.id}.preview.json`),JSON.stringify({version:input.version,exportId:id}),{mode:0o600});
  return result;
 }finally{await Promise.all([jobFile,silent,muxed].map(p=>unlink(p).catch(()=>{})));}
}
