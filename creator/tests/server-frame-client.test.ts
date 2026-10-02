import {it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../src/lib/media-fetch',()=>({mediaFetch:mocks.fetch}));
import {serverVideoFrames} from '../src/lib/video-analysis';
it('uses the worker even when document/video APIs do not exist',async()=>{
 const output={duration:2,frames:[{time:0,image:'data:image/jpeg;base64,/9j/'}]};mocks.fetch.mockResolvedValueOnce(Response.json(output));
 expect(await serverVideoFrames(new Blob(['video'],{type:'video/mp4'}),[0])).toEqual(output);
 expect(mocks.fetch).toHaveBeenCalledWith('/api/local-capture/video-frames',expect.objectContaining({headers:{'Content-Type':'video/mp4','X-Frame-Times':'[0]'}}));
});
it('reports a failed worker request instead of trying Safari decoding',async()=>{
 mocks.fetch.mockResolvedValueOnce(Response.json({error:'Worker busy'},{status:429}));await expect(serverVideoFrames(new Blob())).rejects.toThrow('Worker busy');
});
