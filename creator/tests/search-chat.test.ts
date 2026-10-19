import {expect,it} from 'vitest';
import {applySearchProposal,initialSearchSettings,searchChatProposalSchema} from '../src/domain/search-chat';
import {defaultSearchQuality} from '../src/domain/search-quality';
it('patches only proposed settings and preserves platform availability and other rules',()=>{
 const before={...defaultSearchQuality,seekSituations:'Safety',avoidTopics:'News'};
 expect(applySearchProposal(before,{summary:'Prefer Instagram',question:'',changes:{screeningCriteria:'Prefer Instagram'}})).toEqual({...before,screeningCriteria:'Prefer Instagram'});
 expect(()=>applySearchProposal(before,{summary:'Ask',question:'Which profile?',changes:{}})).toThrow('CLARIFICATION_REQUIRED');
 expect(()=>applySearchProposal(before,{summary:'None',question:'',changes:{}})).toThrow('NO_CHANGES');
 expect(searchChatProposalSchema.safeParse({summary:'Bad',question:'',changes:{user_id:'other'}}).success).toBe(false);
 expect(searchChatProposalSchema.safeParse({summary:'Bad',question:'',changes:{platforms:[]}}).success).toBe(false);
 expect(initialSearchSettings({research_screening_criteria:'Original clips'}).screeningCriteria).toBe('Original clips');
});
