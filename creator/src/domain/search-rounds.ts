import type {ProviderResearchCandidate,ResearchSource} from './research.ts';

export function needsFilteredRefill(input:{pilot:boolean;filtered:boolean;sourceMode:string;accepted:number;requested:number;round:number;reviewLimited:boolean}) {
 return !input.pilot && input.filtered && input.sourceMode==='videos' && input.accepted<input.requested && input.round<3 && !input.reviewLimited;
}

// Each provider response numbers sources independently. Preserve links when
// merging a web-search round with previously screened native candidates.
export function mergeSearchRound(
 previous:{sources:ResearchSource[];candidates:ProviderResearchCandidate[]},
 next:{sources:ResearchSource[];candidates:ProviderResearchCandidate[]},
){
 const offset=Math.max(0,...previous.sources.map(source=>source.providerSourceId));
 return {
  sources:[...previous.sources,...next.sources.map(source=>({...source,providerSourceId:source.providerSourceId+offset}))],
  candidates:[...previous.candidates,...next.candidates.map(candidate=>({...candidate,sourceIds:candidate.sourceIds.map(id=>id+offset)}))],
 };
}
export function directVideoUrl(value:string):boolean{
 try{
  const u=new URL(value),host=u.hostname.replace(/^www\./,'');
  return (host==='instagram.com'&&/^\/(?:reel|reels|p)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))
   || ((host==='youtube.com'||host==='m.youtube.com')&&(/^\/shorts\/[A-Za-z0-9_-]{11}\/?$/.test(u.pathname)||u.pathname==='/watch'&&!!u.searchParams.get('v')))
   || (host==='youtu.be'&&/^\/[A-Za-z0-9_-]{11}$/.test(u.pathname))
   || (host==='tiktok.com'&&/^\/@[^/]+\/video\/\d+/.test(u.pathname));
 }catch{return false;}
}
