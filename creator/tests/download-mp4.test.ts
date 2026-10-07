import {it,expect,vi} from 'vitest';
import {downloadMP4} from '../src/lib/download-mp4';
it('reports actual bytes and returns an MP4 blob',async()=>{
 const progress=vi.fn();const response=new Response(new Uint8Array([1,2,3,4]),{headers:{'content-length':'4'}});
 const blob=await downloadMP4(response,progress);expect(blob.size).toBe(4);expect(blob.type).toBe('video/mp4');expect(progress).toHaveBeenLastCalledWith(4,4);
});
it('supports unknown content length without inventing a percentage',async()=>{const progress=vi.fn();await downloadMP4(new Response('abcd'),progress);expect(progress).toHaveBeenLastCalledWith(4,null);});
it('rejects a truncated successful response',async()=>{await expect(downloadMP4(new Response('ab',{headers:{'content-length':'4'}}),()=>{})).rejects.toThrow('download was interrupted');});
