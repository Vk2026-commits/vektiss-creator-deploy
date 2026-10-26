import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readEditBrand,saveEditBrand} from '../server/edit-brand';
import {defaultEditBrand,editBrandSchema} from '../src/domain/edit-brand';

it('persists creator defaults across reads without changing another account',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creator-brand-'));
 try{
  const alice=join(root,'alice'),bob=join(root,'bob');
  expect((await readEditBrand(alice)).version).toBe(0);
  const brand={...defaultEditBrand,primary:'#CC3366',captionStyle:'bold' as const};
  const saved=await saveEditBrand(alice,{baseVersion:0,brand});
  expect(await readEditBrand(alice)).toEqual(saved);
  expect((await readEditBrand(bob)).brand).toEqual(defaultEditBrand);
  await expect(saveEditBrand(alice,{baseVersion:0,brand})).rejects.toThrow('changed');
  expect((await saveEditBrand(alice,{baseVersion:1,brand:{...brand,captionStyle:'none'}})).version).toBe(2);
 }finally{await rm(root,{recursive:true,force:true});}
});
it('rejects arbitrary styles, CSS, paths, and malformed colors',()=>{
 for(const invalid of [{primary:'red'},{primary:'url(https://example.com)'},{captionStyle:'custom-code'},{owner:'other'}])expect(()=>editBrandSchema.parse({...defaultEditBrand,...invalid})).toThrow();
 for(const captionStyle of ['highlight','clean','bold','none'])expect(editBrandSchema.parse({...defaultEditBrand,captionStyle}).captionStyle).toBe(captionStyle);
});
