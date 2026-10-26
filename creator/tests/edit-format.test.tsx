import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {editDimensions,editAspectRatio} from '../src/domain/edit-format';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {EditComposition} from '../src/components/EditComposition';
import {validateEditProposal} from '../src/domain/edit-templates';
import {templateEditOptions} from '../server/template-edit';
it('defaults old plans to portrait and defines true landscape dimensions',()=>{
 expect(editDimensions()).toEqual({width:1080,height:1920});
 expect(editDimensions('16:9')).toEqual({width:1920,height:1080});
 expect(()=>editAspectRatio.parse('4:3')).toThrow();
});
it('persists the format in validated proposals and accepts it in generation requests',()=>{
 const plan={...templateSample('premium-explainer'),aspectRatio:'16:9' as const};
 expect(validateEditProposal(plan,templateSampleSource,plan.templateId).aspectRatio).toBe('16:9');
 expect(()=>validateEditProposal({...plan,rendererVersion:undefined},templateSampleSource,plan.templateId)).toThrow('EDIT_FORMAT_VERSION');
 expect(templateEditOptions.parse({profileId:templateSampleSource.assetId,template:'recommend',aspectRatio:'16:9'}).aspectRatio).toBe('16:9');
});
it('lays out wide graphics alongside the presenter rather than scaling the vertical canvas',()=>{
 const proposal={...templateSample('premium-explainer'),aspectRatio:'16:9' as const};
 const html=renderToStaticMarkup(<EditComposition source={templateSampleSource} proposal={proposal} frame={60} media={<video/>}/>);
 expect(html).toContain('left:1040px');expect(html).not.toContain('top:1060px');
});
