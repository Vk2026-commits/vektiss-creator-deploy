import {expect,it} from 'vitest';
import {applySearchProposal,initialSearchSettings,searchChatProposalSchema,saveSearchInstructions} from '../src/domain/search-chat';
import {defaultSearchQuality} from '../src/domain/search-quality';
it('patches only proposed settings and preserves platform availability and other rules',()=>{
 const before={...defaultSearchQuality,seekSituations:'Safety',avoidTopics:'News'};
 expect(applySearchProposal(before,{summary:'Prefer Instagram',question:'',changes:{screeningCriteria:'Prefer Instagram'}})).toEqual({...before,screeningCriteria:'Prefer Instagram'});
 expect(()=>applySearchProposal(before,{summary:'Ask',question:'Which profile?',changes:{}})).toThrow('NO_CHANGES');
 expect(applySearchProposal(before,{summary:'Change',question:'More examples?',changes:{avoidTopics:'Staged'}}).avoidTopics).toBe('Staged');
 expect(saveSearchInstructions({...before,screeningCriteria:'Existing'},'Visible action')).toEqual({...before,screeningCriteria:'Existing\n\nVisible action'});
 expect(()=>applySearchProposal(before,{summary:'None',question:'',changes:{}})).toThrow('NO_CHANGES');
 expect(searchChatProposalSchema.safeParse({summary:'Bad',question:'',changes:{user_id:'other'}}).success).toBe(false);
 expect(searchChatProposalSchema.safeParse({summary:'Bad',question:'',changes:{platforms:[]}}).success).toBe(false);
 expect(initialSearchSettings({research_screening_criteria:'Original clips'}).screeningCriteria).toBe('Original clips');
});
