import {describe,it,expect} from 'vitest';
import {popoutExplainerProject,popoutMotionState} from '../src/domain/popout-explainer-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {writeFileSync,mkdirSync} from 'node:fs';
describe('pop-out explainer',()=>{
 for(const aspectRatio of ['9:16','16:9'] as const)it(`keeps aligned room and alpha layers in ${aspectRatio}`,()=>{
  const plan={...templateSample('popout-explainer'),aspectRatio};
  const html=popoutExplainerProject(templateSampleSource,plan,{...defaultEditBrand,captionStyle:'none'});
  expect(html).toContain('src="source.mp4"');expect(html).toContain('src="presenter.webm"');
  expect(html).toContain('clip-path:inset(26% 0 0 round 30px)');
  expect(html).toContain('data-kind="search"');expect(html).toContain('dataset.mode=');
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
  expect(html).toContain('<span class="headline-lead">A thought</span></span> <span class="headline-mask"><em>becomes a video</em>');
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
  expect(html).toContain('height:32%');
  expect(html).toContain('#captions{z-index:7;bottom:5%');
  expect(html).not.toContain('font-size:NaN');
 });

});

it('uses the same reference scene library for previews and exported video',()=>{
 const plan=templateSample('popout-explainer');
 for(const sample of [true,false]){
  const html=popoutExplainerProject(templateSampleSource,plan,defaultEditBrand,sample);
  expect(html).toContain('data-ed-type=');
  expect(html).toContain('data-ed-attention=');
  expect(html).toContain('data-ed-cursor=');
 }
});


it('derives staggered titles and presenter motion from absolute time on every seek',()=>{
 const early=popoutMotionState(2.2,2,6,false,true);
 expect(early.lead).toBeGreaterThan(early.italic);
 expect(early.wipe).toBeGreaterThan(0);
 const settled=popoutMotionState(4,2,6,false,true);
 expect(settled.lead).toBe(1);expect(settled.italic).toBe(1);expect(settled.wipe).toBe(-1);
 expect(popoutMotionState(2,2,6,false,true).lead).toBe(0);
 expect(popoutMotionState(2.2,2,6,false,true)).toEqual(early);
 expect(popoutMotionState(4,2,6,true,false).camera).toBeGreaterThan(1);
 expect(popoutMotionState(4,2,6,false,false).camera).toBe(1);
});

it('shares masked headlines, cut-safe wipe and layout-aware captions across preview and render',()=>{
 for(const sample of [true,false]){
  const html=popoutExplainerProject(templateSampleSource,templateSample('popout-explainer'),defaultEditBrand,sample);
  expect(html).toContain('function seekBase(t)');
  expect(html).toContain('function seek(t){seekBase(t);');
  expect(html).toContain('id="editorial-wipe"');
  expect(html).toContain('headline-mask');
  expect(html).toContain('#stage[data-layout="split"][data-mode="panel"] #captions');
  expect(html).toContain("s.style.opacity='1'");
 }
});

it('uses the approved smaller portrait framing and shades only the presenter region',()=>{
 const html=popoutExplainerProject(templateSampleSource,templateSample('popout-explainer'),defaultEditBrand);
 expect(html).toContain('id="presenter-shade"');
 expect(html).toContain('left:13%;top:41.67%;width:74%;height:74%');
 expect(html).toContain('#stage[data-mode="full"] #presenter-shade{display:none}');
 expect(html).toContain('rgba(8,16,30,.7)');
});
