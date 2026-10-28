import {collectEngagement} from '../../../src/domain/discovery-engagement.ts';
import {canonicalVideo,creatorFromUrl,dedupeVideos,incomeSearchLanes,type CreatorSource} from '../../../src/domain/discovery-pilot.ts';
import {researchSourceSchema,type ResearchSource,type ResearchBrief} from '../../../src/domain/research.ts';
declare const Deno:{env:{get(k:string):string|undefined}};
const env=(n:string)=>Deno.env.get(n);
const reason=(e:unknown)=>e instanceof Error?e.message.slice(0,120):'unavailable';
function source(url:string,title:string,snippet:string,date?:string|null,creator?:CreatorSource):ResearchSource|null{const canonical=canonicalVideo(url);if(!canonical)return null;const parsed=researchSourceSchema.safeParse({providerSourceId:1,url:canonical,title:title.slice(0,300)||'Source video',snippet:snippet.slice(0,1200),publishedAt:date&&/^\d{4}-\d\d-\d\d/.test(date)?date:null,sourceType:'indexed-social-video',creator});return parsed.success?parsed.data:null;}
export async function indexedVideoSearch(brief:ResearchBrief,seed?:string){
 const key=env('CREATOR_PERPLEXITY_API_KEY');if(!key)return {sources:[],diagnostics:['Perplexity Search not configured']};
 const queries=(brief.searchQuery?[brief.searchQuery]:incomeSearchLanes(brief.sourceTopics.slice(0,2).join(' '),seed));const sources:ResearchSource[]=[];const diagnostics:string[]=[];
 // Bound concurrent web requests. Native-platform discovery runs separately.
 for(let i=0;i<queries.length;i+=2){await Promise.all(queries.slice(i,i+2).map(async query=>{try{const response=await fetch('https://api.perplexity.ai/search',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({query,max_results:8,search_domain_filter:brief.researchSourcePlatforms.map(p=>p==='YouTube'?'youtube.com':p==='TikTok'?'tiktok.com':'instagram.com')}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error(`Perplexity Search ${response.status}`);const data=await response.json();for(const r of Array.isArray(data.results)?data.results:[]){const s=source(String(r.url),String(r.title??''),String(r.snippet??''),r.date);if(s)sources.push(s);}}catch(e){diagnostics.push(reason(e));}}));}
 return {sources:dedupeVideos(sources),diagnostics,queryCount:queries.length};
}
export async function youtubeSearch(brief:ResearchBrief,watchlist:CreatorSource[]=[],seed?:string){
 const key=env('CREATOR_YOUTUBE_API_KEY');if(!key)return {sources:[],diagnostics:['YouTube API not configured; Apify fallback retained'],quotaCalls:0};
 const sources:ResearchSource[]=[];const diagnostics:string[]=[];let quotaCalls=0;
 async function get(path:string,params:Record<string,string>){quotaCalls++;const u=new URL('https://www.googleapis.com/youtube/v3/'+path);for(const [k,v]of Object.entries({...params,key:key!}))u.searchParams.set(k,v);const r=await fetch(u,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error(`YouTube API ${r.status}; Apify fallback retained`);return r.json();}
 try{const ids=new Set<string>();await Promise.all((brief.searchQuery?[brief.searchQuery]:incomeSearchLanes(brief.sourceTopics.slice(0,2).join(' '),seed)).map(async query=>{const data=await get('search',{part:'snippet',type:'video',q:query,maxResults:'5',videoDuration:'short',order:brief.discoveryFilters?.mode==='relevant'?'relevance':'viewCount',publishedAfter:new Date(Date.now()-(brief.discoveryFilters?.maxAgeDays||365)*86400000).toISOString()});for(const x of data.items??[])if(x.id?.videoId)ids.add(x.id.videoId);}));
 await Promise.all(watchlist.filter(w=>w.platform==='YouTube').slice(0,5).map(async w=>{const channels=await get('channels',{part:'contentDetails',...(w.identifier.startsWith('@')?{forHandle:w.identifier}:{id:w.identifier})});const id=channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;if(!id)return;const videos=await get('playlistItems',{part:'contentDetails',playlistId:id,maxResults:'5'});for(const v of videos.items??[])if(v.contentDetails?.videoId)ids.add(v.contentDetails.videoId);}));
 if(ids.size){const data=await get('videos',{part:'snippet,contentDetails,status,statistics',id:[...ids].slice(0,40).join(',')});for(const v of data.items??[]){if(v.status?.privacyStatus!=='public')continue;const c=creatorFromUrl('https://www.youtube.com/channel/'+v.snippet.channelId)??undefined;const s=source('https://www.youtube.com/watch?v='+v.id,v.snippet.title,v.snippet.description,v.snippet.publishedAt,c);if(s)sources.push({...s,sourceType:'youtube-api',engagement:collectEngagement(v,'YouTube API')});}}
 }catch(e){diagnostics.push(reason(e));}
 return {sources:dedupeVideos(sources),diagnostics,quotaCalls};
}
