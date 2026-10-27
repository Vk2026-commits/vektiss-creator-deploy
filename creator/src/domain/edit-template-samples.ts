import type {EditProposal,EditSource} from './edit-templates';
export const templateSampleSource:EditSource={kind:'upload',assetId:'00000000-0000-4000-8000-000000000001',revision:'template-demo-v1',duration:5,words:'Turn your skills into value. Solve real problems for people.'.split(' ').map((text,i)=>({text,start:i*.5,end:(i+1)*.5}))};
export function templateSample(id:EditProposal['templateId']):EditProposal{
 if(id==='animated-explainer'||id==='charts-comparisons')return {version:1,rendererVersion:2,templateId:id,sourceRevision:templateSampleSource.revision,beats:[{firstWord:0,lastWord:9,scene:id==='animated-explainer'?'process':'comparison',layout:'bottom-presenter',visual:id==='animated-explainer'?'diagram':'comparison',headline:id==='animated-explainer'?'From skill to value':'Two ways to create',purpose:'Illustrative style preview, not source claims.',illustration:'Example labels.',motion:'Progressive reveal.',graphics:{nodes:(id==='animated-explainer'?['Your skill','Useful service','Customer value']:['Manual process','AI-assisted process']).map((label,i)=>({label,shape:'box',x:20+i*30,y:50,revealWord:1+i*2})),links:id==='animated-explainer'?[{from:0,to:1},{from:1,to:2}]:[]}}]};
 if(['hyperframes-motion','phone-mockup','paper-cutout','clean-tech','glass-cards'].includes(id))return {version:1,rendererVersion:2,templateId:id,sourceRevision:templateSampleSource.revision,beats:[
  {firstWord:0,lastWord:4,scene:'spotlight',layout:'presenter',visual:'typography',headline:'Turn skills into value',purpose:'Illustrate a kinetic headline.',illustration:'Sample headline, not a transcript of the selected footage.',motion:'Word reveals and subtle push-in.',graphics:{nodes:[],links:[]}},
  {firstWord:5,lastWord:9,scene:'document',layout:'split',visual:'diagram',headline:'Solve real problems',purpose:'Illustrate floating cards.',illustration:'Sample cards.',motion:'Perspective card reveals.',graphics:{nodes:['Find a need','Create value'].map((label,i)=>({label,shape:'box',x:30+i*40,y:50,revealWord:5+i*2})),links:[]}},
 ]};
 const tier=id==='tier-list';
 return {version:1,rendererVersion:2,templateId:id,sourceRevision:templateSampleSource.revision,beats:[0,1].map(i=>({
  scene:id==='walkthrough'?'process' as const:'network' as const,
  firstWord:i*5,lastWord:i*5+4,layout:'bottom-presenter',
  visual:tier?'tier-board':id==='walkthrough'?'steps':'diagram',
  headline:i?'Create something useful':'Start with what you know',purpose:'Illustrative template preview, not a customer video.',illustration:'Sample labels and presenter placeholder.',motion:'Staggered reveal',
  graphics:{nodes:(i?['Problem','Solution','Value']:['Skill','Service','Customer']).map((label,j)=>({label,shape:'box' as const,x:20+j*30,y:45,...(tier?{tier:(['S','A','B'] as const)[j]}:{})})),links:tier?[]:[{from:0,to:1},{from:1,to:2}]},
 }))};
}
