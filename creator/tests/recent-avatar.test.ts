import {expect,it} from 'vitest';
import {recentAvatarPlan} from '../src/domain/recent-avatar';
import {newVideoPlan} from '../src/domain/video-plan';
import {emptyBrief} from '../src/domain/script-brief';
import type {Script} from '../src/domain/scripts';
const saved=(id:string,date:string,avatar:string|null):Script=>({id,updated_at:date,content_profile_id:'profile',title:'Video',hook:'',body:'',cta:'',brief:{...emptyBrief(),production:{...newVideoPlan(),presenter:'avatar',avatar_id:avatar,avatar_name:avatar??'',avatar_engine:'avatar_v'}}});
it('restores the latest available avatar even when history is unordered',()=>{
 const old=saved('old','2026-11-01','a'),recent=saved('recent','2026-11-15','b');
 expect(recentAvatarPlan([old,recent],['a','b'])).toBe(recent.brief.production);
});
it('skips empty drafts and removed avatars without choosing an arbitrary look',()=>{
 const old=saved('old','2026-11-01','a'),removed=saved('removed','2026-11-15','b'),draft=saved('draft','2026-11-16',null);
 expect(recentAvatarPlan([draft,removed,old],['a'])?.avatar_id).toBe('a');
 expect(recentAvatarPlan([draft,removed],['a'])).toBeUndefined();
 expect(recentAvatarPlan([],['a'])).toBeUndefined();
});
