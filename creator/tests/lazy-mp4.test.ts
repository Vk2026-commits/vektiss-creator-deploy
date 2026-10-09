import {it,expect,vi,afterEach} from 'vitest';
import {lazyMP4} from '../src/lib/lazy-mp4';
import {mediaFetch} from '../src/lib/media-fetch';
vi.mock('../src/lib/media-fetch',()=>({mediaFetch:vi.fn()}));
afterEach(()=>vi.restoreAllMocks());
it('does not fetch until requested, shares repeated requests and reuses the loaded MP4',async()=>{
 vi.mocked(mediaFetch).mockResolvedValue(new Response('video',{headers:{'Content-Type':'video/mp4'}}));
 const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:video');
 const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 const abort=new AbortController();const load=lazyMP4('saved',abort.signal,vi.fn());
 expect(mediaFetch).not.toHaveBeenCalled();
 const first=load();expect(load()).toBe(first);
 expect(await first).toBe('blob:video');expect(await load()).toBe('blob:video');
 expect(mediaFetch).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(1);
 abort.abort();expect(revoke).toHaveBeenCalledWith('blob:video');await expect(load()).rejects.toBeDefined();
});
it('allows a retry after transfer failure without rebuilding the export',async()=>{
 vi.mocked(mediaFetch).mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(new Response('video',{headers:{'Content-Type':'video/mp4'}}));
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:retry');
 const load=lazyMP4('saved',new AbortController().signal,vi.fn());
 await expect(load()).rejects.toThrow('offline');expect(await load()).toBe('blob:retry');
});
it('does not create a media URL after leaving the project',async()=>{
 const abort=new AbortController();const create=vi.spyOn(URL,'createObjectURL');
 vi.mocked(mediaFetch).mockImplementationOnce(async()=>{abort.abort();return new Response('video',{headers:{'Content-Type':'video/mp4'}});});
 await expect(lazyMP4('saved',abort.signal,vi.fn())()).rejects.toBeDefined();expect(create).not.toHaveBeenCalled();
});
