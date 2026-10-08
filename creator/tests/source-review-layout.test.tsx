import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {SourcePicker} from '../src/components/SourcePicker';
import {emptyBrief} from '../src/domain/script-brief';
it('puts a ready video in a compact review with one obvious script action',()=>{
 const html=renderToStaticMarkup(<SourcePicker brief={{...emptyBrief(),kind:'video',prepared_source:{kind:'video',original_id:'11111111-1111-4111-8111-111111111111'}}} profileId="profile" disabled={false} onSource={()=>{}} onCapture={()=>{}} onVideo={async()=>{}} onGraphic={async()=>{}} onProcessing={()=>{}}/>);
 expect(html).toContain('Review your source');expect(html).toContain('source-ready-toolbar');
 expect(html).toContain('Create my script');expect(html).toContain('workflow-action-bar');
 expect(html).not.toContain('What would you like to react to?');
 expect(html).not.toContain('Keep this page open while uploading');
});
