import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScriptIntake } from '../src/components/ScriptIntake';
import { emptyBrief } from '../src/domain/script-brief';
const props={onChange:()=>{},profileId:'p',busy:false,preview:false,onAI:async()=>{}};
it('keeps summary and source controls secondary to the saved script',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),stage:'review',source_summary:'Saved summary',source:'Original source'}}/>);
 expect(html).toContain('<details class="source-details"><summary>Source details</summary>');
 expect(html).toContain('Saved summary');expect(html).not.toContain('Get video summary');expect(html).not.toContain('Review source and notes');
});
it('offers summary-only generation when a reviewed draft has no summary',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),stage:'review'}}/>);
 expect(html).toContain('Get video summary');expect(html).not.toContain('Retry / create draft');
});
it('defaults to a clear link path and offers a unified file upload',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),kind:'video'}}/>);
 
 expect(html).toContain('Paste a link or add a video or screenshot');
 expect(html).toContain('Add video or screenshot');
 for(const platform of ['Instagram','TikTok','YouTube'])expect(html).toContain(`<li>${platform}</li>`);
 expect(html).not.toContain('Find content');
 expect(html).not.toContain('Perplexity');
 expect(html).not.toContain('Where to look');
 expect(html).not.toContain('Paste a transcript');
 expect(html).toContain('type="file"');
 expect(html).not.toContain('Record voice note');
 expect(html).not.toContain('Add your article.');
 
});
it('accepts an article URL without perspective or pasted text',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),url:'https://example.com/article'}}/>);
 expect(html).toContain('Continue');expect(html).not.toContain('Your perspective / reviewed');
});
it('shows the source summary before the separate perspective screen',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),source_summary:'An article summary.'}}/>);
 expect(html).toContain('An article summary.');expect(html).toContain('Retry / create draft');expect(html).not.toContain('Your perspective / reviewed');
 expect(html).not.toContain('role="tablist"');expect(html).not.toContain('Import &amp; analyze');
 expect(html).toContain('<details><summary>View full analysis</summary>');expect(html).toContain('Change source');
});
it('renders only one question even for legacy five-question briefs',()=>{
 const brief={...emptyBrief(),stage:'clarify' as const,questions:Array.from({length:5},(_,i)=>({question:`Question ${i}`,answer:''}))};
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={brief}/>);
 expect(html).toContain('Question 0');expect(html).not.toContain('Question 1');
 expect((html.match(/<textarea/g)||[])).toHaveLength(1);
 expect(html).not.toContain('voice-recorder');
 expect(html).toContain('Skip unanswered questions');
});
it('shows no question boxes when perspective is clear',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),stage:'clarify',clarified:true}}/>);
 expect(html).not.toContain('<textarea');expect(html).toContain('Your perspective is ready.');
});
it('makes writing the primary action, not clarification',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),stage:'perspective'}}/>);
 expect(html).toContain('Create my draft');expect(html).not.toContain('Ask AI to clarify');
});
