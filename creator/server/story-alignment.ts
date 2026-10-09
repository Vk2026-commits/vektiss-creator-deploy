import {z} from 'zod';
import {type ScreenshotStory,normalizeStorySpeech} from '../src/domain/screenshot-story';

export const STORY_COMPOSITION_VERSION=1;
export const timedWordsSchema=z.array(z.object({word:z.string(),start:z.number().finite().nonnegative(),end:z.number().finite().nonnegative()})).min(1).max(10000);
export type TimedWord=z.infer<typeof timedWordsSchema>[number];
const tokens=(text:string)=>normalizeStorySpeech(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
const uncertain=()=>Error('Could not confidently match screenshots to the narration. Retry timing; your completed avatar is saved and no new paid render is needed.');

/** Monotonic word alignment, never equal-duration timing. Reject weak boundaries. */
export function alignStory(story:ScreenshotStory,words:TimedWord[],duration:number){
 timedWordsSchema.parse(words);
 if(!Number.isFinite(duration)||duration<=0||duration>1200||!story.sections.length)throw uncertain();
 if(words.some((word,i)=>word.end<word.start||word.end>duration+.25||(i>0&&word.start<words[i-1].start)))throw uncertain();
 const expected=story.sections.flatMap(s=>tokens(s.text));
 const heard=words.flatMap(w=>tokens(w.word).map(token=>({token,start:w.start,end:w.end})));
 if(!expected.length||expected.length>4000||heard.length>5000)throw uncertain();
 // LCS tolerates punctuation and occasional recognition errors while retaining order.
 const rows=Array.from({length:expected.length+1},()=>new Uint16Array(heard.length+1));
 for(let i=expected.length-1;i>=0;i--)for(let j=heard.length-1;j>=0;j--)rows[i][j]=expected[i]===heard[j].token?1+rows[i+1][j+1]:Math.max(rows[i+1][j],rows[i][j+1]);
 const mapped=new Map<number,number>();let i=0,j=0;
 while(i<expected.length&&j<heard.length){if(expected[i]===heard[j].token){mapped.set(i,j);i++;j++;}else if(rows[i+1][j]>=rows[i][j+1])i++;else j++;}
 if(mapped.size/expected.length<.9||mapped.size/heard.length<.85)throw uncertain();
 let offset=0;
 const starts=story.sections.map((section,index)=>{
  const sectionWords=tokens(section.text),start=offset;offset+=sectionWords.length;
  if(!sectionWords.length)throw uncertain();
  const matched=sectionWords.filter((_,k)=>mapped.has(start+k)).length;
  if(matched/sectionWords.length<.85)throw uncertain();
  if(index===0)return 0;
  // Require the first three words of each new image's narration as a consecutive anchor.
  const anchor=Math.min(3,sectionWords.length),at=mapped.get(start);
  if(at===undefined||Array.from({length:anchor},(_,k)=>mapped.get(start+k)!==at+k).some(Boolean))throw uncertain();
  return heard[at].start;
 });
 if(starts.some((start,index)=>index>0&&start<=starts[index-1]))throw uncertain();
 return story.sections.map((section,index)=>({image_id:section.image_id,start:starts[index],end:starts[index+1]??duration}));
}
