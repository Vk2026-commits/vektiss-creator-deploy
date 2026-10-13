// Keep complete sentences: never cut the last word to meet a preview limit.
export function closingPreview(script:{hook:string;body:string;cta:string}){
 const ending=(script.cta.trim()||script.body.trim()).match(/[^.!?]+[.!?]+[”"']*|[^.!?]+$/g)?.map(s=>s.trim()).filter(Boolean)??[];
 const last=ending.at(-1)??'';
 if(last.length>1200)return '';
 const hook=script.hook.trim().match(/^[\s\S]*?[.!?](?:\s|$)/)?.[0].trim()??script.hook.trim();
 return hook&&hook!==last&&hook.length+last.length+2<=1200?`${hook}\n\n${last}`:last;
}
