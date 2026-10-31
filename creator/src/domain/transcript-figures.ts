import type {EditSource} from './edit-templates.ts';
export const figurePattern=()=>/\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
export const numberValue=(s:string)=>Number(s.replace(/[,\s]/g,''));
const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
// Use punctuation from the full transcript only when its entire lexical sequence
// matches the timed words. This recovers decimals without guessing from adjacent digits.
export function transcriptFigures(source:EditSource){
 const joined=source.words.map(w=>w.text).join(' ');
 const text=source.transcriptText&&compact(source.transcriptText)===compact(joined)?source.transcriptText:joined;
 let end=0;const ends=source.words.map((w,word)=>({word,end:end+=compact(w.text).length}));
 return [...text.matchAll(figurePattern())].map(m=>{
  const start=compact(text.slice(0,m.index)).length,finish=start+compact(m[0]).length;
  return {value:numberValue(m[0]),firstWord:ends.find(w=>w.end>start)!.word,lastWord:ends.find(w=>w.end>=finish)!.word,qualifier:text.slice(0,m.index).match(/(up to|at least|more than|less than|over|about|approximately|estimated)\s*[$£€]?\s*$/i)?.[1]};
 }).filter(f=>f.value>=10);
}
