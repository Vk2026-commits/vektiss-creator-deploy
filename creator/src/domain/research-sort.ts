export type ResearchSort = 'recommended'|'match'|'newest'|'oldest'|'discovered'|'views'|'engagement'|'outlier';
export const researchSortLabels:Record<ResearchSort,string>={recommended:'Performance + audience fit',views:'Most views',engagement:'Highest engagement',outlier:'Largest creator outlier',match:'Best match',newest:'Newest published',oldest:'Oldest published',discovered:'Recently discovered'};
export function orderResearch(query:any,sort:ResearchSort){
 if(['views','engagement','outlier'].includes(sort))query=query.order(sort==='outlier'?'source_snapshot->0->engagement->baseline->ratio':sort==='views'?'source_snapshot->0->engagement->views':'source_snapshot->0->engagement->rate',{ascending:false,nullsFirst:false});
 if(sort==='recommended')query=query.order('rank_score',{ascending:false,nullsFirst:false});
 if(sort==='match')query=query.order('relevance_score',{ascending:false,nullsFirst:false});
 if(sort==='newest'||sort==='oldest')query=query.order('published_at',{ascending:sort==='oldest',nullsFirst:false});
 return query.order('created_at',{ascending:false}).order('id',{ascending:false});
}
