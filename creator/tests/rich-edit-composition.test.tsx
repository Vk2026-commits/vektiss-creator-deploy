import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {EditComposition} from '../src/components/EditComposition';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {validateEditProposal} from '../src/domain/edit-templates';
it.each(['process','timeline','comparison','network','statistic','document','spotlight'] as const)('renders %s deterministically with real labels',scene=>{
 const proposal=templateSample('premium-explainer');proposal.beats[0].scene=scene;
 const render=()=>renderToStaticMarkup(<EditComposition source={templateSampleSource} proposal={proposal} frame={60} media={<div>Presenter footage</div>}/>);
 expect(render()).toBe(render());expect(render()).toContain(`data-scene="${scene}"`);expect(render()).toContain('Skill');
});
it('preserves legacy renders and honors presenter-only layouts',()=>{
 const proposal=templateSample('premium-explainer');delete proposal.rendererVersion;
 expect(renderToStaticMarkup(<EditComposition source={templateSampleSource} proposal={proposal} frame={60} media={<div/>}/>)).not.toContain('data-renderer="2"');
 proposal.rendererVersion=2;proposal.beats[0].layout='presenter';
 const html=renderToStaticMarkup(<EditComposition source={templateSampleSource} proposal={proposal} frame={60} media={<div/>}/>);
 expect(html).not.toContain('KEY IDEA');expect(html).toContain('Start with what you know');
});
it('rejects reveals anchored outside the spoken beat',()=>{
 const proposal=templateSample('premium-explainer');proposal.beats[0].graphics!.nodes[0].revealWord=8;
 expect(()=>validateEditProposal(proposal,templateSampleSource,'premium-explainer')).toThrow('EDIT_REVEAL_WORD');
});
