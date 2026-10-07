import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mediaFetch} from '../src/lib/media-fetch';
import {watchRender} from '../src/lib/watch-render';
vi.mock('../src/lib/supabase',()=>({supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'test'}}})}}}));
const storage=new Map<string,string>();
beforeEach(()=>{
 vi.stubEnv('PROD',true);
 vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
 storage.clear();
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
it('reopens an accepted export using only its saved poll URL',async()=>{
 vi.useFakeTimers();
 const body=JSON.stringify({job_id:'existing-paid-render'});
 const poll='/api/local-capture/jobs/11111111-1111-4111-8111-111111111111';
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({poll}),{status:202})).mockResolvedValue(new Response(JSON.stringify({id:'finished'})));
 vi.stubGlobal('fetch',fetcher);
 const first=mediaFetch('/api/local-capture/full-compose',{method:'POST',body});
 await vi.advanceTimersByTimeAsync(2000);expect((await first).ok).toBe(true);
 fetcher.mockResolvedValue(new Response(JSON.stringify({id:'finished'})));
 await mediaFetch('/api/local-capture/full-compose',{method:'POST',body});
 expect(fetcher.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);
 expect(fetcher.mock.calls.at(-1)?.[0]).toBe(poll);
});
it('retries interrupted status reads, not POST submissions',async()=>{
 vi.useFakeTimers();
 const poll='/api/local-capture/jobs/11111111-1111-4111-8111-111111111111';
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({poll}),{status:202})).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(new Response(JSON.stringify({id:'done'})));
 vi.stubGlobal('fetch',fetcher);
 const work=mediaFetch('/api/local-capture/full-compose',{method:'POST',body:'{}'});
 await vi.advanceTimersByTimeAsync(4000);expect((await work).ok).toBe(true);
 expect(fetcher.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);
});
it('does not submit work when restoring an unconfirmed source upload',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(mediaFetch('/api/local-capture/source-workflow',{method:'POST'},'missing',true)).rejects.toThrow('upload was interrupted');
 expect(fetcher).not.toHaveBeenCalled();
});
it('stops repeated server errors with a recoverable message instead of spinning forever',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response('Unavailable',{status:503})));vi.stubGlobal('fetch',fetcher);
 const result=mediaFetch('/api/local-capture/exports/11111111-1111-4111-8111-111111111111').catch(e=>e);
 await vi.advanceTimersByTimeAsync(8000);expect((await result).message).toContain('saved video is preserved');expect(fetcher).toHaveBeenCalledTimes(5);
});
it('refreshes on wake without overlapping reads, and removes wake listeners on cleanup',async()=>{
 const surface=new EventTarget(),documentSurface=new EventTarget();
 Object.assign(documentSurface,{visibilityState:'visible'});
 vi.stubGlobal('window',surface);vi.stubGlobal('document',documentSurface);
 let resolve!:(value:{status:string})=>void;
 const read=vi.fn(()=>new Promise<{status:string}>(r=>{resolve=r;}));
 const stop=watchRender(read,vi.fn(),vi.fn());
 surface.dispatchEvent(new Event('online'));expect(read).toHaveBeenCalledTimes(1);
 resolve({status:'processing'});await Promise.resolve();await Promise.resolve();
 documentSurface.dispatchEvent(new Event('visibilitychange'));expect(read).toHaveBeenCalledTimes(2);
 stop();resolve({status:'processing'});await Promise.resolve();
 surface.dispatchEvent(new Event('pageshow'));expect(read).toHaveBeenCalledTimes(2);
});
