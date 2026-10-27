import {describe,it,expect} from 'vitest';
import {popoutExplainerProject} from '../src/domain/popout-explainer-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {writeFileSync,mkdirSync} from 'node:fs';
describe('pop-out explainer',()=>{
 for(const aspectRatio of ['9:16','16:9'] as const)it(`keeps aligned room and alpha layers in ${aspectRatio}`,()=>{
  const plan={...templateSample('popout-explainer'),aspectRatio};
  const html=popoutExplainerProject(templateSampleSource,plan,{...defaultEditBrand,captionStyle:'none'});
  expect(html).toContain('src="source.mp4"');expect(html).toContain('src="presenter.webm"');
  expect(html).toContain('clip-path:inset(26% 0 0 round 30px)');
  expect(html).toContain('data-kind="document"');expect(html).toContain('dataset.mode=');
  expect(html).toContain('data-has-audio="false"');
  if(process.env.POPOUT_PROOF){mkdirSync(process.env.POPOUT_PROOF,{recursive:true});writeFileSync(process.env.POPOUT_PROOF+`/${aspectRatio==='9:16'?'index':'wide'}.html`,html);}
 });
 it('escapes model text',()=>{const plan=templateSample('popout-explainer');plan.beats[0].headline='<script>alert(1)</script>';const html=popoutExplainerProject(templateSampleSource,plan,defaultEditBrand);expect(html).not.toContain('<script>alert(1)</script>');expect(html).toContain('&lt;script&gt;');});
});
