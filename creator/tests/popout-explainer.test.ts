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
 it('hides the timed matte in presenter and full-graphic scenes',()=>{
  const base=templateSample('popout-explainer'),beat=base.beats[0];
  const plan={...base,beats:[{...beat,firstWord:0,lastWord:1,visual:'presenter' as const,layout:'presenter' as const,graphics:{nodes:[],links:[]}},{...beat,firstWord:2,lastWord:4,graphics:{nodes:[],links:[]}},{...beat,firstWord:5,lastWord:6,layout:'full-graphic' as const,graphics:{nodes:[],links:[]}},{...beat,firstWord:7,lastWord:9,graphics:{nodes:[],links:[]}}]};
  const html=popoutExplainerProject(templateSampleSource,plan,defaultEditBrand);
  expect(html).toContain('#stage[data-mode="presenter"] #cutout-layer,#stage[data-mode="full"] #cutout-layer{display:none}');
  expect(html).toContain('#stage[data-mode="full"] #room-layer{display:none}');
  expect(html).toContain('[data-full="true"]{background:');
  if(process.env.POPOUT_PROOF)writeFileSync(process.env.POPOUT_PROOF+'/mixed.html',html);
 });
 it('escapes model text' ,()=>{const plan=templateSample('popout-explainer');plan.beats[0].headline='<script>alert(1)</script>';const html=popoutExplainerProject(templateSampleSource,plan,defaultEditBrand);expect(html).not.toContain('<script>alert(1)</script>');expect(html).toContain('&lt;script&gt;');});
 it('uses approved words for editorial headline emphasis without adding a second presenter',()=>{
  const plan=templateSample('popout-explainer');
  plan.beats[0].headline='A thought becomes a video';
  const html=popoutExplainerProject(templateSampleSource,plan,defaultEditBrand);
  expect(html).toContain('<span>A thought</span> <em>becomes a video</em>');
  expect(html).toContain('THE BIG PICTURE');
  expect((html.match(/id="presenter"/g)??[])).toHaveLength(1);
  expect((html.match(/id="cutout"/g)??[])).toHaveLength(1);
  expect(html).toContain('#stage[data-mode="full"] #room-layer{display:none}');
  expect(html).toContain('[data-full="true"]{background:');
  expect(html).toContain('font-family:Georgia');
 });
 it('scales long approved headlines and retains graphics/caption safe areas',()=>{
  const plan=templateSample('popout-explainer');
  plan.beats[0].headline='Practical skills and experience can help people discover useful opportunities with AI';
  const html=popoutExplainerProject(templateSampleSource,plan,defaultEditBrand);
  expect(html).toContain('--headline-size:54px');
  expect(html).toContain('height:29%');
  expect(html).toContain('#captions{z-index:5;bottom:5%');
  expect(html).not.toContain('font-size:NaN');
 });

});
