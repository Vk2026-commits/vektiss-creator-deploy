import {describe,expect,it} from 'vitest';
import {emptyCreator} from '../src/domain/strategy';
import {suggestedProfileExamples} from '../src/domain/profile-suggestions';

describe('audience profile examples',()=>{
  it('keeps safety creator examples relevant to safety across the questionnaire',()=>{
    const creator={...emptyCreator,display_name:'Stephen Taylor',context:{...emptyCreator.context,
      expertise:'Private security and situational awareness',experience:'Teaching women practical safety skills'}};
    const questions=['name','primary_audience','content_pillars','audience_problems','source_topics',
      'reaction_angles','tone','things_to_avoid','desired_outcomes','cta'] as const;
    for(const question of questions){
      const examples=suggestedProfileExamples(question,creator);
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.join(' ')).not.toMatch(/credit|mortgage|budget|money/i);
    }
    expect(suggestedProfileExamples('name',creator)).toContain('Everyday safety with Stephen');
  });

  it('adapts to finance creators without leaking safety examples',()=>{
    const creator={...emptyCreator,display_name:'Rose',context:{...emptyCreator.context,
      expertise:'Credit education and mortgage lending'}};
    expect(suggestedProfileExamples('source_topics',creator).join(' ')).toMatch(/credit|money/i);
    expect(suggestedProfileExamples('name',creator).join(' ')).not.toMatch(/safety|security/i);
  });

  it('uses the creator experience for unfamiliar specialties rather than a fixed industry list',()=>{
    const creator={...emptyCreator,display_name:'Alex',context:{...emptyCreator.context,
      experience:'Urban gardening and native plants'}};
    expect(suggestedProfileExamples('name',creator).join(' ')).toContain('gardening');
    expect(suggestedProfileExamples('source_topics',creator).join(' ')).toContain('gardening');
  });
});
