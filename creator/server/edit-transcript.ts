import {z} from 'zod';

const transcriptSchema=z.object({words:z.array(z.object({word:z.string().trim().min(1).max(120),start:z.number().finite().nonnegative(),end:z.number().finite().nonnegative()})).min(1).max(12000)});

// Speech services can return touching, overlapping, or zero-duration words.
// Repair only small timing artifacts; retain every word and its original order.
export function editTranscriptWords(raw:unknown,duration:number){
 const {words}=transcriptSchema.parse(raw);
 let previous=0;
 return words.map(w=>{
  const start=Math.max(previous,Math.min(w.start,duration-.01));
  const end=Math.min(duration,Math.max(w.end,start+.01));
  if(end<=start||Math.abs(start-w.start)>.15||Math.abs(end-w.end)>.15)throw Error('EDIT_TRANSCRIPT_TIMING');
  previous=end;
  return {start,end,text:w.word};
 });
}
