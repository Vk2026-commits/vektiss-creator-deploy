import {describe,it,expect} from 'vitest';
import {editorialScene,seekEditorialScene,editorialProcessLayout,editorialProcessRoute,type EditorialBeat} from '../src/domain/editorial-scenes';
import {templateSampleSource} from '../src/domain/edit-template-samples';
const base:EditorialBeat={firstWord:0,lastWord:9,start:0,end:5,layout:'bottom-presenter',visual:'diagram',headline:'Source-led explanation',purpose:'Explain source',illustration:'Source-labelled vector illustration',motion:'Word-anchored reveals',graphics:{nodes:['A source idea','Its practical application','A useful result'].map((label,i)=>({label,shape:'box',x:50,y:50,revealWord:i*2})),links:[{from:0,to:1},{from:1,to:2}]}};
describe('editorial scene library',()=>{
 it('uses distinct compositions rather than the same boxes for every scene',()=>{
  const kinds=['process','timeline','document','statistic','network','comparison','spotlight'] as const;
  const html=kinds.map(scene=>editorialScene(templateSampleSource,{...base,scene}));
  expect(new Set(html).size).toBe(7);
  expect(html[0]).toContain('ed-perforation');expect(html[1]).toContain('ed-step-ring');expect(html[2]).toContain('ed-check');expect(html[3]).toContain('ed-stat');expect(html[4]).toContain('ed-hub');expect(html[6]).toContain('ed-serif');
 });
 it('keeps labels in the SVG namespace so compiled exports cannot swallow later scenes',()=>{
  for(const scene of ['process','timeline','document','statistic','network','comparison','spotlight','search'] as const){
   const html=editorialScene(templateSampleSource,{...base,scene});
   expect(html).not.toMatch(/foreignObject|<div|<span/i);
   expect(html).toContain('<text');
   expect(html).toContain('<tspan');
  }
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
  const root={querySelectorAll:(selector:string)=>selector==='[data-ed-reveal]'?[node]:selector==='[data-ed-draw]'?[path]:[]} as unknown as Element;
  seekEditorialScene(root,4);expect(node.style.opacity).toBe('1');expect(path.style.strokeDashoffset).toBe('0');expect(attrs.transform).toBe('translate(10 20)');
  seekEditorialScene(root,0);expect(node.style.opacity).toBe('0');expect(path.style.strokeDashoffset).toBe('1');expect(attrs.transform).toBe('translate(10 38)');
 });
 it('builds a source-labelled search with one query and selectable results',()=>{
  const html=editorialScene(templateSampleSource,{...base,scene:'search',graphics:{nodes:[{label:'Find a useful skill',shape:'box',x:50,y:50,revealWord:1},{label:'Repair engines',shape:'box',x:50,y:50,revealWord:3},{label:'Record cooking',shape:'box',x:50,y:50,revealWord:6}],links:[]}});
  expect(html).toContain('data-ed-type="0.5"');
  expect(html).toContain('data-ed-text="Find a useful skill"');
  expect(html.match(/data-ed-cursor=/g)).toHaveLength(2);
  expect(html).toContain('data-ed-attention="1.5" data-ed-until="3"');
  expect(html).not.toContain('https://');
 });
 it('resets cursor, typing and selected row after seeking backwards',()=>{
  const attrs:Record<string,string>={};
  const selected={dataset:{edAttention:'2',edUntil:'4'},style:{} as Record<string,string>};
  const cursor={dataset:{edCursor:'2',edUntil:'4',edX:'400',edY:'300'},style:{} as Record<string,string>,setAttribute:(k:string,v:string)=>{attrs[k]=v;}};
  const typed={dataset:{edType:'2',edText:'Source claim'},textContent:''};
  const caret={dataset:{edCaret:'2'},style:{} as Record<string,string>};
  const elements:Record<string,unknown[]>={'[data-ed-attention]':[selected],'[data-ed-cursor]':[cursor],'[data-ed-type]':[typed],'[data-ed-caret]':[caret]};
  const root={querySelectorAll:(selector:string)=>elements[selector]??[]} as unknown as Element;
  seekEditorialScene(root,2);expect(typed.textContent).toBe('Source claim');expect(selected.style.opacity).toBe('1');expect(attrs.transform).toBe('translate(400 300)');
  seekEditorialScene(root,5);expect(selected.style.opacity).toBe('0');expect(cursor.style.opacity).toBe('0');expect(caret.style.opacity).toBe('0');
  seekEditorialScene(root,0);expect(typed.textContent).toBe('');expect(selected.style.opacity).toBe('0');expect(cursor.style.opacity).toBe('0');expect(attrs.transform).toBe('translate(445 335)');
 });
 it('only draws approved process and network relationships',()=>{
  const noLinks={...base,graphics:{...base.graphics!,links:[]}};
  for(const scene of ['process','network'] as const){
   expect(editorialScene(templateSampleSource,{...noLinks,scene})).not.toContain('class="ed-connector"');
   expect(editorialScene(templateSampleSource,{...base,scene}).match(/class="ed-connector"/g)).toHaveLength(2);
  }
 });

 it('animates packets only along approved relationships with correct endpoints',()=>{
  for(const scene of ['process','network'] as const){
   const html=editorialScene(templateSampleSource,{...base,scene});
   expect(html.match(/class="ed-signal"/g)).toHaveLength(2);
   expect(editorialScene(templateSampleSource,{...base,scene,graphics:{...base.graphics!,links:[]}})).not.toContain('data-ed-flow=');
  }
  const attrs:Record<string,string>={},packet={dataset:{edFlow:'2',edDuration:'1',edPoints:'0,0,0,100,100,100,100,0'},style:{} as Record<string,string>,setAttribute:(k:string,v:string)=>{attrs[k]=v;}};
  const root={querySelectorAll:(s:string)=>s==='[data-ed-flow]'?[packet]:[]} as unknown as Element;
  seekEditorialScene(root,2.5);expect(attrs.cx).toBe('50');expect(attrs.cy).toBe('75');expect(packet.style.opacity).toBe('1');
  seekEditorialScene(root,4);expect(attrs.cx).toBe('100');expect(attrs.cy).toBe('0');expect(packet.style.opacity).toBe('0');
  seekEditorialScene(root,1);expect(attrs.cx).toBe('0');expect(attrs.cy).toBe('0');expect(packet.style.opacity).toBe('0');
 });
 it('clicks and expands the last search result then fully resets on reverse seek',()=>{
  const html=editorialScene(templateSampleSource,{...base,scene:'search'});
  expect(html).toContain('data-ed-click-ring=');expect(html).toContain('data-ed-expand=');
  const expansion:Record<string,string>={},ringAttrs:Record<string,string>={},pressAttrs:Record<string,string>={};
  const expanded={dataset:{edExpand:'2',edHeight:'86',edGrowth:'48'},setAttribute:(k:string,v:string)=>{expansion[k]=v;}};
  const ring={dataset:{edClickRing:'2'},style:{} as Record<string,string>,setAttribute:(k:string,v:string)=>{ringAttrs[k]=v;}};
  const press={dataset:{edPress:'2'},setAttribute:(k:string,v:string)=>{pressAttrs[k]=v;}};
  const elements:Record<string,unknown[]>={'[data-ed-expand]':[expanded],'[data-ed-click-ring]':[ring],'[data-ed-press]':[press]};
  const root={querySelectorAll:(s:string)=>elements[s]??[]} as unknown as Element;
  seekEditorialScene(root,2.11);expect(Number(ringAttrs.r)).toBeGreaterThan(8);expect(Number(ring.style.opacity)).toBeGreaterThan(0);expect(pressAttrs.transform).toBe('scale(0.86)');
  seekEditorialScene(root,3);expect(expansion.height).toBe('134');expect(ring.style.opacity).toBe('0');
  seekEditorialScene(root,0);expect(expansion.height).toBe('86');expect(ringAttrs.r).toBe('8');expect(ring.style.opacity).toBe('0');expect(pressAttrs.transform).toBe('scale(1)');
 });

});


describe('readable process geometry',()=>{
 it('balances four cards into two wide rows and centers an incomplete fifth-card row',()=>{
  const four=editorialProcessLayout(4);
  expect(four.map(p=>p.row)).toEqual([0,0,1,1]);
  expect(four.every(p=>p.width===365)).toBe(true);
  expect(four[0].x).toBe(four[2].x);
  const five=editorialProcessLayout(5),last=five.slice(3);
  expect((last[0].x+last[1].x+last[1].width)/2).toBeCloseTo(450);
 });
 it('routes connections outside every card interior',()=>{
  for(const count of [3,4,5,6]){
   const cards=editorialProcessLayout(count);
   for(let i=0;i<count;i++)for(let j=0;j<count;j++)if(i!==j){
    const [a,b,c,d]=editorialProcessRoute(cards[i],cards[j]);
    for(let step=1;step<100;step++){
     const t=step/100,v=1-t,x=v*v*v*a.x+3*v*v*t*b.x+3*v*t*t*c.x+t*t*t*d.x,y=v*v*v*a.y+3*v*v*t*b.y+3*v*t*t*c.y+t*t*t*d.y;
     expect(cards.some(p=>x>p.x+.01&&x<p.x+p.width-.01&&y>p.y+.01&&y<p.y+p.height-.01)).toBe(false);
    }
   }
  }
 });
 it('waits for content before revealing decorative panel chrome without moving word anchors',()=>{
  for(const scene of ['process','document','statistic','timeline','search'] as const){
   const html=editorialScene(templateSampleSource,{...base,scene,graphics:{nodes:[{label:'Supported item',shape:'box',x:50,y:50,revealWord:6}],links:[]}});
   expect(html).toContain('<g data-ed-reveal="3" data-ed-x="0" data-ed-y="0" transform="translate(0 0)"><rect class="ed-panel"');
   expect(html).not.toContain('data-ed-reveal="0"');
  }
 });
});
it('uses large independent illustrations for asset-backed examples without adding process arrows',()=>{
 const examples={...base,scene:'document' as const,graphics:{nodes:base.graphics!.nodes.map((n,i)=>({...n,label:['Cooking','Cleaning','Repair'][i],asset:['cooking','cleaning','repair'][i] as never})),links:[]}};
 const html=editorialScene(templateSampleSource,examples);
 expect((html.match(/data-ed-object=/g)??[]).length).toBe(3);
 expect(html).not.toContain('data-ed-flow');
 expect(html).not.toContain('ed-cursor');
 expect(html).toContain('Cooking');expect(html).toContain('Cleaning');expect(html).toContain('Repair');
});
