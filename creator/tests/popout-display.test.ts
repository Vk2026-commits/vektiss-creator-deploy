import {it,expect} from 'vitest';
import {popoutDisplayPlan,popoutTitle} from '../src/domain/popout-display';
import {templateSample} from '../src/domain/edit-template-samples';
it('rejoins compiler lead-ins without changing graphic anchors or complete text',()=>{
 const p=templateSample('popout-explainer');p.beats[0].headline=p.beats[1].headline='Complete idea with 35,000 participants';p.beats[0].graphics={nodes:[],links:[]};
 const out=popoutDisplayPlan(p);
 expect(out.beats).toHaveLength(1);expect(out.beats[0].firstWord).toBe(0);expect(out.beats[0].graphics).toEqual(p.beats[1].graphics);expect(out.beats[0].headline).toContain('35,000');
});
it('uses the complete approved CTA instead of a transcript fragment',()=>{
 const beat=templateSample('popout-explainer').beats[0];beat.headline="Comment 'income' for a free assessment";
 expect(popoutTitle(beat)).toEqual({headline:'Comment INCOME',support:'Free assessment'});
});
it('does not discard graphics accidentally labeled presenter-only',()=>{
 const p=templateSample('popout-explainer');p.beats[0].visual='presenter';
 expect(popoutDisplayPlan(p).beats[0].graphics).toEqual(p.beats[0].graphics);expect(popoutDisplayPlan(p).beats[0].visual).toBe('diagram');
});
