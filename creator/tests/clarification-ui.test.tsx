import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScriptIntake } from '../src/components/ScriptIntake';
import { emptyBrief } from '../src/domain/script-brief';
const props={onChange:()=>{},profileId:'p',busy:false,preview:false,onAI:async()=>{}};
it('defaults to a clear link path and offers a unified file upload',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),kind:'video'}}/>);
 
 expect(html).toMatch(/aria-pressed="true"[^>]*>Paste a link/);
 expect(html).toMatch(/aria-pressed="false"[^>]*>Upload a file/);
 expect(html).toContain('Instagram, TikTok, YouTube');
 expect(html).not.toContain('Find content');
 expect(html).not.toContain('Perplexity');
 expect(html).not.toContain('Where to look');
 expect(html).not.toContain('Paste a transcript');
 expect(html).not.toContain('type="file"');
 expect(html).not.toContain('Record voice note');
 expect(html).not.toContain('Add your article.');
 
});
it('accepts an article URL without perspective or pasted text',()=>{
 const html=renderToStaticMarkup(<ScriptIntake {...props} brief={{...emptyBrief(),url:'https://example.com/article'}}/>);
 expect(html).toContain('Capture post / article');expect(html).not.toContain('Your perspective / reviewed');
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
