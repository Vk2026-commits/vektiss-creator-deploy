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
