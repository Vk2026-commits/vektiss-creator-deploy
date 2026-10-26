import {expect,it} from 'vitest';
import {checkRenderApproval,templateRenderRequest} from '../server/template-render';
it('requires preview approval for the exact saved version',()=>{
 const input={id:'a'.repeat(64),version:2,mode:'final' as const,approvePreview:true as const};
 expect(()=>checkRenderApproval(input,{version:2},null)).toThrow('Preview');
 expect(()=>checkRenderApproval(input,{version:2},{version:1})).toThrow('Preview');
 expect(()=>checkRenderApproval({...input,approvePreview:undefined},{version:2},{version:2})).toThrow('Preview');
 expect(()=>checkRenderApproval(input,{version:3},{version:2})).toThrow('changed');
 expect(()=>checkRenderApproval(input,{version:2},{version:2})).not.toThrow();
});
it('does not allow source paths, executable code, or alternate render destinations',()=>{
 for(const field of ['sourceFile','output','code'])expect(()=>templateRenderRequest.parse({id:'a'.repeat(64),version:1,mode:'preview',[field]:'/tmp/anything'})).toThrow();
});
