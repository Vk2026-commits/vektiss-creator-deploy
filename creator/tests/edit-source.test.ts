import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readEditSource} from '../server/edit-source';
import {repairEditPlan} from '../src/domain/edit-plan-repair';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
it('export reloads verbatim decimal evidence from a legacy source cache',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'edit-source-'));
 try{
  const source={...templateSampleSource,revision:'test',duration:3,words:['share','18','5'].map((text,i)=>({text,start:i,end:i+.5}))};
  await writeFile(join(folder,'test.source.json'),JSON.stringify(source));
  await writeFile(join(folder,'test.transcript.json'),JSON.stringify({text:'Share 18.5%.'}));
  const restored=await readEditSource(folder,'test');
  const p=templateSample('popout-explainer');p.sourceRevision='test';p.beats=[{...p.beats[0],firstWord:0,lastWord:2,headline:'18.5% share',graphics:{nodes:[{label:'18.5% share',shape:'box',x:50,y:50,revealWord:2}],links:[]}}];
  expect(()=>repairEditPlan(p,source,p.templateId)).toThrow('EDIT_UNSUPPORTED_FIGURE');
  expect(()=>repairEditPlan(p,restored,p.templateId)).not.toThrow();
 }finally{await rm(folder,{recursive:true,force:true});}
});
