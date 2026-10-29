import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {popoutExplainerProject} from '../src/domain/popout-explainer-project';
import {defaultEditBrand} from '../src/domain/edit-brand';
import type {EditProposal,EditSource} from '../src/domain/edit-templates';
it('builds both aspect ratios with varied scenes and presenter transitions',()=>{
 const kinds=['document','process','statistic','network','timeline','comparison','search'] as const;
 const labels=[['Cooking','Cleaning','Fixing engines'],['Record a task','Teach a robot'],['Up to $30 / hour','Reported by one company'],['Existing skills','Paid service','Useful product'],['Find a problem','Build a solution','Serve a customer'],['Learning alone','Applying your skill'],['Income','Free assessment']];
 const headlines=['Skills you already have','How AI learns','What one company reports','Start with your skills','From problem to customer','Put your skills to work','Your next opportunity'];
 const source:EditSource={kind:'upload',assetId:'00000000-0000-4000-8000-000000000001',revision:'editorial-qa',duration:35,words:Array.from({length:70},(_,i)=>({text:'Sample',start:i*.5,end:(i+1)*.5}))};
 const proposal:EditProposal={version:1,rendererVersion:2,templateId:'popout-explainer',sourceRevision:source.revision,beats:kinds.map((scene,i)=>({firstWord:i*10,lastWord:i*10+9,scene,layout:i===2||i===5?'full-graphic':'bottom-presenter',visual:'diagram',headline:headlines[i],purpose:'Illustrative renderer QA',illustration:'Source-labelled scene',motion:'Word-timed reveal',graphics:{nodes:labels[i].map((label,j)=>({label,shape:'box',x:50,y:50,revealWord:i*10+j})),links:i===1||i===3?[{from:0,to:1}]:[]}}))};
 for(const aspectRatio of ['9:16','16:9'] as const){
  const html=popoutExplainerProject(source,{...proposal,aspectRatio},{...defaultEditBrand,captionStyle:'none'});
  expect(html).toContain('const seekEditorialScene=');expect(html).toContain('seekEditorialScene(s,t)');
  for(const kind of kinds)expect(html).toContain(`data-editorial-kind="${kind}"`);
  expect(html.match(/id="presenter"/g)).toHaveLength(1);expect(html.match(/id="cutout"/g)).toHaveLength(1);
  if(process.env.EDITORIAL_PROOF){const dir=process.env.EDITORIAL_PROOF+(aspectRatio==='16:9'?'/wide':'/vertical');mkdirSync(dir,{recursive:true});writeFileSync(dir+'/index.html',html);}
 }
});
