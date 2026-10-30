import {it,expect} from 'vitest';
import {searchCacheKey} from '../supabase/functions/_shared/search-cache';
it('invalidates reviews when profile, filters, evidence, or version changes',async()=>{
 const base={v:1,brief:{profile:'one',minViews:10000},source:{url:'https://youtube.com/watch?v=123',title:'Original'}};
 const key=await searchCacheKey(base);
 expect(await searchCacheKey(base)).toBe(key);
 for(const changed of [{...base,v:2},{...base,brief:{...base.brief,profile:'two'}},{...base,brief:{...base.brief,minViews:20000}},{...base,source:{...base.source,title:'Changed'}}])expect(await searchCacheKey(changed)).not.toBe(key);
});
