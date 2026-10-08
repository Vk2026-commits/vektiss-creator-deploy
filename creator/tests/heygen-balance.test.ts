import {it,expect} from 'vitest';
import {HeyGenCatalog} from '../supabase/functions/_shared/heygen';
import {isCreditError,providerVideo} from '../supabase/functions/_shared/presenter-test';
const provider=(data:unknown)=>new HeyGenCatalog('test',async()=>new Response(JSON.stringify({data})));
it('keeps API dollars separate from credits',async()=>{expect((await provider({billing_type:'wallet',wallet:{currency:'usd',remaining_balance:12.5}}).balance()).items).toEqual([{label:'API balance',value:12.5,unit:'usd'}]);});
it('reports zero credits and does not invent missing balance',async()=>{expect((await provider({billing_type:'wallet',wallet:{currency:'credits',remaining_balance:0}}).balance()).items[0].value).toBe(0);expect((await provider({billing_type:null}).balance()).items).toEqual([]);});
it('keeps subscription pools separate',async()=>{expect((await provider({billing_type:'subscription',subscription:{credits:{premium_credits:{remaining:12},add_on_credits:{remaining:4}}}}).balance()).items.map(x=>x.value)).toEqual([12,4]);});
it('recognizes insufficient credits without treating arbitrary failures as credit errors',()=>{expect(isCreditError({code:'INSUFFICIENT_CREDITS'})).toBe(true);expect(isCreditError('not enough credits')).toBe(true);expect(isCreditError('invalid voice')).toBe(false);});
it('surfaces provider credit rejection on non-402 errors without a paid retry',async()=>{let calls=0;await expect(providerVideo('test','',{},async()=>{calls++;return new Response('insufficient credits',{status:400});})).rejects.toThrow('insufficient API credits');expect(calls).toBe(1);});
