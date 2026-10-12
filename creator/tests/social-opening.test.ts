import {expect,it} from 'vitest';
import {socialOpeningIssues,socialOpeningInstruction} from '../src/domain/social-opening';
it.each(['Today, I want to talk about a tool.','Today we are going to discuss AI.','Let’s dive into this news.','In this video, I explain automation.',"I'm going to tell you about OpenAI."])('rejects presentation setup: %s',body=>{
 expect(socialOpeningIssues({hook:'Still doing this manually?',body})).not.toHaveLength(0);
});
it.each(['OpenAI announced a new way to delegate recurring work.','That checkout asks the customer to enter the same information twice.','Which credit score is your lender actually using?'])('accepts direct reactions: %s',body=>{
 expect(socialOpeningIssues({hook:'Check this before you decide.',body})).toEqual([]);
});
it('rejects formatting and instructs evidence-grounded, creator-specific reactions',()=>{
 expect(socialOpeningIssues({hook:'News',body:'OpenAI launched **Dots**.'})).not.toHaveLength(0);
 expect(socialOpeningInstruction).toContain('unless the source warrants');
 expect(socialOpeningInstruction).toContain('approved delivery preferences');
});
