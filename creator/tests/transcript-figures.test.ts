import {expect,it} from 'vitest';
import {transcriptFigures} from '../src/domain/transcript-figures';
import {assertDirectedPlanQuality} from '../src/domain/edit-plan-quality';
const source=(text:string,transcriptText?:string)=>({assetId:'00000000-0000-4000-8000-000000000001',revision:'test',kind:'upload' as const,duration:10,transcriptText,words:text.split(' ').map((text,i)=>({text,start:i*.2,end:i*.2+.1}))});
it('recovers a split decimal only from matching verbatim evidence and anchors its final digit',()=>{
 const s=source('from 16 1 to 18 5','From 16.1% to 18.5.');
 expect(transcriptFigures(s).map(f=>[f.value,f.lastWord])).toEqual([[16.1,2],[18.5,5]]);
});
it('does not infer decimals without evidence or trust mismatched text',()=>{
 expect(transcriptFigures(source('from 16 1 to 18 5')).map(f=>f.value)).toEqual([16,18]);
 expect(transcriptFigures(source('from 16 1 to 18 5','Different 18.5')).map(f=>f.value)).toEqual([16,18]);
});
it('still rejects a genuinely unsupported figure',()=>{
 const s=source('from 16 1 to 18 5','From 16.1% to 18.5.');
 expect(()=>assertDirectedPlanQuality({templateId:'popout-explainer',beats:[{headline:'19.5%',firstWord:0,lastWord:5,visual:'typography'}]} as any,s)).toThrow('EDIT_UNSUPPORTED_FIGURE');
});
