import {describe,it,expect} from 'vitest';
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
describe('Glass Cards rendering',()=>{
 it.each(['9:16','16:9'] as const)('routes %s to glass with safe text and optional captions',aspectRatio=>{
 const plan={...templateSample('glass-cards'),aspectRatio};plan.beats[0].headline='<script>alert(1)</script>';
 const html=hyperframesProject(templateSampleSource,plan,{...defaultEditBrand,captionStyle:'none'});
 expect(html).toContain('backdrop-filter:blur(34px)');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>alert(1)');expect(html).toContain("'none'!=='none'");expect(html).toContain('source.mp4');
 });
 it('retains presenter-only breathing room and word anchors',()=>{
 const plan=templateSample('glass-cards');plan.beats[0].visual='presenter';
 const html=hyperframesProject(templateSampleSource,plan,defaultEditBrand,true);
 expect(html).toContain('data-presenter="true"');expect(html).toContain('data-reveal="2.5"');expect(html).toContain('vektiss-seek');
 });
});
