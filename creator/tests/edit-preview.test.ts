import {it,expect} from 'vitest';
import {rankingPreviewCuts,previewDuration,previewHtml} from '../src/domain/edit-preview';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {rankingProject} from '../src/domain/ranking-project';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {runInNewContext} from 'node:vm';
it('samples opening, first reveal and completed board in at most nine seconds',()=>{
 const source={...templateSampleSource,duration:70,words:templateSampleSource.words.map(w=>({...w,start:w.start*12,end:w.end*12}))};
 const cuts=rankingPreviewCuts(source,templateSample('tier-list'));
 expect(cuts).toEqual([{sourceStart:0,sourceEnd:3,outputStart:0,speed:1},{sourceStart:5,sourceEnd:8,outputStart:3,speed:1},{sourceStart:42.5,sourceEnd:45.5,outputStart:6,speed:1}]);
 expect(previewDuration(cuts)).toBe(9);
 const html=previewHtml(rankingProject(source,templateSample('tier-list'),defaultEditBrand),1080,1920,cuts);
 const times:number[]=[];const timeline={seek:(t:number)=>times.push(t),duration:()=>70};
 runInNewContext(html.match(/<script>(\{const cuts=.*?)<\/script>/s)![1],{window:{__timelines:{vektiss:timeline}}});
 timeline.seek(3);timeline.seek(6);timeline.seek(9);
 expect(times).toEqual([0,5,42.5,45.5-1/30]);expect(timeline.duration()).toBe(9);
 expect(html).toContain('data-width="540"');expect(html).toContain('data-height="960"');expect(html).toContain('width:1080px!important');expect(html).toContain('data-duration="9"');
});
it('merges overlapping samples and never exceeds short footage',()=>{
 const cuts=rankingPreviewCuts(templateSampleSource,templateSample('tier-list'));
 expect(cuts).toEqual([{sourceStart:0,sourceEnd:5,outputStart:0,speed:1}]);
 expect(previewDuration(rankingPreviewCuts({...templateSampleSource,duration:1},templateSample('tier-list')))).toBe(1);
});
it('full preview keeps the original clock and duration',()=>{
 const html=previewHtml(rankingProject(templateSampleSource,templateSample('tier-list'),defaultEditBrand),1920,1080);
 expect(html).toContain('data-width="960"');expect(html).toContain('data-duration="5"');expect(html).not.toContain('originalSeek');
});
