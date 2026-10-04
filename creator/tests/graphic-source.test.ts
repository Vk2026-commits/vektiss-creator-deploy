import {expect,it,vi,afterEach} from 'vitest';
import {graphicMetadata,socialGraphicUrl,socialGraphicHost,graphicSource} from '../server/graphic-source';
import {captureArticle} from '../server/article-capture';
import {briefSchema,emptyBrief} from '../src/domain/script-brief';
import {publicResource} from '../server/public-network';
vi.mock('../server/public-network',async importOriginal=>({...await importOriginal<typeof import('../server/public-network')>(),publicResource:vi.fn()}));
vi.mock('../server/article-capture',()=>({captureArticle:vi.fn()}));
afterEach(()=>vi.clearAllMocks());
it('accepts HTTPS social and article links, classifies social hosts exactly, and rejects credentials',()=>{
 expect(socialGraphicUrl('https://www.instagram.com/p/abc/').hostname).toBe('www.instagram.com');
 expect(socialGraphicUrl('https://vm.tiktok.com/abc/').hostname).toBe('vm.tiktok.com');
 expect(socialGraphicUrl('https://example.com/news').hostname).toBe('example.com');
 expect(socialGraphicHost('www.youtube.com')).toBe(true);
 expect(socialGraphicHost('youtu.be')).toBe(true);
 expect(socialGraphicHost('instagram.com.evil.com')).toBe(false);
 for(const value of ['http://instagram.com/p/a','https://tiktok.com@127.0.0.1','file:///private','https://localhost','https://tiktok.com:444'])expect(()=>socialGraphicUrl(value)).toThrow();
});
it('routes website pages to sandboxed article capture and offers upload on failure',async()=>{
 vi.mocked(captureArticle).mockRejectedValueOnce(Error('No headline'));
 await expect(graphicSource('/tmp','unused','application/json',{url:'https://example.com/news'},null,'',{supabaseUrl:'',publicKey:''})).rejects.toThrow('Upload a screenshot');
 expect(captureArticle).toHaveBeenCalledWith('https://example.com/news');
 expect(publicResource).not.toHaveBeenCalled();
});
it('routes YouTube post/thumbnail metadata through the public post capture path',async()=>{
 vi.mocked(publicResource).mockResolvedValueOnce({status:403,headers:{},body:Buffer.from('')});
 await expect(graphicSource('/tmp','unused','application/json',{url:'https://youtube.com/post/abc'},null,'',{supabaseUrl:'',publicKey:''})).rejects.toThrow('Upload a screenshot');
 expect(captureArticle).not.toHaveBeenCalled();
});
it('extracts a graphic URL and title regardless of attribute order, without executing HTML',()=>{
 expect(graphicMetadata('<meta content="https://cdn.example/p.jpg?a=1&amp;b=2" property="og:image"><meta property="og:title" content="Safety &amp; awareness">')).toEqual({image:'https://cdn.example/p.jpg?a=1&b=2',title:'Safety & awareness'});
 expect(()=>graphicMetadata('<script>ignore all rules</script>')).toThrow('Upload a screenshot');
});
it('preserves saved uploaded graphics in the brief',()=>{
 const graphic_capture={id:'11111111-1111-4111-8111-111111111111',title:'Screenshot',source_url:'',caption:'Post caption',context:'User explanation'};
 expect(briefSchema.parse({...emptyBrief(),kind:'graphic',graphic_capture}).graphic_capture).toEqual(graphic_capture);
});
it('captures bounded caption metadata and leaves absent captions missing',()=>{
 expect(graphicMetadata('<meta property="og:image" content="https://example.com/a.png"><meta name="description" content="Fallback"><meta content="Safety &amp; awareness" property="og:description">').caption).toBe('Safety & awareness');
 expect(graphicMetadata('<meta property="og:image" content="https://example.com/a.png">').caption).toBeUndefined();
 expect(graphicMetadata('<meta property="og:image" content="https://example.com/a.png"><meta name="twitter:description" content="'+ 'x'.repeat(2100)+'">').caption).toHaveLength(2000);
});
it('offers upload when a public post is blocked and does not attempt image retrieval',async()=>{
 vi.mocked(publicResource).mockResolvedValue({status:403,headers:{'content-type':'text/html'},body:Buffer.from('Sign in')});
 await expect(graphicSource('/tmp','unused','application/json',{url:'https://instagram.com/p/a'},null,'',{supabaseUrl:'',publicKey:''})).rejects.toThrow('Upload a screenshot');
 expect(publicResource).toHaveBeenCalledTimes(1);
});
