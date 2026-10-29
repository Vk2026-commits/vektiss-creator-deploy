import {it,expect} from 'vitest';
import {assertDirectedPlanQuality} from '../src/domain/edit-plan-quality';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
it('blocks unsupported large figures instead of silently rewriting a claim',()=>{
 const plan=templateSample('popout-explainer');plan.beats[0].headline='60000 participants';
 expect(()=>assertDirectedPlanQuality(plan,templateSampleSource)).toThrow('EDIT_UNSUPPORTED_FIGURE');
 const source={...templateSampleSource,words:templateSampleSource.words.map((w,i)=>({...w,text:i===0?'60':i===1?'000':w.text}))};
 expect(()=>assertDirectedPlanQuality(plan,source)).not.toThrow();
});
it('rejects a long static explanation without imposing a scene count',()=>{
 const plan=templateSample('popout-explainer');
 const source={...templateSampleSource,duration:60,words:templateSampleSource.words.map(w=>({...w,start:w.start*10,end:w.end*10}))};
 expect(()=>assertDirectedPlanQuality(plan,source)).toThrow('EDIT_UNDERDIRECTED_SCENE');
});
