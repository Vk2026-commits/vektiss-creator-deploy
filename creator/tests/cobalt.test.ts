import {afterEach,expect,it,vi} from 'vitest';
import {cobaltVideo,cobaltMedia} from '../server/cobalt';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('selects the first picker photo and verifies actual image MIME',async()=>{
 vi.stubEnv('CREATOR_COBALT_URL','http://127.0.0.1:9000');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({status:'picker',picker:[{type:'photo',url:'http://127.0.0.1:9000/tunnel?id=first'},{type:'video',url:'http://127.0.0.1:9000/tunnel?id=second'}]})).mockResolvedValueOnce(new Response('image',{headers:{'content-type':'image/jpeg'}})));
 expect(await cobaltMedia('https://instagram.com/p/photos')).toMatchObject({type:'image/jpeg',firstOnly:true});
});
it('rejects untrusted picker destinations',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({status:'picker',picker:[{type:'photo',url:'http://127.0.0.1:54321/private'}]})));
 await expect(cobaltMedia('https://instagram.com/p/photo')).rejects.toThrow('VIDEO_EXTRACT');
});
it('authenticates hosted requests without passing the key to media downloads',async()=>{
 vi.stubEnv('CREATOR_COBALT_URL','https://mc-4rr8dq8lv6.bunny.run');
 vi.stubEnv('CREATOR_COBALT_KEY','test-only-key');
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({status:'tunnel',url:'https://mc-4rr8dq8lv6.bunny.run/tunnel?id=test'})).mockResolvedValueOnce(new Response('video',{headers:{'Content-Type':'video/mp4'}}));
 vi.stubGlobal('fetch',fetcher);
 await cobaltVideo('https://www.tiktok.com/@test/video/123');
 expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Api-Key test-only-key');
 expect(fetcher.mock.calls[1][1].headers).toBeUndefined();
});
it('fails closed when the hosted key is missing',async()=>{
 vi.stubEnv('CREATOR_COBALT_URL','https://mc-4rr8dq8lv6.bunny.run');vi.stubEnv('CREATOR_COBALT_KEY','');
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(cobaltVideo('https://example.com')).rejects.toThrow('VIDEO_SETUP');expect(fetcher).not.toHaveBeenCalled();
});
it('downloads media from the trusted local tunnel',async()=>{
 vi.stubEnv('CREATOR_COBALT_URL','http://127.0.0.1:9000');vi.stubEnv('CREATOR_COBALT_KEY','');
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({status:'tunnel',url:'http://127.0.0.1:9000/tunnel?id=test'})).mockResolvedValueOnce(new Response('video',{headers:{'Content-Type':'video/mp4'}}));
 vi.stubGlobal('fetch',fetcher);
 expect((await cobaltVideo('https://www.tiktok.com/@test/video/123')).body.toString()).toBe('video');
});
it('rejects a tunnel pointing to another local service',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({status:'tunnel',url:'http://127.0.0.1:54321/tunnel'}));vi.stubGlobal('fetch',fetcher);
 await expect(cobaltVideo('https://example.com')).rejects.toThrow('VIDEO_EXTRACT');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not retry login restrictions through another provider',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({status:'error',error:{code:'error.api.content.login'}})));
 await expect(cobaltVideo('https://example.com')).rejects.toThrow('VIDEO_LOGIN');
});
it.runIf(process.env.COBALT_SMOKE==='1')('imports the public TikTok sample bytes',async()=>{
 const media=await cobaltVideo('https://www.tiktok.com/@apifytech/video/7398101551744552225');
 expect(media.type).toBe('video/mp4');expect(media.body.length).toBeGreaterThan(1000);expect(media.body.subarray(4,8).toString()).toBe('ftyp');
},100000);
