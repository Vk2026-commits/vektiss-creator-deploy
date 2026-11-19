import {it,expect} from 'vitest';
import {rankingProject} from '../src/domain/ranking-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {writeFileSync,mkdirSync} from 'node:fs';
it('renders a full presenter and all seven tiers with word-anchored persistent cards',()=>{
 const html=rankingProject(templateSampleSource,templateSample('tier-list'),{...defaultEditBrand,captionStyle:'none'});
 expect(html.match(/class="row"/g)).toHaveLength(7);expect(html).toContain('data-reveal="3.5"');expect(html).toContain('object-fit:cover');expect(html).not.toContain('data-to=');
 if(process.env.RANKING_PROOF){mkdirSync(process.env.RANKING_PROOF,{recursive:true});writeFileSync(process.env.RANKING_PROOF+'/index.html',html);}
});
it('deduplicates repeated items across beats and escapes content',()=>{const p=templateSample('tier-list');p.beats[0].lastWord=4;p.beats[0].graphics!.nodes=p.beats[0].graphics!.nodes.slice(0,1);p.beats.push({...p.beats[0],firstWord:5,lastWord:9,graphics:{nodes:[{...p.beats[0].graphics!.nodes[0],revealWord:5}],links:[]}});p.beats[0].headline='<img onerror=x>';const html=rankingProject(templateSampleSource,p,defaultEditBrand);expect(html.match(/class="item"/g)).toHaveLength(1);expect(html).toContain('&lt;img onerror=x&gt;');});

it('introduces an option before its verdict and uses three-word mobile captions',()=>{
 const p=templateSample('tier-list');p.beats[0].graphics!.nodes[0].introducedWord=0;
 const html=rankingProject(templateSampleSource,p,defaultEditBrand);
 expect(html).toContain('data-flight="0"');expect(html).toContain('"introduced":0');
 expect(html).toContain('Math.floor(at/3)');expect(html).toContain('font-size:78px');
 p.beats[0].graphics!.nodes[0].introducedWord=9;
 expect(()=>rankingProject(templateSampleSource,p,defaultEditBrand)).toThrow('EDIT_INTRODUCED_WORD');
});

import {rankingDefault} from '../src/domain/ranking-default';
import {templateOpeningInstruction} from '../src/domain/social-opening';
it('keeps the approved default identical for saved plans and new versioned plans',()=>{
 const plan=templateSample('tier-list');
 const existing=rankingProject(templateSampleSource,plan,defaultEditBrand);
 const fresh=rankingProject(templateSampleSource,{...plan,rankingStyle:rankingDefault.id},defaultEditBrand);
 expect(fresh).toBe(existing);
 expect(fresh).toContain('top:59%;height:31%');
 expect(fresh).toContain('top:49%');
 expect(templateOpeningInstruction('tier-list')).toContain('Start the spoken script immediately');
 expect(plan).not.toHaveProperty('rankingStyle');
});

it('toggles only the title while preserving ranks, captions and original footage',()=>{
 const plan=templateSample('tier-list');
 const on=rankingProject(templateSampleSource,{...plan,showRankingTitle:true},defaultEditBrand);
 const off=rankingProject(templateSampleSource,{...plan,showRankingTitle:false},defaultEditBrand);
 expect(on).toContain('<h1>');expect(off).not.toContain('<h1>');
 expect(on.replace(/<h1>.*?<\/h1>/,'')).toBe(off);
 expect(rankingProject(templateSampleSource,plan,defaultEditBrand)).toBe(on);
});
