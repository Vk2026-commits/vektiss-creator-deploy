/** Approved portrait composition. No planner-provided coordinates may move these regions. */
export const popoutLayout={
 width:1080,height:1920,
 graphics:{top:0,height:850},
 title:{left:80,top:110,width:920,height:240},
 artwork:{left:60,top:360,width:960,height:480},
 captions:{left:65,top:890,width:950,height:145},
 presenter:{left:140,top:800,width:800,height:1422.22},
} as const;
/** Half-open intervals prevent a finished video from jumping back to its first scene. */
export function popoutBeatIndex(beats:{start:number;end:number}[],time:number){
 const active=beats.findIndex(b=>time>=b.start&&time<b.end);
 if(active>=0)return active;
 return time>=beats.at(-1)!.end?beats.length-1:0;
}
