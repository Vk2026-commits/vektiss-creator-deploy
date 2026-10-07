import {describe,it,expect} from 'vitest';
import {applyProfileProposal,profileProposalSchema,type ProfileProposal} from '../src/domain/profile-edit';
import {emptyContent,contentInputSchema} from '../src/domain/strategy';
import {ctaInstruction,ctaSchema} from '../src/domain/cta';
const cta={text:'Comment GUIDE for my checklist.',keyword:'GUIDE',offer:'My checklist',delivery:'I will send it manually by DM.'};
const profile={...emptyContent,name:'Steve',primary_audience:'Women seeking safety information',strategy:{...emptyContent.strategy,research_screening_criteria:'Preserve specialist guidance',research_source_platforms:['instagram'],research_reference_urls:['https://example.com']},cta_default:{...cta,text:'Follow for safety tips.'}};
const base:ProfileProposal={summary:'Change CTA',question:'',changes:[],scope:'none',count:null,cta:null};
describe('audience CTA edits',()=>{
 it('temporary CTA preserves default and specialist research fields',()=>{const next=applyProfileProposal(profile,{...base,scope:'next',count:5,cta});expect(next.cta_campaign?.limit).toBe(5);expect(next.cta_default).toEqual(profile.cta_default);expect(next.strategy).toEqual(profile.strategy);expect(profile.cta_default.text).toBe('Follow for safety tips.');});
 it('default replaces default and stops temporary campaign',()=>{const next=applyProfileProposal({...profile,cta_campaign:{id:crypto.randomUUID(),limit:5,cta}},{...base,scope:'default',cta});expect(next.cta_campaign).toBeNull();expect(next.cta_default).toEqual(cta);});
 it('cancel preserves default',()=>{expect(applyProfileProposal(profile,{...base,scope:'cancel'}).cta_default).toEqual(profile.cta_default);});
 it('cannot apply unanswered clarifications or uncounted campaigns',()=>{expect(()=>applyProfileProposal(profile,{...base,question:'How many?'})).toThrow();expect(()=>applyProfileProposal(profile,{...base,scope:'next',cta})).toThrow();});
 it('ignores metadata when editing a loaded profile',()=>{const loaded={...profile,id:crypto.randomUUID(),user_id:crypto.randomUUID()};expect(contentInputSchema.safeParse(applyProfileProposal(loaded,base)).success).toBe(true);});
 it('edits only requested fields',()=>{const next=applyProfileProposal(profile,{...base,changes:[{field:'tone',value:'Calm\nDirect'}]});expect(next.strategy.tone).toEqual(['Calm','Direct']);expect(next.primary_audience).toBe(profile.primary_audience);});
 it('rejects excessive campaign limits and unknown fields',()=>{expect(profileProposalSchema.safeParse({...base,scope:'next',count:101,cta}).success).toBe(false);expect(profileProposalSchema.safeParse({...base,changes:[{field:'user_id',value:'x'}]}).success).toBe(false);});
 it('empty historic CTA keeps existing instructions untouched',()=>{expect(ctaInstruction(undefined)).toBe('');expect(contentInputSchema.parse(profile).strategy.research_reference_urls).toEqual(['https://example.com']);});
 it('explicit CTA takes priority without implying delivery automation',()=>{const instruction=ctaInstruction({cta,scope:'campaign',campaign_id:crypto.randomUUID()});expect(instruction).toContain('sole promotional CTA');expect(instruction).toContain('Do not promise automatic delivery');expect(instruction).toContain('GUIDE');});
 it('rejects blank CTA',()=>{expect(ctaSchema.safeParse({...cta,text:''}).success).toBe(false);});
});
