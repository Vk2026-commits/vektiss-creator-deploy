import {it,expect,vi} from 'vitest';
import {validateAlphaSamples,validateAlphaStream,validateVerificationJob} from '../server/avatar-verification';
import {avatarVerification} from '../supabase/functions/_shared/avatar-verification';
import {presenterTestService} from '../supabase/functions/_shared/presenter-test-service';
import {readFileSync} from 'node:fs';
it('rejects opaque, blank, and rectangular alpha while accepting a silhouette',()=>{
 expect(()=>validateAlphaSamples(new Uint8Array(4096).fill(255))).toThrow();
 expect(()=>validateAlphaSamples(new Uint8Array(4096))).toThrow();
 const rectangle=new Uint8Array(4096);for(let y=10;y<60;y++)for(let x=20;x<45;x++)rectangle[y*64+x]=255;
 expect(()=>validateAlphaSamples(rectangle)).toThrow();
 const silhouette=new Uint8Array(4096);for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(((x-32)/18)**2+((y-32)/29)**2<1)silhouette[y*64+x]=255;
 expect(()=>validateAlphaSamples(silhouette)).not.toThrow();
 expect(()=>validateAlphaSamples(new Uint8Array([...silhouette,...rectangle]))).toThrow();
});
it('requires actual VP9 alpha, bounded dimensions, short duration and the owner’s completed test',()=>{
 const stream={codec_name:'vp9',tags:{alpha_mode:'1'},width:720,height:1280};
 expect(()=>validateAlphaStream(stream,12)).not.toThrow();
 expect(()=>validateAlphaStream({...stream,tags:{}},12)).toThrow();
 expect(()=>validateAlphaStream(stream,120)).toThrow();
 expect(()=>validateVerificationJob({id:'test',user_id:'a',status:'completed',snapshot:{scope:'test'},video_url:'x'},'test','b')).toThrow();
 expect(()=>validateVerificationJob({id:'test',user_id:'a',status:'completed',snapshot:{scope:'full'},video_url:'x'},'test','a')).toThrow();
});
it('scopes verification to account, connection, avatar, engine and shape; invalidates changed look',async()=>{
 const eq=vi.fn();const q:any={select:()=>q,eq:(...args:unknown[])=>{eq(...args);return q;},maybeSingle:async()=>({data:{test_id:'t',thumbnail_url:'old'},error:null})};
 const avatar={id:'a',connection_id:'c',thumbnail_url:'new'};
 expect(await avatarVerification({from:()=>q} as any,'owner',avatar,'avatar_iii','9:16')).toBeNull();
 for(const pair of [['user_id','owner'],['connection_id','c'],['avatar_id','a'],['engine','avatar_iii'],['aspect_ratio','9:16']])expect(eq).toHaveBeenCalledWith(...pair);
});
it('blocks direct paid full submissions before reservation when no test is verified',async()=>{
 const script={id:'s',user_id:'u',hook:'Hello',body:'This is a test.',cta:'',brief:{production:{step:'saved',approved_at:'now',presenter:'avatar',avatar_id:'a',format:'portrait'}}};
 const avatar={id:'a',status:'ready',provider_avatar_id:'provider',provider_voice_id:'voice',connection_id:'c',thumbnail_url:'photo'};
 const insert=vi.fn(),rpc=vi.fn();
 const db:any={rpc,from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,insert, single:async()=>({data:table==='creator_scripts'?script:avatar,error:null}),maybeSingle:async()=>({data:null,error:null})};return q;}};
 const service=presenterTestService(db,{} as any);
 const prepared:any=await service('u',{action:'prepare_test',script_id:'s',scope:'full'});
 await expect(service('u',{action:'start_test',script_id:'s',scope:'full',revision:prepared.revision,paid_consent:true})).rejects.toThrow('Complete and verify');
 expect(insert).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
});
it('keeps certification server-write-only',()=>{
 const sql=readFileSync('supabase/migrations/202610090004_avatar_verification.sql','utf8');
 expect(sql).toContain('revoke all on public.creator_avatar_verifications from anon,authenticated');
 expect(sql).toContain('user_id=(select auth.uid())');
 expect(sql).not.toContain('for insert to authenticated');
});
