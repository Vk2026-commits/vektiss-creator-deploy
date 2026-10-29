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
