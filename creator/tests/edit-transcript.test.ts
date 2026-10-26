import {expect,it} from 'vitest';
import {editTranscriptWords} from '../server/edit-transcript';
import {editSourceSchema} from '../src/domain/edit-templates';
it('preserves every word while repairing small overlaps and zero-duration timestamps',()=>{
 const words=editTranscriptWords({words:[{word:'One',start:0,end:.5},{word:'two',start:.48,end:.48},{word:'three',start:.5,end:1.01}]},1);
 expect(words.map(w=>w.text)).toEqual(['One','two','three']);
 expect(()=>editSourceSchema.parse({assetId:'00000000-0000-4000-8000-000000000001',revision:'test',kind:'upload',duration:1,words})).not.toThrow();
});
it('rejects materially broken timing instead of fabricating or dropping speech',()=>{
 expect(()=>editTranscriptWords({words:[{word:'One',start:0,end:1},{word:'two',start:.1,end:.2}]},2)).toThrow();
 expect(()=>editTranscriptWords({words:[{word:'One',start:4,end:5}]},2)).toThrow();
 expect(()=>editTranscriptWords({words:[]},2)).toThrow();
});
