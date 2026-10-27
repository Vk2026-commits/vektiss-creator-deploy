import {describe,it,expect} from 'vitest';
import {phoneMockupProject} from '../src/domain/phone-mockup-project';
import {defaultEditBrand} from '../src/domain/edit-brand';
import type {EditSource,EditProposal} from '../src/domain/edit-templates';
const source:EditSource={kind:'upload',assetId:'00000000-0000-4000-8000-000000000001',revision:'test',duration:5,words:[{start:0,end:4,text:'Hello </script>'}]};
const plan:EditProposal={version:1,rendererVersion:2,templateId:'hyperframes-motion',sourceRevision:'test',beats:[{firstWord:0,lastWord:0,layout:'presenter',visual:'typography',headline:'<img src=x onerror=alert(1)>',purpose:'Explain',illustration:'',motion:''}]};
describe('Phone mockup composition',()=>{
 it('preserves local footage and deterministic output',()=>{const html=phoneMockupProject(source,plan,defaultEditBrand);expect(html).toBe(phoneMockupProject(source,plan,defaultEditBrand));expect(html).toContain('src="source.mp4"');expect(html).toContain('object-fit:contain');expect(html).toContain('data-width="1080"');expect(html).toContain('duration:()=>5');expect(html).toContain('rotateY(');});
 it('supports wide and isolated five second sample without media requests',()=>{const html=phoneMockupProject(source,{...plan,aspectRatio:'16:9'},defaultEditBrand,true);expect(html).toContain('data-width="1920"');expect(html).toContain('data-duration="5"');expect(html).not.toContain('src="source.mp4"');expect(html).toContain('event.source===parent');expect(html).toContain('Number.isFinite');});
 it('escapes source content and keeps captions after visual layers',()=>{const html=phoneMockupProject(source,plan,defaultEditBrand);expect(html).not.toContain('<img src=x');expect(html).toContain('\\u003c/script>');expect(html).toContain('captionWordAt=');expect(html).toContain('z-index:20');expect(html.indexOf('id="captions"')).toBeGreaterThan(html.indexOf('class="home"'));});
 it('rejects stale proposals and unsafe brand CSS',()=>{expect(()=>phoneMockupProject(source,{...plan,sourceRevision:'stale'},defaultEditBrand)).toThrow();expect(()=>phoneMockupProject(source,plan,{...defaultEditBrand,text:'red;display:none'})).toThrow();});
});
