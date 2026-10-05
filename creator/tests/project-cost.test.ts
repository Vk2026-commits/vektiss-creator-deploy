import {it,expect} from 'vitest';
import {openAICost,usageSummary,type ProcessingUsage} from '../src/domain/project-cost';
it('prices recorded tokens including cached input and editorial rewrites',()=>{
 expect(openAICost('gpt-4.1-2025-04-14',{prompt_tokens:2839,prompt_tokens_details:{cached_tokens:1920},completion_tokens:302})).toBeCloseTo(.005214,9);
 expect(openAICost('gpt-4o-mini',{initial:{prompt_tokens:1000,completion_tokens:100},rewrite:{prompt_tokens:2000,completion_tokens:200}})).toBeCloseTo(.00063,9);
 expect(openAICost('gpt-4o-mini-transcribe',{input_tokens:898,output_tokens:326})).toBeCloseTo(.0027525,9);
});
it('never invents a zero cost for unknown model or missing usage',()=>{
 for(const [model,usage] of [['gpt-4.1-mini',{prompt_tokens:100,completion_tokens:10}],['gpt-4o-mini',null],['gpt-4o-mini',{}],['gpt-4o-mini',{prompt_tokens:1,completion_tokens:1,prompt_tokens_details:{cached_tokens:2}}]] as const)expect(openAICost(model,usage)).toBeNull();
 expect(openAICost('gpt-4o-mini',{prompt_tokens:0,completion_tokens:0})).toBe(0);
});
it('counts explicit retries, failures and unique retained media without double counting',()=>{
 const first:ProcessingUsage={id:'1',project_id:'p',operation:'source',status:'failed',elapsed_ms:1000,retained_bytes:50,upload_bytes:20,assets:[{key:'source',bytes:50}],started_at:'2026-01-01'};
 const second={...first,id:'2',retry_of:'1',status:'done',assets:[{key:'source',bytes:50},{key:'final',bytes:100}],started_at:'2026-01-02'};
 expect(usageSummary([first,second])).toEqual({seconds:2,failures:1,retries:1,repeatAttempts:1,bytes:150,uploadBytes:40});
});
