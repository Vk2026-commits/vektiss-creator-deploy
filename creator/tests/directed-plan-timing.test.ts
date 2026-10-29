import {it,expect} from 'vitest';
import {directedHeadlineTime,timeDirectedPlan} from '../src/domain/directed-plan-timing';
import {validateEditProposal,type EditProposal,type EditSource} from '../src/domain/edit-templates';
const source:EditSource={assetId:'00000000-0000-4000-8000-000000000001',kind:'upload',revision:'timing-test',duration:10,words:['One','company','reports','over','35','000','people','up','to','30'].map((text,i)=>({text,start:i,end:i+1}))};
const plan:EditProposal={version:1,rendererVersion:2,sourceRevision:source.revision,templateId:'popout-explainer',beats:[{firstWord:0,lastWord:9,layout:'full-graphic',visual:'diagram',scene:'statistic',headline:'Over 35,000 people, up to $30',purpose:'Source claim',illustration:'Figure',motion:'Reveal',graphics:{nodes:[{label:'Over 35,000 people, up to $30',shape:'box',x:50,y:50,revealWord:4}],links:[]}}]};
it('waits for the last spoken numeric component and preserves every original word',()=>{
 const fixed=timeDirectedPlan(plan,source);
 expect(fixed.beats.map(beat=>[beat.firstWord,beat.lastWord])).toEqual([[0,8],[9,9]]);
 expect(fixed.beats[0].visual).toBe('presenter');expect(fixed.beats[0].headline).toBe('');
 expect(fixed.beats[1].graphics!.nodes[0]).toEqual({...plan.beats[0].graphics!.nodes[0],revealWord:9});
 expect(fixed.beats[1].headline).toBe(plan.beats[0].headline);
 expect(plan.beats[0].graphics!.nodes[0].revealWord).toBe(4);
 expect(validateEditProposal(fixed,source,'popout-explainer')).toEqual(fixed);
 expect(timeDirectedPlan(fixed,source)).toEqual(fixed);
});
it('delays numeric headlines without rewriting their text',()=>{
 expect(directedHeadlineTime(plan.beats[0],source)).toBe(9);
 expect(directedHeadlineTime({...plan.beats[0],headline:'What one company reports'},source)).toBe(0);
 expect(directedHeadlineTime({...plan.beats[0],headline:'Over 35 000 people'},source)).toBe(5);
});
it('keeps a short lead-in and never advances an existing reveal',()=>{
 const adjusted={...plan,beats:[{...plan.beats[0],firstWord:4,headline:'Participation',graphics:{nodes:[{...plan.beats[0].graphics!.nodes[0],label:'Over 35,000 people',revealWord:6}],links:[]}}]};
 const fixed=timeDirectedPlan(adjusted,source);expect(fixed.beats[1].graphics!.nodes[0].revealWord).toBe(6);
 const short={...adjusted,beats:[{...adjusted.beats[0],firstWord:5}]};expect(timeDirectedPlan(short,source).beats).toHaveLength(1);
});
it('does not guess missing word anchors or change another template',()=>{
 const missing={...plan,beats:[{...plan.beats[0],graphics:{nodes:[{label:'Participation',shape:'box' as const,x:50,y:50}],links:[]}}]};
 expect(timeDirectedPlan(missing,source).beats).toEqual(missing.beats);
 const other={...plan,templateId:'glass-cards' as const};expect(timeDirectedPlan(other,source)).toBe(other);
});
it('leaves unsupported values for factual validation rather than fabricating support',()=>{
 const unsupported={...plan,beats:[{...plan.beats[0],graphics:{nodes:[{...plan.beats[0].graphics!.nodes[0],label:'60000 people',revealWord:0}],links:[]}}]};
 expect(timeDirectedPlan(unsupported,source).beats[0].graphics!.nodes[0].revealWord).toBe(0);
});
it('retains source qualifiers and places them before currency',()=>{
 const raw={...plan,beats:[{...plan.beats[0],headline:'Participants and pay',graphics:{nodes:[{...plan.beats[0].graphics!.nodes[0],label:'35,000 people'},{...plan.beats[0].graphics!.nodes[0],label:'$30 / hour',revealWord:9}],links:[]}}]};
 const fixed=timeDirectedPlan(raw,source),nodes=fixed.beats.at(-1)!.graphics!.nodes;
 expect(nodes[0].label).toBe('over 35,000 people');expect(nodes[1].label).toBe('up to $30 / hour');
});
it('orders search interactions by speech while preserving their relationships',()=>{
 const raw={...plan,beats:[{...plan.beats[0],scene:'search' as const,headline:'Next step',graphics:{nodes:[{label:'Outcome',shape:'box' as const,x:50,y:50,revealWord:9},{label:'Query',shape:'box' as const,x:50,y:50,revealWord:0}],links:[{from:1,to:0}]}}]};
 const fixed=timeDirectedPlan(raw,source);
 expect(fixed.beats[0].graphics!.nodes.map(n=>n.label)).toEqual(['Query','Outcome']);
 expect(fixed.beats[0].graphics!.links).toEqual([{from:0,to:1}]);
});
it('orders independent examples by their word anchors without adding causal links',()=>{
 const raw={...plan,beats:[{...plan.beats[0],scene:'document' as const,headline:'Examples',graphics:{nodes:[{label:'Later example',shape:'box' as const,x:50,y:50,revealWord:9},{label:'First example',shape:'box' as const,x:50,y:50,revealWord:0}],links:[]}}]};
 const fixed=timeDirectedPlan(raw,source);
 expect(fixed.beats[0].graphics!.nodes.map(n=>n.label)).toEqual(['First example','Later example']);
 expect(fixed.beats[0].graphics!.links).toEqual([]);
});
