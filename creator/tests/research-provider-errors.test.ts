import {afterEach,expect,it,vi} from 'vitest';
import {getDeepResearchRun} from '../supabase/functions/_shared/research-provider';
afterEach(()=>vi.unstubAllGlobals());
it.each([401,402,429,500,503])('preserves provider HTTP %s without leaking its response',async status=>{
 vi.stubGlobal('Deno',{env:{get:()=> 'test-key'}});
 const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'private provider details'}),{status}));
 vi.stubGlobal('fetch',request);
 await expect(getDeepResearchRun('existing-response')).rejects.toThrow(`PROVIDER_HTTP_${status}`);
 expect(request).toHaveBeenCalledOnce();
});
