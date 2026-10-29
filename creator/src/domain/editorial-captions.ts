import type {EditSource} from './edit-templates';
/** Stable phrase boundaries: pauses and punctuation win over arbitrary four-word pages. */
export function editorialCaptions(words:EditSource['words']){
 const phrases:{start:number;end:number;text:string}[]=[];let start=0;
 for(let i=0;i<words.length;i++){
  const next=words[i+1],text=words.slice(start,i+1).map(w=>w.text).join(' ');
  if(!next||/[.!?,;:]$/.test(words[i].text)||next.start-words[i].end>.3||i-start>=5||text.length+(next?.text.length??0)>34){
   phrases.push({start:words[start].start,end:next?Math.min(next.start,words[i].end+.25):words[i].end+.25,text});start=i+1;
  }
 }
 return phrases;
}
