import type {Script} from './scripts';

// Saved projects are account scoped. Never restore a disconnected/deleted look.
export function recentAvatarPlan(scripts:Script[],availableIds:string[]){
 const available=new Set(availableIds);
 return [...scripts].sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))
  .map(s=>s.brief.production)
  .find(p=>p?.presenter==='avatar'&&p.avatar_id&&available.has(p.avatar_id));
}
