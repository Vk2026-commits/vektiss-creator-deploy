import type {ResearchBrief,ResearchSource} from '../../../src/domain/research.ts';
import {discoveryFiltersSchema,engagementFailure,collectEngagement} from '../../../src/domain/discovery-engagement.ts';
import {dedupeVideos,videoIdentity} from '../../../src/domain/discovery-pilot.ts';
export const RAW_POOL_LIMIT=250;
export function selectionReason(source:ResearchSource,brief:ResearchBrief,now=Date.now()):string|null{
 const f=brief.discoveryFilters??discoveryFiltersSchema.parse({});
 const p=videoIdentity(source.url)?.split(':')[0];
 if(f.platform!=='all'&&p!==f.platform)return 'platform';
 if(f.maxAgeDays&&source.publishedAt&&(!Number.isFinite(Date.parse(source.publishedAt))||Date.parse(source.publishedAt)>now+86400000||Date.parse(source.publishedAt)<now-f.maxAgeDays*86400000))return 'outside_date_range';
 const e=source.engagement;
 if(f.minViews>0&&e?.views!=null&&e.views<f.minViews)return 'below_minimum_views';
 if(f.minEngagementRate>0&&e?.rate!=null&&e.rate<f.minEngagementRate)return 'below_minimum_engagement';
 if(f.maxAgeDays&&!source.publishedAt)return 'date_unavailable';
 if(f.minViews>0&&e?.views==null)return 'views_unavailable';
 if(f.minEngagementRate>0&&e?.rate==null)return 'engagement_unavailable';
 return null;
}
export const confirmedFailure=(s:ResearchSource,b:ResearchBrief)=>{const r=selectionReason(s,b);return r==='platform'||r?.startsWith('outside_')||r?.startsWith('below_');};
export function topicScore(s:ResearchSource,b:ResearchBrief):number{
 const text=(s.title+' '+s.snippet).toLowerCase();
 const terms=[...b.sourceTopics,...b.contentPillars??[]].join(' ').toLowerCase().match(/[a-z][a-z0-9]{1,}/g)??[];
 const stop=new Set(['the','and','with','for','from','how','make','money','using','your','you','get','into']);
 return [...new Set(terms)].filter(t=>!stop.has(t)&&new RegExp('\\b'+t+'\\b','i').test(text)).length;
}
export function prioritize(sources:ResearchSource[],brief:ResearchBrief):ResearchSource[]{
 return [...sources].sort((a,b)=>{
  const tier=(s:ResearchSource)=>confirmedFailure(s,brief)?0:selectionReason(s,brief)?1:2;
  return tier(b)-tier(a)||topicScore(b,brief)-topicScore(a,brief)||(b.engagement?.views??b.engagement?.likes??0)-(a.engagement?.views??a.engagement?.likes??0);
 });
}
export function mergePool(old:ResearchSource[],incoming:ResearchSource[],brief:ResearchBrief):ResearchSource[]{
 // Keep compact source records once, rather than duplicating per-query groups.
 const byId=new Map(old.map(s=>[videoIdentity(s.url),s]));
 for(const s of incoming){const id=videoIdentity(s.url);const previous=byId.get(id);byId.set(id,previous?{...previous,...s,title:/public creator video$/.test(s.title)?previous.title:s.title,snippet:s.snippet||previous.snippet,publishedAt:s.publishedAt??previous.publishedAt,creator:s.creator??previous.creator,durationSeconds:s.durationSeconds??previous.durationSeconds,engagement:s.engagement?{...s.engagement,views:s.engagement.views??previous.engagement?.views??null,likes:s.engagement.likes??previous.engagement?.likes??null,comments:s.engagement.comments??previous.engagement?.comments??null,shares:s.engagement.shares??previous.engagement?.shares??null,rate:s.engagement.rate??previous.engagement?.rate??null}:previous.engagement}:s);}
 return prioritize([...byId.values()],brief).slice(0,RAW_POOL_LIMIT).map(s=>({...s,title:s.title.slice(0,220),snippet:s.snippet.slice(0,650),engagement:s.engagement?{...s.engagement,rate:collectEngagement(s.engagement,s.engagement.provider).rate}:undefined}));
}
export function shortlist(pool:ResearchSource[],brief:ResearchBrief,excluded:string[]=[],limit=40):ResearchSource[]{
 const seen=new Set(excluded.map(videoIdentity));
 const f=brief.discoveryFilters??discoveryFiltersSchema.parse({});
 return dedupeVideos(prioritize(pool.filter(s=>!seen.has(videoIdentity(s.url))&&!engagementFailure(s,{...f,mode:'engaged'})),brief),limit);
}
export function selectionDiagnostics(pool:ResearchSource[],brief:ResearchBrief,requireBaseline=false){
 const excluded:Record<string,number>={};let passed=0;
 for(const s of pool){const reason=selectionReason(s,brief)??(requireBaseline&&brief.discoveryFilters?.mode==='outliers'&&engagementFailure(s,brief.discoveryFilters)?s.engagement?.baseline?'below_outlier_multiple':'outlier_baseline_unavailable':null);if(reason)excluded[reason]=(excluded[reason]??0)+1;else passed++;}
 return {filters:brief.discoveryFilters,freshCandidates:pool.length,passed,excluded};
}
