import {rankingFlight} from './ranking-flight.ts';
import {rankingDefault} from './ranking-default.ts';
import {validateEditProposal,editStoryboard,type EditSource,type EditProposal} from './edit-templates.ts';
import {editBrandSchema,type EditBrand} from './edit-brand.ts';
import {editDimensions} from './edit-format.ts';
import {buildTalkingTimeline,anchorTime} from './talking-head-timeline.ts';
import {captionWordAt} from './caption-timing.ts';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const ranks=['S','A','B','C','D','E','F'];
const colors=['#FF7C82','#FFB875','#FFE175','#A8E783','#80D8E8','#AAA1ED','#E5A0DE'];
export function rankingProject(source:EditSource,raw:EditProposal,rawBrand:EditBrand,sample=false){
 const plan=validateEditProposal(raw,source,raw.templateId),brand=editBrandSchema.parse(rawBrand),{width,height}=editDimensions(plan.aspectRatio),wide=width>height;
 const timeline=buildTalkingTimeline([{id:source.assetId,duration:source.duration,words:source.words}]);
 const items: {label:string;tier:string;time:number;introduced:number}[]=[];
 for(const beat of editStoryboard(plan,source))for(const [i,n] of (beat.graphics?.nodes??[]).entries()){
  if(!n.tier||items.some(x=>x.label.toLowerCase()===n.label.toLowerCase()))continue;
  items.push({label:n.label,tier:n.tier,introduced:n.introducedWord===undefined?-1:anchorTime(timeline,{clipId:source.assetId,word:n.introducedWord}),time:n.revealWord===undefined?Math.min(beat.end-.01,beat.start+i*.5):source.words[n.revealWord].start});
 }
 const rows=ranks.map((rank,i)=>`<div class="row"><b style="background:${colors[i]}">${rank}</b><div class="slots" style="grid-template-columns:repeat(${Math.max(3,items.filter(n=>n.tier===rank).length)},minmax(0,1fr))">${items.filter(n=>n.tier===rank).map(n=>`<div class="item" data-slot="${items.indexOf(n)}" data-reveal="${n.time}"><span>${esc(n.label)}</span></div>`).join('')}</div></div>`).join('');
 const flying=items.map((n,i)=>`<div class="rank-flight" data-flight="${i}"><span>${esc(n.label)}</span></div>`).join('');
 const itemData=JSON.stringify(items).replaceAll('<','\\u003c');
 const words=JSON.stringify(timeline.words).replaceAll('<','\\u003c');
 return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'self' 'unsafe-inline';style-src 'unsafe-inline';media-src 'self' blob:;img-src 'self' data: blob:"><style>
 *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:${brand.fontFamily??'Arial'},sans-serif;background:#10151d}#stage{position:relative;width:100%;height:100%;overflow:hidden}video{position:absolute;inset:0;width:100%;height:100%;object-fit:${wide?'contain':'cover'};object-position:${wide?'25% 50%':'50% 30%'};z-index:1}.shade{position:absolute;inset:0;background:linear-gradient(#0005,transparent 28%,transparent 45%,#0004);z-index:2}h1{position:absolute;z-index:3;top:5%;left:7%;width:86%;margin:0;text-align:center;font-size:${wide?58:64}px;line-height:1.05;letter-spacing:-2px;color:white;text-shadow:0 3px 12px #0009}#board{position:absolute;z-index:3;left:${wide?54:10}%;width:${wide?40:80}%;top:${wide?48:rankingDefault.boardTop}%;height:${wide?44:rankingDefault.boardHeight}%;background:#181b20;border:3px solid #06080c;border-radius:8px;overflow:hidden;box-shadow:0 16px 36px #0006;display:grid;grid-template-rows:repeat(7,minmax(0,1fr))}.row{display:flex;min-height:0;border-bottom:2px solid #07090d}.row:last-child{border:0}.row>b{width:8%;display:flex;align-items:center;justify-content:center;font-size:${wide?26:30}px;color:#10151d}.slots{display:grid;gap:8px;flex:1;min-width:0;padding:5px 8px}.item,.rank-flight{min-width:0;display:flex;align-items:center;justify-content:center;background:${brand.primary};border:1px solid #ffffff55;border-radius:5px;color:white;font-size:${wide?22:26}px;line-height:1.06;text-align:center;font-weight:800;padding:4px;overflow-wrap:anywhere;transform-origin:center}.item span,.rank-flight span{text-shadow:0 1px 4px #0008}#captions{position:absolute;z-index:4;left:8%;width:84%;top:${wide?37:rankingDefault.captionTop}%;text-align:center;font-size:${wide?48:78}px;font-weight:800;color:white;text-shadow:0 2px 8px black}.item{visibility:hidden}.rank-flight{position:absolute;z-index:5;pointer-events:none;transform-origin:center;box-shadow:0 8px 24px #0005}#captions em{font-style:normal;color:${brand.primary}}
 </style></head><body><div id="stage" data-composition-id="vektiss" data-start="0" data-duration="${source.duration}" data-width="${width}" data-height="${height}">${sample?'<video muted playsinline></video>':`<video id="presenter" class="clip" src="source.mp4" data-start="0" data-duration="${source.duration}" data-track-index="0" data-has-audio="true" playsinline></video>`}<div class="shade"></div>${plan.showRankingTitle===false?'':`<h1>${esc(plan.beats[0].headline)}</h1>`}<div id="board">${rows}</div><div id="captions"></div>${flying}</div><script>
 const items=${itemData},words=${words},wordAt=${captionWordAt.toString()},flight=${rankingFlight.toString()};
 function seek(t){
 const stage=document.querySelector('#stage'),bounds=stage.getBoundingClientRect();
 const sx=${width}/bounds.width,sy=${height}/bounds.height;
 document.querySelectorAll('[data-flight]').forEach(el=>{
  const i=Number(el.dataset.flight),n=items[i],f=flight(t,n.introduced,n.time),slot=document.querySelector('[data-slot="'+i+'"]');
  const target=slot.getBoundingClientRect(),tx=(target.left-bounds.left)*sx,ty=(target.top-bounds.top)*sy,tw=target.width*sx,th=target.height*sy;
  const sw=${wide?580:600},sh=${wide?62:78},x=${wide?1920*.74:1080*.5}-sw/2,y=${wide?1080*.425:1920*.542};
  const p=f.travel,w=sw+(tw-sw)*p,h=sh+(th-sh)*p;
  el.style.opacity=f.visible?'1':'0';el.style.left=(x+(tx-x)*p)+'px';el.style.top=(y+(ty-y)*p)+'px';
  el.style.width=w+'px';el.style.height=h+'px';el.style.fontSize=(${wide?32:38}+(${wide?22:26}-${wide?32:38})*p)+'px';
  el.style.transform='scale('+(f.landed?1:.72+.28*f.pop)+')';el.style.boxShadow=f.landed?'none':'0 8px 24px #0005';
 });
 const caption=document.querySelector('#captions');caption.replaceChildren();const at=wordAt(words,t);if(at>=0&&'${brand.captionStyle}'!=='none'){words.slice(Math.floor(at/3)*3,Math.floor(at/3)*3+3).forEach(w=>{const el=document.createElement(w===words[at]&&'${brand.captionStyle}'==='highlight'?'em':'span');el.textContent=('${brand.captionStyle}'==='bold'?w.text.toUpperCase():w.text)+' ';caption.append(el);});}}
 window.__timelines={vektiss:{duration:()=>${source.duration},seek:t=>{seek(t);return window.__timelines.vektiss},pause:()=>{}}};seek(0);
 ${sample?`window.addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='vektiss-seek'&&Number.isFinite(e.data.time))seek(e.data.time);});`:''}
 </script></body></html>`;
}
