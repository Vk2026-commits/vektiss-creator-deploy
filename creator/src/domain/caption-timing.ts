/** Hold the last spoken word through brief gaps; clear on an actual pause. */
export function captionWordAt(words:readonly {start:number;end:number}[],time:number):number{
 let low=0,high=words.length-1,at=-1;
 while(low<=high){const mid=(low+high)>>1;if(words[mid].start<=time){at=mid;low=mid+1;}else high=mid-1;}
 return at>=0&&time<words[at].end+.35?at:-1;
}
