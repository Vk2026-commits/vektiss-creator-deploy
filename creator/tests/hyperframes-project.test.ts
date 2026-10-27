import {describe,it,expect} from 'vitest';
import {hyperframesProject,HYPERFRAMES_VERSION} from '../server/hyperframes-project';
import {defaultEditBrand} from '../src/domain/edit-brand';
import type {EditSource,EditProposal} from '../src/domain/edit-templates';
const source:EditSource={kind:'upload',assetId:'00000000-0000-4000-8000-000000000001',revision:'test',duration:2,words:[{start:0,end:1,text:'Hello </script>'}]};
const proposal:EditProposal={version:1,rendererVersion:2,templateId:'premium-explainer',sourceRevision:'test',beats:[{firstWord:0,lastWord:0,layout:'bottom-presenter',visual:'diagram',headline:'<img src=x onerror=alert(1)>',purpose:'Explain',illustration:'',motion:''}]};
describe('HyperFrames local bridge',()=>{
 it('pins the reviewed CLI and produces deterministic portrait HTML',()=>{expect(HYPERFRAMES_VERSION).toBe('0.8.206');const html=hyperframesProject(source,proposal,defaultEditBrand);expect(html).toBe(hyperframesProject(source,proposal,defaultEditBrand));expect(html).toContain('data-width="1080"');expect(html).toContain('src="source.mp4"');});
 it('supports widescreen',()=>expect(hyperframesProject(source,{...proposal,aspectRatio:'16:9'},defaultEditBrand)).toContain('data-width="1920"'));
 it('escapes text and only uses a fixed local source',()=>{const html=hyperframesProject(source,proposal,defaultEditBrand);expect(html).not.toContain('<img src=x');expect(html).toContain('\\u003c/script>');expect(html).toContain("media-src 'self'");});
 it('rejects stale sources and invalid brand CSS',()=>{expect(()=>hyperframesProject(source,{...proposal,sourceRevision:'other'},defaultEditBrand)).toThrow();expect(()=>hyperframesProject(source,proposal,{...defaultEditBrand,primary:'red;display:none'})).toThrow();});
 it('uses a full-frame presenter and kinetic editorial vocabulary only for Motion',()=>{const html=hyperframesProject(source,{...proposal,templateId:'hyperframes-motion'},defaultEditBrand);expect(html).toContain('Vektiss Talking Head Motion');expect(html).toContain('object-fit:contain');expect(html).toContain('rotateY(');expect(html).toContain('strokeDashoffset');expect(html).toContain('z-index:10');expect(html).not.toContain('<img src=x');expect(hyperframesProject(source,proposal,defaultEditBrand)).not.toContain('Vektiss Talking Head Motion');});
 it('preserves isolated deterministic sample seeking without loading a source',()=>{const html=hyperframesProject(source,{...proposal,templateId:'hyperframes-motion',aspectRatio:'16:9'},defaultEditBrand,true);expect(html).toContain('data-width="1920"');expect(html).not.toContain('src="source.mp4"');expect(html).toContain('event.source===parent');expect(html).toContain('Number.isFinite');expect(html).toContain('SAMPLE PRESENTER');});
});
