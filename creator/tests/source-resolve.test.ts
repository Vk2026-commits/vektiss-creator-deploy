import {expect,it,vi,afterEach} from 'vitest';
import {resolveSource} from '../server/source-resolve';
import {cobaltMedia} from '../server/cobalt';
import {graphicSource} from '../server/graphic-source';
import {publicResource} from '../server/public-network';
import {writeFile} from 'node:fs/promises';
import {composerInput} from '../src/domain/resolved-source';
import {youtubePostImage} from '../server/youtube-post';
vi.mock('node:fs/promises',()=>({writeFile:vi.fn(),copyFile:vi.fn()}));
vi.mock('../server/cobalt',()=>({cobaltMedia:vi.fn()}));
vi.mock('../server/graphic-source',async original=>({...await original<typeof import('../server/graphic-source')>(),graphicSource:vi.fn()}));
vi.mock('../server/public-network',async original=>({...await original<typeof import('../server/public-network')>(),publicResource:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
const config={supabaseUrl:'',publicKey:''};
const run=(url:string)=>resolveSource('/tmp','unused','application/json',{url},'profile','',config);
it.each(['https://instagram.com/reel/abc','https://instagram.com/p/abc','https://tiktok.com/@name/video/123','https://vm.tiktok.com/abc/','https://youtube.com/watch?v=abcdefghijk','https://youtu.be/abcdefghijk'])('recognizes a confirmed video at %s and saves it once',async url=>{
 vi.mocked(cobaltMedia).mockResolvedValue({body:Buffer.from('video'),type:'video/mp4',firstOnly:false});
 expect(await run(url)).toMatchObject({kind:'video'});
 expect(cobaltMedia).toHaveBeenCalledOnce();expect(writeFile).toHaveBeenCalledTimes(2);expect(graphicSource).not.toHaveBeenCalled();
});
it.each(['https://instagram.com/p/photo','https://tiktok.com/@name/photo/123'])('recognizes a confirmed image at %s without requiring a caption',async url=>{
 vi.mocked(cobaltMedia).mockResolvedValue({body:Buffer.from('image'),type:'image/jpeg',firstOnly:true});
 vi.mocked(publicResource).mockRejectedValue(Error('blocked'));
 vi.mocked(graphicSource).mockResolvedValue({id:'11111111-1111-4111-8111-111111111111',title:'Graphic',source_url:url});
 expect(await run(url)).toMatchObject({kind:'graphic',firstOnly:true});
 expect(graphicSource).toHaveBeenCalledOnce();expect(writeFile).not.toHaveBeenCalled();
});
it('does not substitute a thumbnail when video extraction fails',async()=>{
 vi.mocked(cobaltMedia).mockRejectedValue(Error('VIDEO_LOGIN'));
 await expect(run('https://instagram.com/p/video')).rejects.toThrow('VIDEO_LOGIN');
 expect(graphicSource).not.toHaveBeenCalled();expect(publicResource).not.toHaveBeenCalled();
});
it('routes articles through the existing secure screenshot capture',async()=>{
 vi.mocked(graphicSource).mockResolvedValue({id:'11111111-1111-4111-8111-111111111111',title:'Article',source_url:'https://example.com/story'});
 expect(await run('https://example.com/story')).toMatchObject({kind:'article'});expect(cobaltMedia).not.toHaveBeenCalled();
});
it('rejects private and credential URLs before provider access',async()=>{
 for(const url of ['http://localhost','https://localhost','https://name:password@instagram.com/p/x'])await expect(run(url)).rejects.toThrow();
 expect(cobaltMedia).not.toHaveBeenCalled();
});
it('keeps written direction separate from source URLs and exposes conflicts',()=>{
 expect(composerInput('https://example.com/story\nFocus on what she did right')).toEqual({links:['https://example.com/story'],notes:'Focus on what she did right'});
 expect(composerInput('https://one.com https://two.com').links).toHaveLength(2);
});
it('uses only the requested YouTube post attachment, not other thumbnails',()=>{
 const html='var ytInitialData = '+JSON.stringify({items:[{backstagePostRenderer:{postId:'abc',contentText:{runs:[{text:'Caption'}]},backstageAttachment:{backstageImageRenderer:{image:{thumbnails:[{url:'https://example.com/image.jpg'}]}}}}}]})+';';
 expect(youtubePostImage(html,'abc')).toEqual({image:'https://example.com/image.jpg',caption:'Caption',firstOnly:false});
 expect(youtubePostImage(html,'other')).toBeNull();
 expect(youtubePostImage('<meta property="og:image" content="cover.jpg">','abc')).toBeNull();
});
