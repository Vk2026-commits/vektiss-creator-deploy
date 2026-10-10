import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {avatarThumbnail,thumbnailKey} from '../server/avatar-thumbnail';
const avatar={id:'11111111-1111-4111-8111-111111111111',connection_id:'connection',thumbnail_url:'https://files2.heygen.ai/look/photo.webp?signature=one'};
afterEach(()=>vi.restoreAllMocks());
it('keys by avatar, connection, source and processing version, not expiring signature',()=>{
 expect(thumbnailKey(avatar)).toBe(thumbnailKey({...avatar,thumbnail_url:avatar.thumbnail_url.replace('one','two')}));
 expect(thumbnailKey(avatar)).not.toBe(thumbnailKey({...avatar,id:'other'}));
 expect(thumbnailKey(avatar)).not.toBe(thumbnailKey({...avatar,connection_id:'other'}));
 expect(thumbnailKey(avatar)).not.toBe(thumbnailKey({...avatar,thumbnail_url:'https://files2.heygen.ai/look/new.webp'}));
 expect(()=>thumbnailKey({...avatar,thumbnail_url:'https://127.0.0.1/a'})).toThrow();
 expect(()=>thumbnailKey({...avatar,thumbnail_url:'https://heygen.ai.evil.example/a'})).toThrow();
});
it('checks current owner access even when a cached thumbnail exists',async()=>{
 const root=await mkdtemp(join(tmpdir(),'avatar-thumb-'));
 try{
  await mkdir(join(root,'avatar-thumbnails'));await writeFile(join(root,'avatar-thumbnails',thumbnailKey(avatar)+'.png'),'cached');
  const request=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify([avatar])));
  const config={supabaseUrl:'https://project.supabase.co',publicKey:'public'};
  expect((await avatarThumbnail(root,avatar.id,'owner','Bearer test',config)).toString()).toBe('cached');
  expect(String(request.mock.calls[0][0])).toContain('user_id=eq.owner');
  request.mockResolvedValue(new Response('[]'));
  await expect(avatarThumbnail(root,avatar.id,'other','Bearer other',config)).rejects.toThrow('Avatar not found');
 }finally{await rm(root,{recursive:true,force:true});}
});
