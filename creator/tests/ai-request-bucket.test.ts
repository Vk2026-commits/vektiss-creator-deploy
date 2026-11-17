import {it,expect} from 'vitest';
import {aiRequestBucket} from '../src/domain/ai-request-bucket';
it('isolates source processing from explicit writing',()=>{
 for(const action of ['video-analysis','video-boundary','graphic-analysis','story-alignment','transcribe'])expect(aiRequestBucket(true,action)).toBe('analysis');
 for(const action of ['edit-plan','edit-illustration'])expect(aiRequestBucket(true,action)).toBe('writing');
 expect(aiRequestBucket(false,'generate')).toBe('writing');
});
