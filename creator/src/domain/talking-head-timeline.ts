/** Source word anchors survive cuts, pairing and reordering. No provider URLs or code. */
export type TimedWord = {text:string;start:number;end:number};
export type TalkingSource = {id:string;duration:number;words:TimedWord[]};
export type SpeechClip = {id:string;sourceId:string;firstWord:number;lastWord:number};
export type TimelineClip = SpeechClip & {sourceStart:number;sourceEnd:number;start:number;end:number};
export type WordAnchor = {clipId:string;word:number};
export type GraphicEntry = {
 id:string;label:string;introduced:WordAnchor;verdict:WordAnchor;
 placement:string;qualifier?:string;
};
export type TalkingTimeline = {clips:TimelineClip[];duration:number;words:(TimedWord & {clipId:string;sourceWord:number})[]};

/** Default timeline retains the entire recording, including initial/final silence. */
export function buildTalkingTimeline(sources:TalkingSource[],requested?:SpeechClip[]):TalkingTimeline {
 const byId=new Map(sources.map(s=>[s.id,s]));
 if(byId.size!==sources.length||!sources.length)throw Error('TALKING_SOURCE_ID');
 for(const s of sources){
  if(!Number.isFinite(s.duration)||s.duration<=0||!s.words.length)throw Error('TALKING_SOURCE');
  s.words.forEach((w,i)=>{if(!w.text.trim()||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<=w.start||w.end>s.duration||(i>0&&w.start<s.words[i-1].end))throw Error('TALKING_WORD_TIMING');});
 }
 const selection=requested??sources.map(s=>({id:s.id,sourceId:s.id,firstWord:0,lastWord:s.words.length-1}));
 if(!selection.length||new Set(selection.map(c=>c.id)).size!==selection.length)throw Error('TALKING_CLIP_ID');
 let cursor=0;
 const words:TalkingTimeline['words']=[];
 const clips=selection.map(c=>{
  const s=byId.get(c.sourceId);
  if(!s||!Number.isInteger(c.firstWord)||!Number.isInteger(c.lastWord)||c.firstWord<0||c.lastWord<c.firstWord||c.lastWord>=s.words.length)throw Error('TALKING_CLIP_RANGE');
  // Midpoints preserve a small speech margin without including neighboring words.
  const sourceStart=c.firstWord===0?0:Math.max(s.words[c.firstWord].start-.08,(s.words[c.firstWord-1].end+s.words[c.firstWord].start)/2);
  const sourceEnd=c.lastWord===s.words.length-1?s.duration:Math.min(s.words[c.lastWord].end+.08,(s.words[c.lastWord].end+s.words[c.lastWord+1].start)/2);
  const start=cursor,end=start+sourceEnd-sourceStart;
  for(let i=c.firstWord;i<=c.lastWord;i++)words.push({...s.words[i],start:start+s.words[i].start-sourceStart,end:start+s.words[i].end-sourceStart,clipId:c.id,sourceWord:i});
  cursor=end;return {...c,sourceStart,sourceEnd,start,end};
 });
 return {clips,words,duration:cursor};
}
export function anchorTime(timeline:TalkingTimeline,anchor:WordAnchor):number {
 const word=timeline.words.find(w=>w.clipId===anchor.clipId&&w.sourceWord===anchor.word);
 if(!word)throw Error('TALKING_ANCHOR_REMOVED');
 return word.start;
}
/** Stable accumulated graphics; pagination changes sections rather than shrinking labels. */
export function graphicState(timeline:TalkingTimeline,entries:GraphicEntry[],time:number,pageSize=4){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>8)throw Error('TALKING_PAGE_SIZE');
 if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('TALKING_ENTRY_ID');
 const resolved=entries.map(e=>{
  const introducedAt=anchorTime(timeline,e.introduced),placedAt=anchorTime(timeline,e.verdict);
  if(placedAt<introducedAt||!e.label.trim()||!e.placement.trim())throw Error('TALKING_VERDICT');
  return {...e,introducedAt,placedAt};
 }).sort((a,b)=>a.placedAt-b.placedAt);
 const placed=resolved.filter(e=>e.placedAt<=time);
 const page=Math.max(0,Math.ceil(placed.length/pageSize)-1);
 return {page,pageCount:Math.max(1,Math.ceil(resolved.length/pageSize)),placed:placed.slice(page*pageSize,(page+1)*pageSize),pending:resolved.filter(e=>e.introducedAt<=time&&e.placedAt>time)};
}
