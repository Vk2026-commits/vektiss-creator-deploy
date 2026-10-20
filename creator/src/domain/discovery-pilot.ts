import {z} from 'zod';
export const PILOT_PROFILE='3ea48507-fd4b-45bd-acfe-11d73489d867';
export const CANDIDATE_LIMIT=40;
export const INSPECTION_LIMIT=5;
export const sourceReviewSchema=z.object({
 level:z.enum(['metadata_only','transcript_reviewed','video_sampled']),
 accessibility:z.enum(['not_checked','accessible','blocked','unsupported','failed']),
 reviewedAt:z.string().datetime().nullable(),timestamps:z.array(z.number().min(0).max(180)).max(64),
 transcript:z.string().max(16000).default(''),observations:z.string().max(6000).default(''),
 claims:z.string().max(3000).default(''),limitations:z.string().max(2000),generationIds:z.array(z.string().uuid()).max(3).default([]),
});
export type SourceReview=z.infer<typeof sourceReviewSchema>;
export const metadataReview=(limitations='Only title/caption metadata has been inspected.'):SourceReview=>({level:'metadata_only',accessibility:'not_checked',reviewedAt:null,timestamps:[],transcript:'',observations:'',claims:'',limitations,generationIds:[]});
export const creatorSourceSchema=z.object({platform:z.enum(['TikTok','Instagram','YouTube']),identifier:z.string().min(1).max(100),url:z.string().url().max(2048),name:z.string().max(160)});
export type CreatorSource=z.infer<typeof creatorSourceSchema>;
export function videoIdentity(value:string):string|null{
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;const h=u.hostname.toLowerCase().replace(/^www\./,'');
 if(['youtube.com','m.youtube.com','youtu.be'].includes(h)){const id=h==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')??u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})\/?$/)?.[1];return id&&/^[\w-]{11}$/.test(id)?`YouTube:${id}`:null;}
 if(h==='tiktok.com'){const id=u.pathname.match(/^\/@[\w.-]+\/video\/(\d+)\/?$/)?.[1];return id?`TikTok:${id}`:null;}
 if(h==='instagram.com'){const id=u.pathname.match(/^\/(?:reels?|p)\/([\w-]+)\/?$/)?.[1];return id?`Instagram:${id}`:null;}
 return null;}catch{return null;}
}
export function canonicalVideo(value:string):string|null{const id=videoIdentity(value);if(!id)return null;const [p,k]=id.split(':');return p==='YouTube'?`https://www.youtube.com/watch?v=${k}`:p==='Instagram'?`https://www.instagram.com/reel/${k}/`:value.split(/[?#]/)[0].replace(/\/$/,'');}
export function creatorFromUrl(value:string):CreatorSource|null{
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;const h=u.hostname.toLowerCase().replace(/^www\./,'');
 if(h==='tiktok.com'){const id=u.pathname.match(/^\/@([\w.-]+)(?:\/video\/\d+)?\/?$/)?.[1];return id?{platform:'TikTok',identifier:id.toLowerCase(),url:`https://www.tiktok.com/@${id.toLowerCase()}`,name:id}:null;}
 if(h==='instagram.com'){const id=u.pathname.match(/^\/([\w.]+)\/?$/)?.[1];return id&&!['reel','reels','p','explore','accounts'].includes(id.toLowerCase())?{platform:'Instagram',identifier:id.toLowerCase(),url:`https://www.instagram.com/${id.toLowerCase()}/`,name:id}:null;}
 if(h==='youtube.com'){const id=u.pathname.match(/^\/(?:channel\/(UC[\w-]{22})|(@[\w.-]+))\/?$/);const k=id?.[1]??id?.[2];return k?{platform:'YouTube',identifier:k.startsWith('@')?k.toLowerCase():k,url:`https://www.youtube.com/${k.startsWith('@')?k:'channel/'+k}`,name:k}:null;}
 return null;}catch{return null;}
}
export function dedupeVideos<T extends {url:string}>(sources:T[],limit=CANDIDATE_LIMIT):T[]{const unique=new Map<string,T>();for(const source of sources){const id=videoIdentity(source.url);if(!id)continue;const prior=unique.get(id) as (T&{engagement?:unknown;creator?:unknown})|undefined;const next=source as T&{engagement?:unknown;creator?:unknown};unique.set(id,prior?{...prior,...(!prior.engagement&&next.engagement?{engagement:next.engagement}:{}),...(!prior.creator&&next.creator?{creator:next.creator}:{})}:source);}return [...unique.values()].slice(0,limit);}
export function incomeSearchLanes(context:string,seed?:string):string[]{const extra=context.replace(/[\r\n]+/g,' ').slice(0,180);const variants=[
 ['AI side hustle experiment actual results costs time spent','I tested AI side hustles real results','30 day AI business experiment profit','AI income experiment failed lessons'],
 ['first paying client AI service customer acquisition story','how I got my first AI automation client','first client AI freelancer case study','selling my first AI service local business'],
 ['selling AI automations local business client demonstration','AI automation agency paying customers demo','small business AI service sales case study','client AI workflow automation business results'],
 ['freelancer uses AI existing skills paid project walkthrough','freelancer AI paid client project','turning skills into AI services customers','AI freelancing real earnings breakdown'],
 ['AI business income claim revenue profit breakdown evidence','AI side hustle income claim proof costs','AI agency revenue results expenses breakdown','making money AI real profit customer results'],
 ];const hash=[...(seed??'')].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);return variants.map((v,i)=>v[seed?(hash>>>i)%v.length:0]).map(q=>extra?`${q} ${extra}`:q);}
export function reviewLabel(review?:SourceReview):string{return review?.level==='video_sampled'&&review.accessibility==='accessible'&&review.timestamps.length>0?'Video sampled':review?.level==='transcript_reviewed'&&review.accessibility==='accessible'&&review.transcript.trim()?'Transcript reviewed':'Metadata only';}
export function needsSourceCheck(sourceType?:string,uncertainty=''):boolean{return sourceType!=='article'||Boolean(uncertainty);}
export const discoveryReportSchema=z.object({summary:z.string().min(1).max(2500),claims:z.string().max(3000),observations:z.string().max(6000),angle:z.string().min(1).max(1800),limitations:z.string().min(1).max(2000)});
