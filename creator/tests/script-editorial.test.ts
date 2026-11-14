import {describe,it,expect} from 'vitest';
import {briefSchema,emptyBrief} from '../src/domain/script-brief';
import {withCurrentDraft,completeRevision} from '../src/domain/script-editorial';
import {reactionEvidence} from '../src/domain/reaction-script';
describe('saved script feedback',()=>{
 it('round trips references and pending feedback without changing source',()=>{
 const brief=briefSchema.parse({...emptyBrief(),source:'Consulting article',reference_script:'Microsoft example',revision_request:'Use its reasoning, not its subject'});
 expect(brief.reference_script).toBe('Microsoft example');
 expect(brief.source).toBe('Consulting article');
 expect(briefSchema.parse(JSON.parse(JSON.stringify(brief)))).toEqual(brief);
 });
 it('sends current wording and feedback even through safety profile context',()=>{
 const brief=withCurrentDraft({...emptyBrief(),reference_script:'Example',revision_request:'Shorter',revision_history:['Use plain language']},{hook:'Hook',body:'Edited body',cta:'Selected offer'});
 expect(reactionEvidence(brief)).toMatchObject({reference_script:'Example',revision_request:'Shorter',current_draft:{body:'Edited body'},revision_history:['Use plain language']});
 expect(brief.revision_request).toBe('Shorter');
 });
 it('consumes feedback only in successful completion, retaining bounded history',()=>{
 const pending={...emptyBrief(),revision_request:'Latest',revision_history:Array.from({length:8},(_,i)=>String(i))};
 const completed=completeRevision(pending);
 expect(pending.revision_request).toBe('Latest');
 expect(completed.revision_request).toBeUndefined();
 expect(completed.revision_history).toEqual(['1','2','3','4','5','6','7','Latest']);
 });
});
