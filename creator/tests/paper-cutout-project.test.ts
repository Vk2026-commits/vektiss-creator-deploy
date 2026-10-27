import {describe,it,expect} from 'vitest';
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
describe('Paper Cutout export',()=>{
 it.each(['9:16','16:9'] as const)('requires the real alpha asset in %s',aspectRatio=>{
  const html=hyperframesProject(templateSampleSource,{...templateSample('paper-cutout'),aspectRatio},defaultEditBrand);
  expect(html).toContain('src="presenter.webm"');
  expect(html).not.toContain('src="source.mp4"');
  expect(html).toContain('data-has-audio="false"');
  expect(html).toContain('drop-shadow(10px 14px 8px #0003)');
  expect(html).toContain('#captions{z-index:10}');
  expect(html).toContain(aspectRatio==='16:9'?'data-width="1920"':'data-width="1080"');
 });
 it('labels the illustration without pretending an unprocessed video is cut out',()=>{
  const html=hyperframesProject(templateSampleSource,templateSample('paper-cutout'),defaultEditBrand,true);
  expect(html).toContain('SAMPLE PRESENTER');expect(html).not.toContain('src="presenter.webm"');
 });
});
