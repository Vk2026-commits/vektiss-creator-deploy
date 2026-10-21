import {z} from 'zod';

// Editorial shortlist, not a guarantee that every page on these domains is news.
export const ARTICLE_NEWS_DOMAINS=[
 'reuters.com','apnews.com','bbc.com','bbc.co.uk','cnbc.com','bloomberg.com','wsj.com','ft.com','nytimes.com','theguardian.com',
 'cnn.com','businessinsider.com','fortune.com','techcrunch.com','wired.com','theverge.com','arstechnica.com','technologyreview.com','axios.com','fastcompany.com',
] as const;
export const articleReviewSchema=z.object({
 language:z.enum(['en','other','unknown']),
 editorialType:z.enum(['reporting','analysis','opinion','sponsored','press_release','unknown']),
 excerpt:z.string().min(40).max(1800),
 reviewedAt:z.string().datetime(),
 method:z.literal('provider_source_text'),
}).strict();
export function approvedNewsUrl(value:string):boolean{
 try{
  const u=new URL(value),host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(!ARTICLE_NEWS_DOMAINS.includes(host as typeof ARTICLE_NEWS_DOMAINS[number]))return false;
  const path=decodeURIComponent(u.pathname).toLowerCase();
  if(/(?:^|\/)(?:sponsored|advertorial|brandstudio|brand-studio|brandvoice|partner-content|paidpost|press-releases?|pressreleases|native-ad|mundo|afrique|hindi|arabic|zhongwen|persian|russian|portuguese|japanese|espanol)(?:\/|$)/.test(path))return false;
  if(/(?:^|\/)(?:cn|jp|es|ar|zh|ru|pt|fr|de|ja)(?:\/|$)/.test(path))return false;
  return path.split('/').filter(Boolean).length>0;
 }catch{return false;}
}
function normalized(s:string){return s.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();}
export function supportedEnglishEditorial(source:{url:string;snippet:string;articleReview?:z.infer<typeof articleReviewSchema>}):boolean{
 const r=source.articleReview;
 if(!approvedNewsUrl(source.url)||!r||r.language!=='en'||!['reporting','analysis'].includes(r.editorialType))return false;
 // Require an attributable excerpt from the retrieved source text, not an English translation or the model's reaction.
 if(!normalized(source.snippet).includes(normalized(r.excerpt)))return false;
 const words=r.excerpt.toLowerCase().match(/[a-z]+/g)??[];
 const english=words.filter(w=>/^(the|a|an|and|or|for|to|of|in|on|with|that|is|are|was|were|has|have|its|from|by|as|at|it|this|their|will|said|but|be)$/.test(w));
 return words.length>=8&&english.length>=2;
}
