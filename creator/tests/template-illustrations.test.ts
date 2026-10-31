import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateTemplateIllustrations,renderIllustrations} from '../server/template-illustrations';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {illustrationScenes} from '../src/domain/edit-illustrations';
import {popoutExplainerProject} from '../src/domain/popout-explainer-project';
const id='a'.repeat(64),profileId='00000000-0000-4000-8000-000000000001';
const request={id,profileId,version:1,approveImageCharge:true};
const png=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1024,16);png.writeUInt32BE(1024,20);
async function setup(){const root=await mkdtemp(join(tmpdir(),'illustration-test-'));await mkdir(join(root,'edit/template-plans'),{recursive:true});const proposal=templateSample('popout-explainer');await writeFile(join(root,'edit/template-plans',`${id}.json`),JSON.stringify({id,version:1,proposal,brand:defaultEditBrand}));return {root,proposal};}
it('requires paid-action consent before any provider call',async()=>{const {root}=await setup();try{await expect(generateTemplateIllustrations(root,{...request,approveImageCharge:false},'',{supabaseUrl:'',publicKey:''},async()=>png)).rejects.toThrow();}finally{await rm(root,{recursive:true});}});
it('caches images and repeated exports never call the image provider',async()=>{const {root,proposal}=await setup();let calls=0;try{
 const result=await generateTemplateIllustrations(root,request,'',{supabaseUrl:'',publicKey:''},async()=>{calls++;return png;});
 expect(calls).toBe(illustrationScenes(proposal).length);expect(result.version).toBe(2);
 const again=await generateTemplateIllustrations(root,{...request,version:2},'',{supabaseUrl:'',publicKey:''},async()=>{throw Error('must not call');});expect(again.version).toBe(2);
 const images=await renderIllustrations(root,again);expect(images.length).toBe(calls);
 const html=popoutExplainerProject(templateSampleSource,proposal,defaultEditBrand,false,images);expect(html).toContain('AI-generated conceptual illustration');expect(html).toContain('data:image/png;base64,');
 expect((html.match(/id="presenter"/g)??[]).length).toBe(1);
 const changed={...again,brand:{...defaultEditBrand,primary:'#FF0000'}};expect(await renderIllustrations(root,changed)).toEqual([]);
 }finally{await rm(root,{recursive:true});}});
it('does not retry a potentially charged request after an uncertain failure',async()=>{const {root}=await setup();let calls=0;try{
 const generate=async()=>{calls++;throw Error('connection lost');};
 await expect(generateTemplateIllustrations(root,request,'',{supabaseUrl:'',publicKey:''},generate)).rejects.toThrow('interrupted');
 await expect(generateTemplateIllustrations(root,request,'',{supabaseUrl:'',publicKey:''},generate)).rejects.toThrow('uncertain');expect(calls).toBe(1);
 const saved=JSON.parse(await readFile(join(root,'edit/template-plans',`${id}.json`),'utf8'));expect(saved.version).toBe(1);expect(saved.illustrations).toBeUndefined();
 }finally{await rm(root,{recursive:true});}});
it('ignores unowned or stale asset references instead of reading caller paths',async()=>{const {root,proposal}=await setup();try{
 expect(await renderIllustrations(root,{proposal,brand:defaultEditBrand,illustrations:[{beatIndex:0,assetId:'../../other-account'}]})).toEqual([]);
 }finally{await rm(root,{recursive:true});}});
it('keeps numeric evidence and comparison scenes as editable vector graphics',()=>{const p=templateSample('popout-explainer');p.beats=p.beats.map(b=>({...b,scene:'statistic'}));expect(illustrationScenes(p)).toEqual([]);p.templateId='glass-cards';expect(illustrationScenes(p)).toEqual([]);});

it('writes a render fixture when requested without making a provider call',async()=>{
 if(!process.env.ILLUSTRATION_PROOF)return;
 const folder=process.env.ILLUSTRATION_PROOF;await mkdir(folder,{recursive:true});
 const image=await readFile(process.env.ILLUSTRATION_FIXTURE!);
 const proposal=templateSample('popout-explainer');
 const html=popoutExplainerProject(templateSampleSource,proposal,defaultEditBrand,false,[{beatIndex:0,dataUri:`data:image/png;base64,${image.toString('base64')}`}]);
 await writeFile(join(folder,'index.html'),html);
});

it('creates separately keyed objects while preserving speech anchors and labels',async()=>{
 const {root,proposal}=await setup();try{
  const result=await generateTemplateIllustrations(root,request,'',{supabaseUrl:'',publicKey:''},async()=>png);
  expect(result.illustrations.every((a:any)=>Number.isInteger(a.nodeIndex))).toBe(true);
  const images=await renderIllustrations(root,result);
  const html=popoutExplainerProject(templateSampleSource,proposal,defaultEditBrand,false,images);
  expect(html).toContain('data-ed-reveal=');
  for(const image of images)expect(html).toContain(proposal.beats[image.beatIndex].graphics!.nodes[image.nodeIndex!].label);
  expect(result.proposal).toEqual(proposal);
 }finally{await rm(root,{recursive:true});}
});
