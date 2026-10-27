import {it,expect} from 'vitest';
import {cleanTechProject} from '../src/domain/clean-tech-project';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
const logo={name:'ChatGPT',firstWord:2,image:'data:image/png;base64,YQ=='};
it('renders approved local logo bytes at the spoken word and preserves source audio',()=>{
 const html=cleanTechProject(templateSampleSource,templateSample('clean-tech'),defaultEditBrand,false,[logo]);
 expect(html).toContain('data-reveal="1"');expect(html).toContain('alt="ChatGPT"');expect(html).toContain(logo.image);expect(html).toContain('data-has-audio="true"');expect(html).toContain('src="source.mp4"');
});
it('rejects remote assets and invalid word anchors',()=>{
 expect(()=>cleanTechProject(templateSampleSource,templateSample('clean-tech'),defaultEditBrand,false,[{...logo,image:'https://example.com/logo.png'}])).toThrow('Invalid render logo');
 expect(()=>cleanTechProject(templateSampleSource,templateSample('clean-tech'),defaultEditBrand,false,[{...logo,firstWord:999}])).toThrow('Invalid logo word anchor');
});
it('supports widescreen and omits absent logos',()=>{
 const html=cleanTechProject(templateSampleSource,{...templateSample('clean-tech'),aspectRatio:'16:9'},defaultEditBrand);
 expect(html).toContain('data-width="1920"');expect(html).not.toContain('<figure');expect(html).toContain('z-index:10');
});
