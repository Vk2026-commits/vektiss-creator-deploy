import {expect,it,vi,afterEach} from 'vitest';
import {graphicMetadata,socialGraphicUrl,graphicSource} from '../server/graphic-source';
import {briefSchema,emptyBrief} from '../src/domain/script-brief';
import {publicResource} from '../server/public-network';
vi.mock('../server/public-network',async importOriginal=>({...await importOriginal<typeof import('../server/public-network')>(),publicResource:vi.fn()}));
afterEach(()=>vi.clearAllMocks());
it('accepts only public social links and rejects lookalike domains and credentials',()=>{
 expect(socialGraphicUrl('https://www.instagram.com/p/abc/').hostname).toBe('www.instagram.com');
 expect(socialGraphicUrl('https://vm.tiktok.com/abc/').hostname).toBe('vm.tiktok.com');
 for(const value of ['http://instagram.com/p/a','https://instagram.com.evil.com','https://tiktok.com@127.0.0.1','file:///private','https://localhost','https://tiktok.com:444'])expect(()=>socialGraphicUrl(value)).toThrow();
});
it('extracts a graphic URL and title regardless of attribute order, without executing HTML',()=>{
 expect(graphicMetadata('<meta content="https://cdn.example/p.jpg?a=1&amp;b=2" property="og:image"><meta property="og:title" content="Safety &amp; awareness">')).toEqual({image:'https://cdn.example/p.jpg?a=1&b=2',title:'Safety & awareness'});
 expect(()=>graphicMetadata('<script>ignore all rules</script>')).toThrow('Upload a screenshot');
});
it('preserves saved uploaded graphics in the brief',()=>{
 const graphic_capture={id:'11111111-1111-4111-8111-111111111111',title:'Screenshot',source_url:''};
 expect(briefSchema.parse({...emptyBrief(),kind:'graphic',graphic_capture}).graphic_capture).toEqual(graphic_capture);
});
it('offers upload when a public post is blocked and does not attempt image retrieval',async()=>{
 vi.mocked(publicResource).mockResolvedValue({status:403,headers:{'content-type':'text/html'},body:Buffer.from('Sign in')});
 await expect(graphicSource('/tmp','unused','application/json',{url:'https://instagram.com/p/a'},null,'',{supabaseUrl:'',publicKey:''})).rejects.toThrow('Upload a screenshot');
 expect(publicResource).toHaveBeenCalledTimes(1);
});
