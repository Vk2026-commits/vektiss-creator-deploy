import {it,expect} from 'vitest';
import candidate from './fixtures/ranking-boundary-candidate.json';
import words from './fixtures/ranking-boundary-words.json';
import {repairEditPlan} from '../src/domain/edit-plan-repair';
const source={kind:'avatar' as const,assetId:'00000000-0000-4000-8000-000000000001',revision:candidate.sourceRevision,duration:words.length,words:words.map((text,i)=>({text,start:i,end:i+1}))};
it('recovers the cached ranking without losing speech, labels, tiers or CTA',()=>{
 const p=repairEditPlan(candidate,source,'tier-list');
 const nodes=p.beats[0].graphics!.nodes;
 expect(nodes.map(n=>[n.label,n.tier])).toEqual(candidate.beats[0].graphics.nodes.map(n=>[n.label,n.tier]));
 expect(nodes.map(n=>n.revealWord)).toEqual([31,53,71,94,112]);
 expect(nodes.map(n=>n.introducedWord)).toEqual([29,51,69,92,109]);
 expect(p.beats.map(b=>[b.firstWord,b.lastWord])).toEqual([[0,166],[167,197]]);
 expect(source.words[p.beats[1].firstWord].text).toBe('Comment');
});
it('rejects changed ratings and ambiguous label matches',()=>{
 const p=structuredClone(candidate);p.beats[0].graphics.nodes[0].tier='S';
 expect(()=>repairEditPlan(p,source,'tier-list')).toThrow('EDIT_REVEAL_WORD');
 const repeated={...source,duration:203,words:[...source.words,...['Social','posts','C','tier'].map((text,i)=>({text,start:198+i,end:199+i}))]};
 expect(()=>repairEditPlan(candidate,repeated,'tier-list')).toThrow('EDIT_REVEAL_WORD');
});
it('refuses to guess a closing boundary without an explicit CTA cue',()=>{
 const s={...source,words:source.words.map(w=>w.text==='Comment'?{...w,text:'Imagine'}:w)};
 expect(()=>repairEditPlan(candidate,s,'tier-list')).toThrow('EDIT_REVEAL_WORD');
});
