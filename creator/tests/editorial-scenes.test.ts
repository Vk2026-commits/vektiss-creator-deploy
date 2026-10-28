import {describe,it,expect} from 'vitest';
import {editorialScene,seekEditorialScene,type EditorialBeat} from '../src/domain/editorial-scenes';
import {templateSampleSource} from '../src/domain/edit-template-samples';
const base:EditorialBeat={firstWord:0,lastWord:9,start:0,end:5,layout:'bottom-presenter',visual:'diagram',headline:'Source-led explanation',purpose:'Explain source',illustration:'Source-labelled vector illustration',motion:'Word-anchored reveals',graphics:{nodes:['A source idea','Its practical application','A useful result'].map((label,i)=>({label,shape:'box',x:50,y:50,revealWord:i*2})),links:[{from:0,to:1},{from:1,to:2}]}};
describe('editorial scene library',()=>{
 it('uses distinct compositions rather than the same boxes for every scene',()=>{
  const kinds=['process','timeline','document','statistic','network','comparison','spotlight'] as const;
  const html=kinds.map(scene=>editorialScene(templateSampleSource,{...base,scene}));
  expect(new Set(html).size).toBe(7);
  expect(html[0]).toContain('ed-perforation');expect(html[1]).toContain('ed-step-ring');expect(html[2]).toContain('ed-check');expect(html[3]).toContain('ed-stat');expect(html[4]).toContain('ed-hub');expect(html[6]).toContain('ed-serif');
 });
 it('fits the document panel to its rows and centers it',()=>{
  const beat={...base,scene:'document' as const,graphics:{nodes:base.graphics!.nodes.slice(0,2),links:[]}};
  const html=editorialScene(templateSampleSource,beat);
  expect(html).toContain('x="34" y="176" width="832" height="288"');
  expect(html).toContain('data-ed-y="236"');expect(html).toContain('data-ed-y="340"');
 });
 it('escapes all source text and resolves word anchors without external assets',()=>{
  const beat={...base,headline:'<script>bad()</script>',scene:'document' as const,graphics:{nodes:[{label:'<img src="x">',shape:'box' as const,x:50,y:50,revealWord:4}],links:[]}};
  const html=editorialScene(templateSampleSource,beat);
  expect(html).toContain('&lt;script&gt;');expect(html).toContain('&lt;img');expect(html).toContain('data-ed-reveal="2"');expect(html).not.toContain('<script>');expect(html).not.toContain('<video');expect(html).not.toContain('<image');
 });
 it('lands motion on the spoken anchor instead of starting late',()=>{
  const node={dataset:{edReveal:'2'},style:{} as Record<string,string>,setAttribute:()=>{}};
  const root={querySelectorAll:(s:string)=>s==='[data-ed-reveal]'?[node]:[]} as unknown as Element;
  seekEditorialScene(root,1.7);expect(node.style.opacity).toBe('0');
  seekEditorialScene(root,1.9);expect(Number(node.style.opacity)).toBeGreaterThan(.8);
  seekEditorialScene(root,2);expect(node.style.opacity).toBe('1');
 });
 it('adds source-specific vector assets without inventing brand logos',()=>{
  const html=editorialScene(templateSampleSource,{...base,scene:'process',graphics:{nodes:[{label:'Record video',shape:'box',x:50,y:50},{label:'AI learning',shape:'box',x:50,y:50}],links:[]}});
  expect(html).toContain('data-editorial-asset="video"');expect(html).toContain('data-editorial-asset="ai"');
  expect(html).not.toContain('https://');
 });
 it('seeks backwards without retaining visible nodes or completed checks',()=>{
  const node={dataset:{edReveal:'2',edX:'10',edY:'20'},style:{} as Record<string,string>,setAttribute:(k:string,v:string)=>{attrs[k]=v;}};
  const path={dataset:{edDraw:'2.18'},style:{} as Record<string,string>};const attrs:Record<string,string>={};
  const root={querySelectorAll:(selector:string)=>selector==='[data-ed-reveal]'?[node]:[path]} as unknown as Element;
  seekEditorialScene(root,4);expect(node.style.opacity).toBe('1');expect(path.style.strokeDashoffset).toBe('0');expect(attrs.transform).toBe('translate(10 20)');
  seekEditorialScene(root,0);expect(node.style.opacity).toBe('0');expect(path.style.strokeDashoffset).toBe('1');expect(attrs.transform).toBe('translate(10 38)');
 });
});
