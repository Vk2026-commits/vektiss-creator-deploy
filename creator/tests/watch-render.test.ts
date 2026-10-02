import {expect,it,vi} from 'vitest';
import {watchRender} from '../src/lib/watch-render';
it('checks immediately and stops after completion without submitting renders',async()=>{
 vi.useFakeTimers();try{
  const read=vi.fn().mockResolvedValueOnce({status:'pending'}).mockResolvedValue({status:'completed'});const result=vi.fn();
  const stop=watchRender(read,result,vi.fn());await vi.advanceTimersByTimeAsync(0);expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30000);expect(result).toHaveBeenLastCalledWith({status:'completed'});
  await vi.advanceTimersByTimeAsync(90000);expect(read).toHaveBeenCalledTimes(2);stop();
 }finally{vi.useRealTimers();}
});
it('ignores responses after unmount',async()=>{
 let resolve!:(value:{status:string})=>void;const result=vi.fn();
 const stop=watchRender(()=>new Promise<{status:string}>(r=>{resolve=r;}),result,vi.fn());stop();resolve({status:'completed'});await Promise.resolve();expect(result).not.toHaveBeenCalled();
});
it('keeps reading the same job after repeated connection errors',async()=>{
 vi.useFakeTimers();try{const read=vi.fn().mockRejectedValue(new Error('offline'));const stop=watchRender(read,vi.fn(),vi.fn());await vi.advanceTimersByTimeAsync(120000);expect(read).toHaveBeenCalledTimes(5);stop();await vi.advanceTimersByTimeAsync(60000);expect(read).toHaveBeenCalledTimes(5);}finally{vi.useRealTimers();}
});
