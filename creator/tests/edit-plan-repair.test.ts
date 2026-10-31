import {it,expect} from 'vitest';
import {repairEditPlan,editPlanDiagnostic} from '../src/domain/edit-plan-repair';
import {templateSample,templateSampleSource as source} from '../src/domain/edit-template-samples';
it('derives contiguous end boundaries without losing or duplicating words',()=>{
 const p=templateSample('hyperframes-motion');p.beats[0].firstWord=1;p.beats[0].lastWord=7;p.beats[1].lastWord=7;
 const fixed=repairEditPlan(p,source,p.templateId);
 expect(fixed.beats.map(b=>[b.firstWord,b.lastWord])).toEqual([[0,4],[5,9]]);
 expect(fixed.beats.map(b=>b.headline)).toEqual(p.beats.map(b=>b.headline));
});
it('repairs invalid reveal/link metadata without inventing labels',()=>{
 const p=templateSample('hyperframes-motion');p.beats[1].graphics!.nodes[0].revealWord=1;p.beats[1].graphics!.links=[{from:0,to:5}];
 const fixed=repairEditPlan(p,source,p.templateId);
 expect(fixed.beats[1].graphics!.nodes[0].revealWord).toBeUndefined();expect(fixed.beats[1].graphics!.links).toEqual([]);
});
it('rejects ambiguous order, stale sources and incompatible rankings',()=>{
 const p=templateSample('hyperframes-motion');p.beats[1].firstWord=0;
 expect(()=>repairEditPlan(p,source,p.templateId)).toThrow('EDIT_SPEECH_COVERAGE');
 expect(()=>repairEditPlan({...p,sourceRevision:'wrong'},source,p.templateId)).toThrow('EDIT_SOURCE_CHANGED');
 expect(editPlanDiagnostic(Error('private content'))).toBe('EDIT_PLAN_SCHEMA');
 expect(editPlanDiagnostic(Error('EDIT_REVEAL_WORD'))).toBe('EDIT_REVEAL_WORD');
});

it('repairs a tierless board without changing its content, but preserves actual ranking safeguards',()=>{
 const p=templateSample('popout-explainer');p.beats[0].visual='tier-board';
 const fixed=repairEditPlan(p,source,p.templateId);
 expect(fixed.beats[0].visual).toBe('diagram');
 expect(fixed.beats[0].graphics).toEqual(p.beats[0].graphics);
 p.beats[0].graphics!.nodes[0].tier='S';
 expect(()=>repairEditPlan(p,source,p.templateId)).toThrow('EDIT_TEMPLATE_MISMATCH');
});

it('recovers an empty graphic from saved plans using its existing headline without inventing statistics',()=>{
 const p=templateSample('popout-explainer');
 p.beats[0]={...p.beats[0],visual:'diagram',scene:'statistic',headline:'Engagement Stats',graphics:{nodes:[],links:[]}};
 const fixed=repairEditPlan(p,source,p.templateId);
 expect(fixed.beats[0].visual).toBe('typography');expect(fixed.beats[0].scene).toBe('spotlight');
 expect(fixed.beats[0].headline).toBe('Engagement Stats');expect(fixed.beats[0].graphics?.nodes).toEqual([]);
 p.beats[0].headline='';expect(repairEditPlan(p,source,p.templateId).beats[0].visual).toBe('presenter');
});

it('does not turn an invalid Pop-out anchor into an early default reveal',()=>{
 const p=templateSample('popout-explainer');p.beats[1].graphics!.nodes[0].revealWord=0;
 expect(()=>repairEditPlan(p,source,p.templateId)).toThrow('EDIT_REVEAL_WORD');
});

it('recovers a premature scene boundary while preserving every explicit anchor and word',()=>{
 const p=templateSample('popout-explainer');
 p.beats[1].firstWord=2;
 const fixed=repairEditPlan(p,source,p.templateId);
 expect(fixed.beats[0].lastWord).toBeGreaterThanOrEqual(Math.max(...p.beats[0].graphics!.nodes.map(n=>n.revealWord!)));
 expect(fixed.beats[1].firstWord).toBe(fixed.beats[0].lastWord+1);
 expect(fixed.beats.at(-1)!.lastWord).toBe(source.words.length-1);
 expect(fixed.beats.filter(b=>b.graphics?.nodes.length).map(b=>b.graphics)).toEqual(p.beats.map(b=>b.graphics));
});

it('repairs the observed 25–30 word anchors before a scene starting at word 14',()=>{
 const longSource={...source,duration:35,words:Array.from({length:116},(_,i)=>({text:'word',start:i*.3,end:i*.3+.2}))};
 const base=templateSample('popout-explainer');
 const p={...base,beats:[{...base.beats[0],firstWord:0,lastWord:13,graphics:{nodes:base.beats[0].graphics!.nodes.map((n,i)=>({...n,revealWord:i?30:25})),links:[]}},{...base.beats[1],firstWord:14,lastWord:115,graphics:{nodes:base.beats[1].graphics!.nodes.map(n=>({...n,revealWord:36})),links:[]}}]};
 // Shorten the fixture to avoid conflating boundary repair with long-scene quality checks.
 longSource.duration=12;longSource.words=longSource.words.slice(0,40);p.beats[1].lastWord=39;
 const fixed=repairEditPlan(p,longSource,p.templateId);
 const graphicBeats=fixed.beats.filter(b=>b.graphics?.nodes.length);
 expect(graphicBeats[0].lastWord).toBe(30);
 expect(graphicBeats[0].graphics!.nodes.map(n=>n.revealWord)).toEqual([25,30]);
 expect(graphicBeats[1].graphics!.nodes[0].revealWord).toBe(36);
});

it('allows a verified earlier attribution as context without moving unsupported anchors',()=>{
 const p=templateSample('popout-explainer');
 const s={...source,words:source.words.map((w,i)=>({...w,text:i===0?'Business':i===1?'Insider':w.text}))};
 p.beats[1].graphics!.nodes[0]={...p.beats[1].graphics!.nodes[0],label:'Business Insider report',asset:'document',revealWord:0};
 const fixed=repairEditPlan(p,s,p.templateId);
 expect(fixed.beats.flatMap(b=>b.graphics?.nodes??[]).find(n=>n.label==='Business Insider report')?.revealWord).toBeGreaterThanOrEqual(p.beats[1].firstWord);
 expect(()=>repairEditPlan(p,source,p.templateId)).toThrow('EDIT_REVEAL_WORD');
});

it('preserves not-higher meaning instead of asserting lower credit limits',()=>{
 const words="doesn't mean higher credit limits".split(' ').map((text,i)=>({text,start:i,end:i+.9}));
 const s={...source,words,duration:5};
 const p=templateSample('popout-explainer');p.beats=[{...p.beats[0],firstWord:0,lastWord:4,headline:'Credit limits',graphics:{nodes:[{label:'Lower credit limits',shape:'box',x:50,y:50,revealWord:2}],links:[]}}];
 expect(repairEditPlan(p,s,p.templateId).beats.flatMap(b=>b.graphics?.nodes??[])[0].label).toBe('Not higher credit limits');
 const positive={...s,words:words.map(w=>({...w,text:w.text==="doesn't"?'does':w.text}))};
 expect(repairEditPlan(p,positive,p.templateId).beats.flatMap(b=>b.graphics?.nodes??[])[0].label).toBe('Lower credit limits');
});
