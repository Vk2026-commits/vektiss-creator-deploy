import {afterEach,expect,it,vi} from 'vitest';
import {createSavedDraft} from '../server/script-draft';
import {emptyBrief} from '../src/domain/script-brief';
import {newVideoPlan} from '../src/domain/video-plan';
const id='11111111-1111-4111-8111-111111111111';
const config={supabaseUrl:'https://example.supabase.co',publicKey:'public'};
const initial={id,updated_at:'2026-10-02T00:00:00Z',content_profile_id:id,title:'Untitled video',hook:'',body:'',cta:'',brief:{...emptyBrief(),source:'Saved source text'}};
afterEach(()=>vi.restoreAllMocks());
it('template workflow saves the source and waits for angle approval before generation',async()=>{
 let row={...initial,brief:{...initial.brief,template_workflow:true}},calls=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
  if(String(url).includes('/functions/')){calls++;return Response.json({source:'Evidence',summary:'Summary'});}
  if(init?.method==='PATCH')row={...row,...JSON.parse(init.body as string)};
  return Response.json([row]);
 });
 const result=await createSavedDraft({script_id:id,revision:initial.updated_at,action:'summarize'},'Bearer user',config);
 expect(calls).toBe(1);expect(result.brief.stage).toBe('perspective');expect(result.body).toBe('');
});
it('summary failure leaves all saved fields untouched',async()=>{
 const before={...initial,body:'Keep script',brief:{...initial.brief,production:newVideoPlan()}};
 const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async url=>String(url).includes('/functions/')?Response.json({error:'Unavailable'},{status:503}):Response.json([before]));
 await expect(createSavedDraft({script_id:id,revision:initial.updated_at,action:'summary_only'},'Bearer user',config)).rejects.toThrow();
 expect(fetcher.mock.calls.some(([,init])=>init?.method==='PATCH')).toBe(false);
});
it.each(['review','source'] as const)('summary only preserves script and saved plan at %s',async stage=>{
 const before={...initial,hook:'Keep hook',body:'Keep body',cta:'Keep CTA',brief:{...initial.brief,stage,production:{...newVideoPlan(),approved_at:'2026-10-07T00:00:00Z',step:'saved' as const}}};
 let row=before;let aiCalls=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
  if(String(url).includes('/functions/')){aiCalls++;expect(JSON.parse(init!.body as string).action).toBe('summarize');return Response.json({summary:'Read-only summary'});}
  if(init?.method==='PATCH')row={...row,...JSON.parse(init.body as string)};
  return Response.json([row]);
 });
 const result=await createSavedDraft({script_id:id,revision:initial.updated_at,action:'summary_only'},'Bearer user',config);
 expect(aiCalls).toBe(1);expect(result).toMatchObject({...before,brief:{...before.brief,source_summary:'Read-only summary'}});
});
it('failed rewriting never checkpoints over an existing script or plan',async()=>{
 const before={...initial,body:'Original script',brief:{...initial.brief,production:newVideoPlan()}};let calls=0;let saves=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
  if(String(url).includes('/functions/'))return ++calls===1?Response.json({source:'New evidence',summary:'New summary'}):Response.json({code:'RATE_LIMIT'},{status:429});
  if(init?.method==='PATCH')saves++;
  return Response.json([before]);
 });
 await expect(createSavedDraft({script_id:id,revision:initial.updated_at,action:'summarize'},'Bearer user',config)).rejects.toThrow();expect(saves).toBe(0);
});
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
