import {describe,it,expect} from 'vitest';
import {animatedExplainerProject} from '../src/domain/animated-explainer-project';
import {templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
import type {EditProposal} from '../src/domain/edit-templates';
const proposal:EditProposal={version:1,rendererVersion:2,templateId:'animated-explainer',sourceRevision:templateSampleSource.revision,beats:[{firstWord:0,lastWord:9,scene:'process',layout:'bottom-presenter',visual:'diagram',headline:'Find a useful solution',purpose:'Illustrative relationship',illustration:'Three connected nodes',motion:'Progressive diagram',graphics:{nodes:['Problem','Solution','Value'].map((label,i)=>({label,shape:'box',x:20+i*30,y:50,revealWord:i*2})),links:[{from:0,to:1},{from:1,to:2}]}}]};
describe('Animated Explainer',()=>{
 it.each(['9:16','16:9']as const)('generates an isolated %s composition with word-anchored relationships',aspectRatio=>{
  const html=animatedExplainerProject(templateSampleSource,{...proposal,aspectRatio},defaultEditBrand);
  expect(html).toContain('class="edge" data-reveal="1.25"');expect(html).toContain('class="node" data-reveal="2"');expect(html).toContain('stroke-dashoffset:1');expect(html).toContain('z-index:10');expect(html).toContain('object-fit:cover');expect(html).toContain('src="source.mp4"');expect(html).not.toContain('Math.random');
 });
 it('escapes model labels and keeps sample seeking',()=>{
  const p=structuredClone(proposal);p.beats[0].headline='</script><img src=x>';p.beats[0].graphics!.nodes[0].label='<script>bad()</script>';
  const html=animatedExplainerProject(templateSampleSource,p,{...defaultEditBrand,captionStyle:'none'},true);
  expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;');expect(html).not.toContain('<img src=x>');expect(html).toContain('vektiss-seek');
 });
 it('supports presenter breathing room and full graphics independently',()=>{
  const p=structuredClone(proposal);p.beats[0].visual='presenter';
  expect(animatedExplainerProject(templateSampleSource,p,defaultEditBrand)).toContain('data-presenter="true"');
  p.beats[0].visual='diagram';p.beats[0].layout='full-graphic';expect(animatedExplainerProject(templateSampleSource,p,defaultEditBrand)).toContain('data-full="true"');
 });
});
