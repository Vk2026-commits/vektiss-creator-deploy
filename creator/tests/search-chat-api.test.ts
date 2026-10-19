import {expect,it,vi} from 'vitest';
import {prepareSearchChat} from '../supabase/functions/search-quality-admin/chat';
it('reuses a pending or completed proposal without calling an AI provider again',async()=>{
 const input={requestId:'request',profileId:'profile',scope:'profile' as const,message:'Prefer original clips'};
 const row={id:'request',actor:'admin',profile_id:'profile',scope:'profile',message:input.message,status:'pending'};
 const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:row,error:null})};
 const db:any={from:vi.fn(()=>query),rpc:vi.fn()};
 const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
 try{
  expect(await prepareSearchChat(db,'admin',input,'key')).toEqual(row);
  expect(fetchMock).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled();
  await expect(prepareSearchChat(db,'other',input,'key')).rejects.toThrow('REQUEST_CONFLICT');
  await expect(prepareSearchChat(db,'admin',{...input,profileId:'different'},'key')).rejects.toThrow('REQUEST_CONFLICT');
 }finally{vi.unstubAllGlobals();}
});
