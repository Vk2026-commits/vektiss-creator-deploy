import type {EditProposal,EditSource} from './edit-templates';
export const templateSampleSource:EditSource={kind:'upload',assetId:'00000000-0000-4000-8000-000000000001',revision:'template-demo-v1',duration:5,words:'Turn your skills into value. Solve real problems for people.'.split(' ').map((text,i)=>({text,start:i*.5,end:(i+1)*.5}))};
export function templateSample(id:EditProposal['templateId']):EditProposal{
 const tier=id==='tier-list';
 return {version:1,templateId:id,sourceRevision:templateSampleSource.revision,beats:[0,1].map(i=>({
  firstWord:i*5,lastWord:i*5+4,layout:id==='premium-explainer'?'bottom-presenter':'presenter',
  visual:tier?'tier-board':id==='walkthrough'?'steps':'diagram',
  headline:i?'Create something useful':'Start with what you know',purpose:'Illustrative template preview, not a customer video.',illustration:'Sample labels and presenter placeholder.',motion:'Staggered reveal',
  graphics:{nodes:(i?['Problem','Solution','Value']:['Skill','Service','Customer']).map((label,j)=>({label,shape:'box' as const,x:20+j*30,y:45,...(tier?{tier:(['S','A','B'] as const)[j]}:{})})),links:tier?[]:[{from:0,to:1},{from:1,to:2}]},
 }))};
}
