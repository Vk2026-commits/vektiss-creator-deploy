import {describe,it,expect} from 'vitest';
import {contentInputSchema,emptyContent,explainError,audienceAnswerLimit} from '../src/domain/strategy';
import {researchBriefSchema} from '../src/domain/research';

describe('guided audience answers',()=>{
 const profile={...emptyContent,name:'Credit education',primary_audience:'First-time buyers'};
 it('preserves full paragraphs in every open-ended strategy answer',()=>{
  const prose='A detailed answer about helping people understand their options. '.repeat(20).trim();
  const keys=['audience_problems','audience_interests','content_pillars','source_topics','reaction_angles','desired_outcomes','tone','things_to_avoid','preferred_ctas'] as const;
  const input={...profile,strategy:{...profile.strategy}};
  for(const key of keys)input.strategy[key]=[prose];
  expect(contentInputSchema.parse(input)).toEqual(input);
 });
 it('accepts the form limit and old short lists',()=>{
  expect(contentInputSchema.safeParse({...profile,strategy:{...profile.strategy,tone:['x'.repeat(audienceAnswerLimit)]}}).success).toBe(true);
  expect(contentInputSchema.safeParse({...profile,strategy:{...profile.strategy,tone:['Calm','Direct']}}).success).toBe(true);
 });
 it('keeps bounded answers and gives field-specific errors, not JSON',()=>{
  const result=contentInputSchema.safeParse({...profile,strategy:{...profile.strategy,tone:['x'.repeat(audienceAnswerLimit+1)]}});
  expect(result.success).toBe(false);
  if(!result.success){expect(explainError(result.error)).toContain('Tone:');expect(explainError(result.error)).not.toContain('"code"');}
 });
 it('does not expose backend error messages',()=>{
  expect(explainError(new Error('internal database details'))).not.toContain('database');
 });
 it('Discover accepts the same full saved answers for videos and articles',()=>{
  const fields=['audienceProblems','audienceInterests','contentPillars','sourceTopics','reactionAngles','desiredOutcomes','profileTone','thingsToAvoid'] as const;
  for(const field of fields){
   const schema=researchBriefSchema.shape[field];
   const answer=['Credit education and practical next steps. '.repeat(60).trim()];
   expect(schema.parse(answer)).toEqual(answer);
   expect(schema.safeParse(['x'.repeat(audienceAnswerLimit)]).success).toBe(true);
   expect(schema.safeParse(['x'.repeat(audienceAnswerLimit+1)]).success).toBe(false);
  }
  expect(researchBriefSchema.shape.creatorTone.safeParse(['x'.repeat(161)]).success).toBe(false);
 });
});
