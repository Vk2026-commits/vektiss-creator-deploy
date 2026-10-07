export function filterResearchSource<T extends {eq:Function;or:Function}>(query:T, mode:'all'|'videos'|'articles'):T {
  const field='source_snapshot->0->>sourceType';
  if(mode==='articles')return query.eq(field,'article');
  if(mode==='videos')return query.or(`${field}.neq.article,${field}.is.null`);
  return query;
}
