import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {filterVideoLibrary,VideoLibraryPicker} from '../src/components/VideoLibraryPicker';
import {emptyBrief} from '../src/domain/script-brief';
import type {Script} from '../src/domain/scripts';
const items:Script[]=['Janitor Helps Woman in Distress','Group Helps Woman Followed by Man','Janitor Helps Woman in Distress'].map((title,i)=>({id:String(i),title,updated_at:'2026-10-07T12:00:00Z',content_profile_id:'p',hook:'',body:'',cta:'',brief:emptyBrief()}));
it('matches title words case-insensitively without hiding duplicate titles',()=>{
 expect(filterVideoLibrary(items,'  WOMAN janitor ')).toEqual([items[0],items[2]]);
 expect(filterVideoLibrary(items,'')).toEqual(items);
 expect(filterVideoLibrary(items,'missing')).toEqual([]);
 expect(items).toHaveLength(3);
});
it('replaces the native select with a clearly labelled dialog trigger',()=>{
 const html=renderToStaticMarkup(<VideoLibraryPicker items={items} current={items[0]} disabled={false} onSelect={()=>{}}/>);
 expect(html).toContain('aria-haspopup="dialog"');expect(html).toContain('aria-expanded="false"');
 expect(html).toContain('Open My videos: Janitor Helps Woman in Distress');expect(html).not.toContain('<select');
});
it('disables switching during processing and handles an empty library',()=>{
 const html=renderToStaticMarkup(<VideoLibraryPicker items={[]} current={null} disabled onSelect={()=>{}}/>);
 expect(html).toContain('disabled');expect(html).toContain('Start a new video');
});
