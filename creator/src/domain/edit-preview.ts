import type {EditSource,EditProposal} from './edit-templates';
export type PreviewCut={sourceStart:number;sourceEnd:number;outputStart:number;speed:1};
/** Short samples retain original word times; only the playback clock is mapped. */
export function rankingPreviewCuts(source:EditSource,plan:EditProposal):PreviewCut[]{
 const end=Math.floor(source.duration*30)/30;
 const reveals=plan.beats.flatMap(b=>(b.graphics?.nodes??[]).flatMap(n=>n.revealWord===undefined?[]:[source.words[n.revealWord]?.start])).filter((t):t is number=>Number.isFinite(t)).sort((a,b)=>a-b);
 const starts=[0,...(reveals.length?[Math.max(0,reveals[0]-1),Math.max(0,reveals.at(-1)!+.5)]:[])];
 const ranges=starts.map(t=>{const start=Math.floor(Math.min(t,Math.max(0,end-3))*30)/30;return {start,end:Math.min(end,start+3)};}).sort((a,b)=>a.start-b.start);
 const merged:{start:number;end:number}[]=[];
 for(const r of ranges){const last=merged.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else merged.push(r);}
 let outputStart=0;return merged.map(r=>{const cut:PreviewCut={sourceStart:r.start,sourceEnd:r.end,outputStart,speed:1};outputStart+=r.end-r.start;return cut;});
}
export function previewDuration(cuts:PreviewCut[]){return cuts.reduce((sum,c)=>sum+c.sourceEnd-c.sourceStart,0);}
/** Preserve the full-size layout but capture a half-size viewport, not a full-size MP4. */
export function previewHtml(html:string,width:number,height:number,cuts?:PreviewCut[]){
 let result=html.replace(/data-width="\d+"/,`data-width="${width/2}"`).replace(/data-height="\d+"/,`data-height="${height/2}"`);
 result=result.replace('</head>',`<style>html,body{width:${width/2}px!important;height:${height/2}px!important}#stage{width:${width}px!important;height:${height}px!important;transform:scale(.5);transform-origin:top left}</style></head>`);
 if(cuts){
  const duration=previewDuration(cuts);
  result=result.replace(/data-duration="[\d.]+"/g,`data-duration="${duration}"`);
  result=result.replace('</body>',`<script>{const cuts=${JSON.stringify(cuts)},timeline=window.__timelines.vektiss,originalSeek=timeline.seek.bind(timeline);timeline.duration=()=>${duration};timeline.seek=t=>{const cut=cuts.find(c=>t<c.outputStart+c.sourceEnd-c.sourceStart)||cuts[cuts.length-1];return originalSeek(Math.min(cut.sourceEnd-1/30,cut.sourceStart+Math.max(0,t-cut.outputStart)));};timeline.seek(0);}</script></body>`);
 }
 return result;
}
