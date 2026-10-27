import {it,expect} from 'vitest';
import {alphaSample} from '../src/domain/alpha-sample';
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
for(const id of ['popout-explainer','paper-cutout'] as const)it(`uses seekable canvas alpha for ${id}`,()=>{
 const result=alphaSample(hyperframesProject(templateSampleSource,templateSample(id),defaultEditBrand,true),id==='paper-cutout');
 expect(result).toContain('<canvas');expect(result).toContain('ctx.clearRect');expect(result).toContain('ctx.drawImage');expect(result).toContain("img-src 'self' data: blob:");
 expect(result.match(/<video\b/g)?.length??0).toBe(id==='paper-cutout'?0:1);
 expect(result).not.toContain('src="presenter.webm"');
});
