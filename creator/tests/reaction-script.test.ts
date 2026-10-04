import {expect,it} from 'vitest';
import {normalizeReactionDraft,reactionDirection,reactionIssues,reactionEvidence} from '../src/domain/reaction-script';
it('spells emergency calls for Stephen without duplicating existing hyphens',()=>{
 const d=normalizeReactionDraft({hook:'I agree with calling 911.',body:'Call 911. Already 9-1-1. Reference 1911 stays.',cta:'',review:'Original says 911.'});
 expect(d.hook).toBe('I agree with calling 9-1-1.');expect(d.body).toBe('Call 9-1-1. Already 9-1-1. Reference 1911 stays.');expect(d.review).toBe('Original says 911.');expect(normalizeReactionDraft(d)).toEqual(d);
});
it('does not feed old editorial commentary into the next generation',()=>{
 const brief={source:'Observed action',notes:'',questions:[],review:'Old uncertainty essay',source_summary:'Old summary'};
 expect(reactionEvidence(brief)).toEqual({source:'Observed action',creatorNotes:'',creatorAnswers:[]});
 expect(reactionIssues({hook:"I admire his intentions.",body:'A takeaway.'})).toContain('Judge the observed action, not an assumed intention or motive.');
});
it('rejects the actual vague opening and essay wording',()=>{
 expect(reactionIssues({hook:"It's difficult to fully support these kinds of interactions without knowing more details.",body:'Here we see a situation with layers of uncertainty.'}).length).toBeGreaterThan(0);
 expect(reactionIssues({hook:'I respect that she created distance.',body:'Keep moving toward staff who can help.'})).toEqual([]);
 expect(reactionIssues({hook:'I disagree with chasing him over a phone.',body:'Create distance and report it instead.'})).toEqual([]);
});
it('keeps the closing only once, in the CTA',()=>{
 const draft=normalizeReactionDraft({hook:'**A reaction.**',body:'A useful takeaway. Stay alert. Stay safe.',cta:'Stay alert. Stay safe. Stay alert. Stay safe.',review:'Check evidence.'});
 expect(draft.hook).toBe('A reaction.');expect(draft.body).toBe('A useful takeaway.');expect(draft.cta).toBe('Stay alert. Stay safe.');
 expect(normalizeReactionDraft(draft)).toEqual(draft);
});
it('preserves an explicitly supplied CTA and source-review notes',()=>{
 const d=normalizeReactionDraft({hook:'A position',body:'A reason',cta:'Save this. Stay alert! Stay safe!',review:'Context unknown.'});
 expect(d.cta).toBe('Save this. Stay alert. Stay safe.');expect(d.review).toBe('Context unknown.');
});
it('requires reaction structure without turning uncertainty into danger',()=>{
 expect(reactionDirection).toContain('not a source summary');expect(reactionDirection).toContain('Never treat unclear context');
});
it('uses the updated playbook and a single mid-script guide mention',()=>{
 expect(reactionDirection).toContain('IN THE MIDDLE of body');
 expect(reactionDirection).toContain('then return to practical guidance');
 expect(reactionDirection).toContain('2–3 concrete');
 expect(reactionDirection).toContain('Teach prevention before confrontation');
 expect(reactionDirection).not.toContain('No promotional pitch unless');
});
