import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {SourcePicker} from '../src/components/SourcePicker';
import {emptyBrief} from '../src/domain/script-brief';
vi.mock('../src/components/SourceVideo',()=>({SourceVideo:()=> <div>Video workflow</div>}));
vi.mock('../src/components/GraphicSource',()=>({GraphicSource:()=> <div>Graphic workflow</div>}));
const props={profileId:'profile',disabled:false,onSource:vi.fn(),onCapture:vi.fn(),onVideo:async()=>{},onGraphic:async()=>{},onProcessing:vi.fn()};
it('makes link and upload paths and supported platforms visible without hidden toggles',()=>{
 const html=renderToStaticMarkup(<SourcePicker {...props} brief={emptyBrief()}/>);
 for(const label of ['Paste a link','Upload a file','Instagram, TikTok, YouTube','Post or article','Graphic workflow'])expect(html).toContain(label);
 expect(html).not.toContain('Source type');
 expect(html).not.toContain('Find content');
});
it('keeps existing video briefs on the video workflow',()=>{
 const html=renderToStaticMarkup(<SourcePicker {...props} brief={{...emptyBrief(),kind:'video'}}/>);
 expect(html).toContain('Video workflow');expect(html).not.toContain('Graphic workflow');
});
