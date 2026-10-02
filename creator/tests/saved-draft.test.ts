import {afterEach,expect,it,vi} from 'vitest';
import {createSavedDraft} from '../server/script-draft';
import {emptyBrief} from '../src/domain/script-brief';
const id='11111111-1111-4111-8111-111111111111';
const config={supabaseUrl:'https://example.supabase.co',publicKey:'public'};
const initial={id,updated_at:'2026-10-02T00:00:00Z',content_profile_id:id,title:'Untitled video',hook:'',body:'',cta:'',brief:{...emptyBrief(),source:'Saved source text'}};
afterEach(()=>vi.restoreAllMocks());
it('saves the summary checkpoint and final script on the server without a phone connection',async()=>{
 let row=initial,aiCalls=0,saves=0;
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
  if(String(url).includes('/functions/')){
   aiCalls++;
   return Response.json(aiCalls===1?{source:'Analyzed source',summary:'Source summary',title:'Reaction'}:{hook:'I agree with this choice.',body:'Practical reaction.',cta:'Stay alert. Stay safe.',review:''});
  }
  if(init?.method==='PATCH')row={...row,...JSON.parse(init.body as string),updated_at:`revision-${++saves}`};
  return Response.json([row]);
 });
 const result=await createSavedDraft({script_id:id,revision:initial.updated_at,action:'summarize'},'Bearer user',config);
 expect(result.brief.stage).toBe('review');expect(result.title).toBe('Reaction');expect(saves).toBe(2);
 expect(fetcher.mock.calls.every(([url])=>!String(url).includes('avatar-manager'))).toBe(true);
 expect(fetcher.mock.calls.filter(([,init])=>init?.method==='PATCH')[1][0]).toContain('updated_at=eq.revision-1');
});
it('does not overwrite a newer draft or call AI for a stale revision',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json([{...initial,updated_at:'newer'}]));
 await expect(createSavedDraft({script_id:id,revision:initial.updated_at,action:'generate'},'Bearer user',config)).rejects.toThrow('changed');
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('keeps the summary checkpoint when writing fails',async()=>{
 let row=initial,calls=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
  if(String(url).includes('/functions/'))return ++calls===1?Response.json({source:'Saved evidence',summary:'Summary',title:'Topic'}):Response.json({code:'RATE_LIMIT'},{status:429});
  if(init?.method==='PATCH')row={...row,...JSON.parse(init.body as string),updated_at:'saved-summary'};
  return Response.json([row]);
 });
 await expect(createSavedDraft({script_id:id,revision:initial.updated_at,action:'summarize'},'Bearer user',config)).rejects.toThrow('request limit');
 expect(row.brief.source_summary).toBe('Summary');
});
