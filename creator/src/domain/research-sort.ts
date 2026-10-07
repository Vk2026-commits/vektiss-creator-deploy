export type ResearchSort = 'match'|'newest'|'oldest'|'discovered';
export const researchSortLabels:Record<ResearchSort,string>={match:'Best match',newest:'Newest published',oldest:'Oldest published',discovered:'Recently discovered'};
export function orderResearch(query:any,sort:ResearchSort){
 if(sort==='match')query=query.order('relevance_score',{ascending:false,nullsFirst:false});
 if(sort==='newest'||sort==='oldest')query=query.order('published_at',{ascending:sort==='oldest',nullsFirst:false});
 return query.order('created_at',{ascending:false}).order('id',{ascending:false});
}
