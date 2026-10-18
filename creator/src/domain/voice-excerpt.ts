// Keep complete sentences: never cut the last word to meet a preview limit.
export function closingPreview(script:{hook:string;body:string;cta:string}){
 const sentences=(text:string)=>text.match(/[^.!?]+[.!?]+[”"']*|[^.!?]+$/g)?.map(s=>s.trim()).filter(Boolean)??[];
 const cta=script.cta.trim();
 const lead=sentences(script.body.trim()).at(-1)??'';
 const ending=cta||lead;
 const contextual=lead&&cta?`${lead}\n\n${cta}`:ending;
 if(contextual.length<=1200)return contextual;
 if(ending.length<=1200)return ending;
 const last=sentences(ending).at(-1)??'';
 return last.length<=1200?last:'';
}
