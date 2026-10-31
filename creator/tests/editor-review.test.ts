import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewVideo,validateReview} from '../server/editor-review';
const valid={audioAssessed:true,visualsAssessed:true,findings:[],limitations:['Sampled frames']};
it('requires both modalities and timestamps within the media',()=>{
 expect(()=>validateReview({...valid,audioAssessed:false},10)).toThrow();
 expect(()=>validateReview({...valid,findings:[{start:8,end:11,severity:'major',category:'text',observation:'clipped',confidence:.8}]},10)).toThrow();
 expect(validateReview(valid,10)).toEqual(valid);
});
it('caches completed reviews and does not repeat paid calls',async()=>{
 const root=await mkdtemp(join(tmpdir(),'editor-review-'));let calls=0;
 try{const file=join(root,'v.mp4');await writeFile(file,'test fixture');
 const fetcher=(async()=>{calls++;return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(valid)}]}}]}));}) as typeof fetch;
 const args={root,file,duration:10,key:'test-only',model:'test-model',fetcher};
 expect((await reviewVideo(args)).status).toBe('no_findings');await reviewVideo(args);expect(calls).toBe(1);
 }finally{await rm(root,{recursive:true,force:true});}
});
it('keeps failed review incomplete and prevents an uncertain paid retry',async()=>{
 const root=await mkdtemp(join(tmpdir(),'editor-review-'));let calls=0;
 try{const file=join(root,'v.mp4');await writeFile(file,'test fixture');
 const fetcher=(async()=>{calls++;throw Error('timeout with private details');}) as typeof fetch;
 const args={root,file,duration:10,key:'test-only',model:'test-model',fetcher};
 const report=await reviewVideo(args);expect(report.status).toBe('review_incomplete');expect(report.reason).not.toContain('private');
 await reviewVideo(args);expect(calls).toBe(1);
 }finally{await rm(root,{recursive:true,force:true});}
});
