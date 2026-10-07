import {z} from 'zod';
export const articleDateSchema=z.object({preset:z.enum(['day','week','month','quarter','year','custom']).default('week'),timezone:z.string().max(100).default('UTC'),start:z.string().optional(),end:z.string().optional()}).strict();
export const articleWindowSchema=z.object({preset:articleDateSchema.shape.preset,timezone:z.string(),start:z.string().datetime(),end:z.string().datetime()});
export type ArticleDate=z.infer<typeof articleDateSchema>;
export type ArticleWindow=z.infer<typeof articleWindowSchema>;
export function localDate(date:Date,timezone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function midnight(value:string,timezone:string){
 const target=Date.parse(value+'T00:00:00Z');let guess=target;
 for(let n=0;n<4;n++){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));
  const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  const actual=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
  guess+=target-actual;
 }
 return guess;
}
export function resolveArticleWindow(input:ArticleDate,now=new Date()):ArticleWindow{
 try{
  const date=articleDateSchema.parse(input);const today=localDate(now,date.timezone);
  const earliest=localDate(new Date(now.getTime()-365*86400000),date.timezone);
  let start:number,end=now.getTime();
  if(date.preset==='custom'){
   if(!date.start||!date.end||!validDate(date.start)||!validDate(date.end)||date.start<earliest||date.end>today||date.start>date.end)throw Error();
   start=midnight(date.start,date.timezone);
   const next=new Date(Date.parse(date.end+'T00:00:00Z')+86400000).toISOString().slice(0,10);
   end=Math.min(midnight(next,date.timezone)-1,now.getTime());
  }else start=end-({day:1,week:7,month:30,quarter:90,year:365}[date.preset])*86400000;
  return {preset:date.preset,timezone:date.timezone,start:new Date(start).toISOString(),end:new Date(end).toISOString()};
 }catch{throw Error('ARTICLE_DATE_RANGE');}
}
export function publicationInWindow(value:string|null,window:ArticleWindow){
 if(!value)return false;
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
  // Date-only sources must start inside the window; do not infer an hour.
  if(!validDate(value))return false;
  const time=midnight(value,window.timezone);return time>=Date.parse(window.start)&&time<=Date.parse(window.end);
 }
 const time=Date.parse(value);return Number.isFinite(time)&&time>=Date.parse(window.start)&&time<=Date.parse(window.end);
}
export function articleSearchFilters(window:ArticleWindow){
 const format=(value:string)=>{const [y,m,d]=localDate(new Date(value),window.timezone).split('-');return `${m}/${d}/${y}`;};
 // Provider dates are day-granular/exclusive; fetch boundary days, then apply
 // the exact immutable window locally, never widening delivered results.
 return {search_after_date_filter:format(new Date(Date.parse(window.start)-86400000).toISOString()),search_before_date_filter:format(new Date(Date.parse(window.end)+86400000).toISOString()),...(window.preset==='day'?{search_recency_filter:'day'}:{})};
}
