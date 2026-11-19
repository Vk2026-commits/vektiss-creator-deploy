import {it,expect,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {templateEdit} from '../server/template-edit';
it('recovers from cached words using only authenticated reads; missing cache never calls AI',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ranking-recovery-'));
 const id='00000000-0000-4000-8000-000000000001',bytes=Buffer.from('fixture'),revision=createHash('sha256').update(bytes).digest('hex');
 await mkdir(join(root,'edit/compositions'),{recursive:true});await mkdir(join(root,'edit/template-plans'),{recursive:true});await writeFile(join(root,'edit/compositions',id+'.mp4'),bytes);
 const fetcher=vi.fn(async (url:any,init:any)=>{expect(init.method).toBeUndefined();expect(init.headers.Authorization).toBe('Bearer fixture');if(String(url).includes('/content_profiles?'))return Response.json([{id,name:'Profile',strategy:{}}]);if(String(url).includes('/creator_scripts?'))return Response.json([{title:'One ranking',brief:{avatar_creation:{approved:true,template:'tier-list',items:[{label:'Social posts',rating:'C'}]}}}]);throw Error('Unexpected network call');});
 vi.stubGlobal('fetch',fetcher);
 const options={template:'tier-list',profileId:id,exportId:id,approvedRankingOnly:true};
 try{
  await expect(templateEdit(root,'','',options,'Bearer fixture',{supabaseUrl:'https://example.test',publicKey:'public'})).rejects.toThrow('No AI call was made');
  const words=['Social','posts','C','tier','Comment','AUDIT'].map((text,i)=>({text,start:i,end:i+1}));
  await writeFile(join(root,'edit/template-plans',revision+'.source.json'),JSON.stringify({assetId:id,revision,kind:'avatar',duration:6,words}));
  const result=await templateEdit(root,'','',options,'Bearer fixture',{supabaseUrl:'https://example.test',publicKey:'public'});
  expect(result.proposal.beats[0].graphics.nodes[0].revealWord).toBe(2);expect(fetcher).toHaveBeenCalledTimes(3);
 }finally{vi.unstubAllGlobals();await rm(root,{recursive:true,force:true});}
});
