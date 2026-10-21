import {confirmedFailure,prioritize,selectionReason} from './discovery-selection.ts';
import {researchSourceSchema,type ResearchBrief,type ResearchSource} from '../../../src/domain/research.ts';
import {canonicalVideo,creatorFromUrl,incomeSearchLanes,dedupeVideos,type CreatorSource} from '../../../src/domain/discovery-pilot.ts';
import {collectEngagement,numericCount} from '../../../src/domain/discovery-engagement.ts';
declare const Deno:{env:{get(k:string):string|undefined}};
export const SC_REQUEST_LIMIT=40;
export type SCTask={id:string;platform:'TikTok'|'YouTube'|'Instagram';kind:'search'|'creator'|'detail';query?:string;url?:string;cursor?:string;page?:number;sort?:'relevance'|'most-liked';parentId?:string;nextCursor?:string;creator?:CreatorSource;state?:'done'|'failed'};
export type SCLedger={id:string;route:string;status:number;credits:number|null;remaining:number|null;at:string};
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
function date(v:unknown):string|null{if(v==null||v==='')return null;const n=typeof v==='number'?v:typeof v==='string'&&/^\d{9,13}$/.test(v)?Number(v):null;const d=n!==null?new Date(n<1e11?n*1000:n):new Date(String(v));return Number.isFinite(d.getTime())?d.toISOString():null;}
export function scrapeEnabled(){return Deno.env.get('CREATOR_DISCOVERY_PROVIDER')==='scrapecreators';}
export function normalizeSC(platform:SCTask['platform'],value:unknown,fallback?:CreatorSource):ResearchSource|null{
 let r=obj(value);r=obj(r.aweme_info??r.media??value);const author=obj(r.author),channel=obj(r.channel),owner=obj(r.owner??r.user),stats=obj(r.statistics);
 let url='',caption='',publishedAt:string|null=null,creator:CreatorSource|null=null,metrics:Record<string,unknown>={},durationSeconds:number|undefined;
 if(platform==='TikTok'){
  const handle=String(author.unique_id??author.uniqueId??author.username??fallback?.identifier??'');const id=String(r.aweme_id??r.id??'');url=String(r.url??r.webVideoUrl??(handle&&id?`https://www.tiktok.com/@${handle}/video/${id}`:''));caption=String(r.desc??r.text??'');publishedAt=date(r.create_time_utc??r.create_time??r.createTimeISO);creator=creatorFromUrl(url);metrics={views:stats.play_count??r.play_count,likes:stats.digg_count??r.digg_count,comments:stats.comment_count??r.comment_count,shares:stats.share_count??r.share_count};const milliseconds=numericCount(obj(r.video).duration);if(milliseconds!==null)durationSeconds=milliseconds/1000;
 }else if(platform==='YouTube'){
  url=String(r.url??(r.id?`https://www.youtube.com/shorts/${r.id}`:''));caption=[r.title,r.description].filter(v=>typeof v==='string').join('\n');publishedAt=date(r.publishDate??r.publishedTime);creator=creatorFromUrl(channel.id?'https://www.youtube.com/channel/'+channel.id:channel.handle?'https://www.youtube.com/@'+String(channel.handle).replace(/^@/,''):'')??fallback??null;metrics={views:r.viewCountInt??r.views,likes:r.likeCountInt,comments:r.commentCountInt};const ms=numericCount(r.durationMs),seconds=numericCount(r.lengthSeconds);if(ms!==null||seconds!==null)durationSeconds=ms!==null?ms/1000:seconds!;
 }else{
  const code=r.shortcode??r.code;url=String(r.url??(code?`https://www.instagram.com/reel/${code}/`:''));caption=typeof r.caption==='string'?r.caption:String(obj(r.caption).text??r.edge_media_to_caption?.edges?.[0]?.node?.text??'');publishedAt=date(r.created_at??r.taken_at_timestamp??r.taken_at);creator=creatorFromUrl(owner.username?'https://www.instagram.com/'+owner.username+'/':'')??fallback??null;metrics={views:r.ig_play_count??r.video_play_count??r.play_count??r.video_view_count,likes:r.like_count??r.edge_media_preview_like?.count??r.edge_liked_by?.count,comments:r.comment_count??r.edge_media_preview_comment?.count??r.edge_media_to_parent_comment?.count};const seconds=numericCount(r.video_duration);if(seconds!==null)durationSeconds=seconds;
 }
 const canonical=canonicalVideo(url);if(!canonical)return null;
 const engagement=collectEngagement(metrics,'Scrape Creators');
 const parsed=researchSourceSchema.safeParse({providerSourceId:1,url:canonical,title:(String(r.title??caption).replace(/\s+/g,' ').trim()||`${platform} public creator video`).slice(0,300),snippet:caption.slice(0,1200),publishedAt,sourceType:platform==='TikTok'?'tiktok-native':platform==='YouTube'?'youtube-shorts-native':'instagram-reels-native',creator:creator??undefined,engagement,durationSeconds});return parsed.success?parsed.data:null;
}
export type SCGroup={id:string;sources:ResearchSource[]};
// Round-robin across lanes and platforms before imposing the global 40-clip cap.
export function balancedSources(groups:SCGroup[]):ResearchSource[]{
 const rows:ResearchSource[]=[];
 for(let i=0;i<10;i++)for(const group of groups)if(group.sources[i])rows.push(group.sources[i]);
 return dedupeVideos(rows,40);
}
export function scrapeTasks(brief:ResearchBrief,seed:string,watchlist:CreatorSource[]=[]):SCTask[]{
 const platforms=brief.researchSourcePlatforms.length?brief.researchSourcePlatforms:['TikTok','Instagram','YouTube'] as const;
 // Short search phrases come from the actual profile; the full exclusions stay in screening.
 const topics=brief.sourceTopics.filter(t=>t.trim()).map(t=>t.trim().split(/\s+/).slice(0,7).join(' '));
 const defaults=['AI side hustle results','first AI client','selling AI automation','AI freelancing income','AI business revenue'];
 const groups=[/experiment|side hustle|results/i,/first|client|customer/i,/automation|service/i,/freelanc|skill/i,/income|revenue|profit|business/i];
 const lanes=groups.map((re,i)=>{const options=topics.filter(t=>re.test(t));return options.length?options[(seed.charCodeAt(i%seed.length)||0)%options.length]:defaults[i];});
 const directives=(brief.researchSeekSituations+' '+brief.researchScreeningCriteria).toLowerCase();
 return [...lanes.flatMap((query,i)=>platforms.map(platform=>({id:`search-${platform}-${i}`,platform,kind:'search' as const,query:platform==='Instagram'&&/demonstrat|case stud/.test(directives)&&i===2?query+' demo':query}))),...watchlist.filter(c=>platforms.includes(c.platform)).slice(0,20).map((creator,i)=>({id:`watch-${i}`,platform:creator.platform,kind:'creator' as const,creator}))].slice(0,35);
}
export function detailTasks(sources:ResearchSource[],existing:SCTask[],limit:number,brief?:ResearchBrief):SCTask[]{
 const done=new Set(existing.filter(t=>t.kind==='detail').map(t=>t.url));
 const needs=sources.filter(s=>!done.has(s.url)&&!s.sourceType.includes('tiktok')&&(brief?!confirmedFailure(s,brief)&&Boolean(selectionReason(s,brief)):(s.engagement?.views==null||s.engagement?.likes==null||!s.publishedAt)));
 const sorted=brief?prioritize(needs,brief):[...needs].sort((a,b)=>(b.engagement?.views??b.engagement?.likes??0)-(a.engagement?.views??a.engagement?.likes??0));
 const groups=['YouTube','Instagram'].map(platform=>sorted.filter(s=>(s.creator?.platform??(s.sourceType.includes('youtube')?'YouTube':'Instagram'))===platform));
 const balanced:ResearchSource[]=[];for(let i=0;i<sorted.length;i++)for(const group of groups)if(group[i])balanced.push(group[i]);
 return balanced.slice(0,Math.max(0,limit)).map((source,i)=>({id:'detail-'+existing.length+'-'+i,platform:source.creator?.platform??(source.sourceType.includes('youtube')?'YouTube':'Instagram'),kind:'detail',url:source.url,creator:source.creator}));
}
export function expansionTask(tasks:SCTask[]):SCTask|undefined{
 const roots=tasks.filter(t=>t.kind==='search'&&!t.parentId&&t.state==='done');
 for(const root of roots){
  const family=tasks.filter(t=>t.id===root.id||t.parentId===root.id);
  if(family.length>=3)continue;
  const last=family[family.length-1];if(last.state!=='done')continue;
  const cursor=last.nextCursor&&last.nextCursor!=='0'?last.nextCursor:undefined;
  if(cursor&&family.some(t=>t.cursor===cursor))continue;
  if(root.platform==='Instagram')return {...root,id:root.id+'-page-'+(family.length+1),state:undefined,parentId:root.id,page:family.length+1};
  if(cursor)return {...root,id:root.id+'-page-'+(family.length+1),state:undefined,parentId:root.id,cursor};
  if(family.length===1)return {...root,id:root.id+'-alternate',state:undefined,parentId:root.id,query:root.query+' '+(root.platform==='TikTok'?'results':'case study'),sort:'relevance'};
 }
 return undefined;
}
export function scrapeUnavailable(ledger:SCLedger[]):boolean{return ledger.some(l=>l.remaining===0||[401,402,403].includes(l.status));}
export async function runSCTask(task:SCTask,brief:ResearchBrief):Promise<{sources:ResearchSource[];ledger:SCLedger;nextCursor?:string;diagnostic?:string}>{
 const key=Deno.env.get('CREATOR_SCRAPECREATORS_API_KEY');if(!key)throw Error('SCRAPECREATORS_NOT_CONFIGURED');
 let path='';const q:Record<string,string>={};const days=brief.discoveryFilters?.maxAgeDays??0,popular=brief.discoveryFilters?.mode!=='relevant'||(brief.discoveryFilters?.minViews??0)>=100000;
 if(task.kind==='search'){
  q.query=task.query!;
  if(task.platform==='TikTok'){path='/v1/tiktok/search/keyword';q.region='US';q.trim='true';q.sort_by=task.sort??(popular?'most-liked':'relevance');if(task.cursor)q.cursor=task.cursor;q.date_posted=days<=7&&days?'this-week':days<=30&&days?'this-month':days<=90&&days?'last-3-months':days?'last-6-months':'all-time';}
  if(task.platform==='YouTube'){path='/v1/youtube/search';q.type='shorts';q.sortBy='relevance';q.includeExtras='true';if(task.cursor)q.continuationToken=task.cursor;if(days)q.uploadDate=days<=7?'this_week':days<=30?'this_month':'this_year';}
  if(task.platform==='Instagram'){path='/v2/instagram/reels/search';if(task.page)q.page=String(task.page);if(days)q.date_posted=days<=7?'last-week':days<=30?'last-month':'last-year';}
 }else if(task.kind==='detail'){
  q.url=canonicalVideo(task.url!)!;
  if(task.platform==='YouTube')path='/v1/youtube/video';else{path='/v1/instagram/post';q.trim='true';q.include_play_count='true';q.download_media='false';}
 }else{
  const c=task.creator!;
  if(task.platform==='TikTok'){path='/v3/tiktok/profile/videos';q.handle=c.identifier;q.sort_by='latest';q.include_pinned='false';q.trim='true';q.region='US';}
  if(task.platform==='YouTube'){path='/v1/youtube/channel/shorts';q[c.identifier.startsWith('UC')?'channelId':'handle']=c.identifier;q.sort='newest';}
  if(task.platform==='Instagram'){path='/v1/instagram/user/reels';q.handle=c.identifier;q.trim='true';}
 }
 const ledger:SCLedger={id:task.id,route:path,status:0,credits:null,remaining:null,at:new Date().toISOString()};
 try{
  const url=new URL('https://api.scrapecreators.com'+path);for(const [k,v]of Object.entries(q))url.searchParams.set(k,v);
  const response=await fetch(url,{headers:{'x-api-key':key},signal:AbortSignal.timeout(23000)});ledger.status=response.status;
  const raw=obj(await response.json());ledger.credits=numericCount(raw.credits_charged);ledger.remaining=numericCount(raw.credits_remaining);
  if(!response.ok||raw.success===false)return {sources:[],ledger,diagnostic:`Scrape Creators ${task.platform} ${task.kind}: HTTP ${response.status}; no Apify fallback requested.`};
  let rows:unknown[]=[];
  if(task.kind==='detail')rows=[task.platform==='Instagram'?raw.data?.xdt_shortcode_media??raw.data??raw:raw];
  else if(task.platform==='TikTok')rows=raw.search_item_list??raw.aweme_list??[];
  else if(task.platform==='YouTube')rows=raw.shorts??[];
  else rows=raw.reels??raw.items??[];
  const sources=dedupeVideos((Array.isArray(rows)?rows:[]).flatMap(v=>{const s=normalizeSC(task.platform,v,task.creator);return s?[s]:[];}),task.kind==='creator'?10:250);
  const token=raw.cursor??raw.continuationToken;return {sources,ledger,nextCursor:token==null?undefined:String(token)};
 }catch{return {sources:[],ledger,diagnostic:`Scrape Creators ${task.platform} ${task.kind} unavailable or timed out; metrics remain unknown.`};}
}
