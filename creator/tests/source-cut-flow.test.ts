import {it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),analyze:vi.fn()}));
vi.mock('../src/lib/media-fetch',()=>({mediaFetch:mocks.fetch}));
vi.mock('../src/lib/video-analysis',()=>({analyzeVideo:mocks.analyze}));
import {analyzeSelection} from '../src/lib/source-cut';
beforeEach(()=>{vi.clearAllMocks();});
it('analyzes only the saved trimmed clip, never the other creator’s full reaction',async()=>{
 const original=new Blob(['full source'],{type:'video/mp4'});
 mocks.fetch.mockResolvedValueOnce(Response.json({id:'selected'})).mockResolvedValueOnce(new Response(new Blob(['original footage only'],{type:'video/mp4'})));
 mocks.analyze.mockResolvedValueOnce({text:'Report on original footage.'});
 const result=await analyzeSelection(original,'original',130,56,'reaction starts', 'profile',()=>{});
 expect(mocks.fetch.mock.calls[0][1].headers['X-Source-End']).toBe('56');
 expect(await mocks.analyze.mock.calls[0][0].text()).toBe('original footage only');
 expect(result.cut).toMatchObject({original_id:'original',selected_id:'selected',end:56});
});
it('does not silently use the full source if trimming fails',async()=>{
 mocks.fetch.mockResolvedValueOnce(Response.json({error:'Trim failed'},{status:422}));
 await expect(analyzeSelection(new Blob(['source']), 'original',130,56,'', 'profile',()=>{})).rejects.toThrow('Trim failed');
 expect(mocks.analyze).not.toHaveBeenCalled();
});
it('reuses the original when there is no reaction and rejects invalid manual cuts',async()=>{
 const original=new Blob(['source']);mocks.analyze.mockResolvedValue({text:'Report'});
 const result=await analyzeSelection(original,'original',10,10,'no reaction','profile',()=>{});
 expect(mocks.fetch).not.toHaveBeenCalled();expect(result.cut.selected_id).toBe('original');
 await expect(analyzeSelection(original,'original',10,11,'','profile',()=>{})).rejects.toThrow();
});
