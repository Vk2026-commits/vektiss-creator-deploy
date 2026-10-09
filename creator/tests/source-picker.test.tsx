import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {SourcePicker} from '../src/components/SourcePicker';
import {emptyBrief} from '../src/domain/script-brief';
vi.mock('../src/components/SourceVideo',()=>({SourceVideo:()=> <div>Video workflow</div>}));
vi.mock('../src/components/GraphicSource',()=>({GraphicSource:()=> <div>Graphic workflow</div>}));
const props={profileId:'profile',disabled:false,onSource:vi.fn(),onCapture:vi.fn(),onVideo:async()=>{},onGraphic:async()=>{},onProcessing:vi.fn()};
it('shows one composer and attachment action without source-type switches',()=>{
 const html=renderToStaticMarkup(<SourcePicker {...props} brief={emptyBrief()}/>);
 for(const label of ['Paste a link or add a video or screenshot','Add video or screenshot','Instagram','TikTok','YouTube','Website article','Supported files &amp; limits','Continue'])expect(html).toContain(label);
 expect(html).toContain('aria-label="Supported link sources"');
 for(const label of ['What should we use','Post or article','Upload a file','Graphic workflow'])expect(html).not.toContain(label);
 expect(html).not.toContain('Source type');
 expect(html).not.toContain('Find content');
});
it('does not guess the next source type from an old brief',()=>{
 const html=renderToStaticMarkup(<SourcePicker {...props} brief={{...emptyBrief(),kind:'video'}}/>);
 expect(html).toContain('Continue');expect(html).not.toContain('Graphic workflow');
});
