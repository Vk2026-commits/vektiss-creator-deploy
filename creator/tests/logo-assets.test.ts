import {it,expect} from 'vitest';
import {mentionedBrands} from '../src/domain/logo-assets';
import {officialIconCandidates,discoverLogos,approvedRenderLogos} from '../server/logo-assets';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
it('matches whole brand names and keeps source word anchors',()=>{
 expect(mentionedBrands('Use Chat GPT and Claude, then GitHub.'.split(' ').map(text=>({text}))).map(b=>[b.id,b.firstWord])).toEqual([['chatgpt',1],['claude',4],['github',6]]);
 expect(mentionedBrands([{text:'notional'},{text:'geminids'}])).toEqual([]);
});
it('only takes official same-site icon links and ranks larger icons first',()=>{
 const html='<link rel="icon" sizes="32x32" href="/small.png"><link rel="apple-touch-icon" href="/large.png"><link rel="icon" href="https://evil.example/logo.png"><link rel="icon" href="http://127.0.0.1/x">';
 expect(officialIconCandidates(html,'https://brand.example/')).toEqual(['https://brand.example/large.png','https://brand.example/small.png']);
});
it('does not export unreviewed or omitted logos',async()=>{
 const root=await mkdtemp(join(tmpdir(),'logo-test-'));
 const logo={brandId:'claude',name:'Claude',site:'https://claude.ai/',status:'pending',firstWord:0};
 try{await expect(approvedRenderLogos(root,[logo])).rejects.toThrow('Review suggested logos');expect(await approvedRenderLogos(root,[{...logo,status:'omitted'}])).toEqual([]);}finally{await rm(root,{recursive:true,force:true});}
});
it.skipIf(process.env.CREATOR_LOGO_NETWORK_QA!=='1')('retrieves official assets without a paid provider',async()=>{
 const result=await discoverLogos('/Users/vkrr/Downloads/edit/verify/logo-retrieval','ChatGPT Claude GitHub OpenAI Gemini'.split(' ').map(text=>({text})));
 console.log(JSON.stringify(result));expect(result.some(l=>l.assetId)).toBe(true);
},90000);
