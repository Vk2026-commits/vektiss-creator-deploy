import {expect,it,vi} from 'vitest';
import {sendVideoReadyEmail} from '../server/resend-notifications';

const base={apiKey:'re_test_key',from:'Vektiss Creator <notify@example.com>',to:'creator@example.com',webOrigin:'https://creator.example',exportId:'a'.repeat(64),idempotencyKey:'creator-video-ready-owner-export'};

it('sends a video-ready email through Resend with a deterministic idempotency key',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({id:'email_123'}));
 const result=await sendVideoReadyEmail({...base,fetcher});
 expect(result).toEqual({state:'sent',providerId:'email_123'});
 expect(fetcher).toHaveBeenCalledTimes(1);
 const [url,options]=fetcher.mock.calls[0];
 expect(url).toBe('https://api.resend.com/emails');
 expect(options.method).toBe('POST');
 expect(options.headers).toMatchObject({Authorization:'Bearer re_test_key','Idempotency-Key':base.idempotencyKey});
 expect(JSON.parse(options.body)).toMatchObject({from:base.from,to:[base.to],subject:'Your Vektiss Creator video is ready'});
 expect(JSON.parse(options.body).html).toContain('https://creator.example/?export='+base.exportId);
});

it('skips delivery without server-side Resend settings',async()=>{
 const fetcher=vi.fn();
 await expect(sendVideoReadyEmail({...base,apiKey:'',fetcher})).resolves.toEqual({state:'skipped',reason:'NOT_CONFIGURED'});
 expect(fetcher).not.toHaveBeenCalled();
});

it('does not send to malformed recipients or report provider response details',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('credential detail',{status:401}));
 await expect(sendVideoReadyEmail({...base,to:'not-an-email',fetcher})).resolves.toEqual({state:'skipped',reason:'INVALID_RECIPIENT'});
 await expect(sendVideoReadyEmail({...base,fetcher})).resolves.toEqual({state:'failed',reason:'PROVIDER'});
 expect(fetcher).toHaveBeenCalledTimes(1);
});
