/** Commas separate alternative search phrases; spaces within a phrase stay together. */
export function searchKeywords(value:string):string[]{
 const seen=new Set<string>();
 return value.split(/[,\n]+/).map(term=>term.trim()).filter(term=>{const key=term.toLowerCase();if(!term||seen.has(key))return false;seen.add(key);return true;});
}
