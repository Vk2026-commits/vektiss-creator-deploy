import {it,expect,vi} from 'vitest';
import {newVideoPlan} from '../src/domain/video-plan';
vi.mock('../src/lib/media-fetch',()=>({mediaFetch:vi.fn()}));
import {mediaFetch} from '../src/lib/media-fetch';
import {checkBackground} from '../src/lib/check-background';
it('blocks missing and failed saved backgrounds instead of falling back to avatar-only',async()=>{
 await expect(checkBackground(newVideoPlan(),'graphic')).rejects.toThrow(/missing/);
 const p={...newVideoPlan(),article_capture:{id:'saved',title:'Source',source_url:'https://example.com'}};
 vi.mocked(mediaFetch).mockResolvedValue(new Response('missing',{status:404}));await expect(checkBackground(p,'article')).rejects.toThrow(/could not load/);
 vi.mocked(mediaFetch).mockResolvedValue(new Response('image',{headers:{'content-type':'image/png'}}));await expect(checkBackground(p,'graphic')).resolves.toBeUndefined();
});
