import {editorialAsset} from './editorial-assets';
import type {EditProposal,EditSource} from './edit-templates';

export type EditorialBeat=EditProposal['beats'][number]&{start:number;end:number};
const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Native SVG text survives the export compiler's SVG/HTML namespace serialization.
const label=(text:string,x:number,y:number,w:number,h:number,size=32,extra='')=>{
 const limit=Math.max(6,Math.floor(w/(size*.57))),lines:string[]=[];let line='';
 for(const word of text.split(/\s+/)){if(line&&(line+' '+word).length>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
 if(line)lines.push(line);
 const fitted=Math.min(size,h/Math.max(1,lines.length)/1.18),center=extra.includes('ed-center'),tx=center?x+w/2:x;
 return `<text class="ed-label ${extra}" style="font-size:${fitted}px" text-anchor="${center?'middle':'start'}">${lines.map((v,i)=>`<tspan x="${tx}" y="${y+h/2+(i-(lines.length-1)/2)*fitted*1.15+fitted*.35}">${esc(v)}</tspan>`).join('')}</text>`;
};
const reveal=(at:number,body:string,x=0,y=0)=>`<g data-ed-reveal="${at}" data-ed-x="${x}" data-ed-y="${y}" transform="translate(${x} ${y})">${body}</g>`;
const attention=(at:number,until:number,body:string)=>`<g data-ed-attention="${at}" data-ed-until="${until}">${body}</g>`;
const cursor=(at:number,until:number,x:number,y:number,fromX=x+45,fromY=y+35)=>`<g class="ed-cursor" data-ed-cursor="${at}" data-ed-until="${until}" data-ed-x="${x}" data-ed-y="${y}" data-ed-from-x="${fromX}" data-ed-from-y="${fromY}"><circle class="ed-click-ring" data-ed-click-ring="${at}" r="8"/><g data-ed-press="${at}"><path d="M0 0 0 30 8 22 15 36 23 32 15 18 28 17Z"/></g></g>`;
const focus=(at:number,until:number,x:number,y:number,body:string)=>`<g data-ed-focus="${at}" data-ed-until="${until}" data-ed-x="${x}" data-ed-y="${y}">${body}</g>`;
type Point={x:number;y:number};
// Moving packets follow only plan-approved edges. Their motion illustrates a
// relationship, not a quantity or invented performance measurement.
const connection=(a:Point,c1:Point,c2:Point,b:Point,at:number,end:number)=>{
 const d=`M${a.x} ${a.y}C${c1.x} ${c1.y},${c2.x} ${c2.y},${b.x} ${b.y}`;
 const points=[a.x,a.y,c1.x,c1.y,c2.x,c2.y,b.x,b.y].join(',');
 const duration=Math.min(.72,Math.max(.18,end-at-.06));
 return line(d,at)+`<circle class="ed-signal" r="6" data-ed-flow="${at}" data-ed-duration="${duration}" data-ed-points="${points}"/><circle class="ed-signal-tail" r="3" data-ed-flow="${at+.09}" data-ed-duration="${duration}" data-ed-points="${points}"/>`;
};
const line=(d:string,at:number)=>`<path class="ed-connector" d="${d}" pathLength="1" data-ed-draw="${at}"/>`;

/** Balanced cards and gutter-only routes keep four-item mechanisms readable. */
export function editorialProcessLayout(count:number){
 const cols=count===4?2:Math.min(3,Math.max(1,count)),rows=Math.ceil(count/cols);
 const gap=48,width=(778-gap*(cols-1))/cols,height=rows===1?310:218;
 return Array.from({length:count},(_,i)=>{
  const row=Math.floor(i/cols),rowCount=Math.min(cols,count-row*cols),rowWidth=rowCount*width+(rowCount-1)*gap;
  return {x:(900-rowWidth)/2+(i%cols)*(width+gap),y:rows===1?135:70+row*278,width,height,row};
 });
}
export function editorialProcessRoute(a:ReturnType<typeof editorialProcessLayout>[number],b:ReturnType<typeof editorialProcessLayout>[number]):Point[]{
 if(a.row!==b.row){
  const down=b.row>a.row,start={x:a.x+a.width/2,y:down?a.y+a.height:a.y},end={x:b.x+b.width/2,y:down?b.y:b.y+b.height},mid=(start.y+end.y)/2;
  return [start,{x:start.x,y:mid},{x:end.x,y:mid},end];
 }
 const right=b.x>a.x,gap=Math.abs(b.x-a.x)-a.width;
 if(gap<60){
  const start={x:right?a.x+a.width:a.x,y:a.y+a.height/2},end={x:right?b.x:b.x+b.width,y:b.y+b.height/2},mid=(start.x+end.x)/2;
  return [start,{x:mid,y:start.y},{x:mid,y:end.y},end];
 }
 // Nonadjacent cards connect through the clear gutter below their row.
 const start={x:a.x+a.width/2,y:a.y+a.height},end={x:b.x+b.width/2,y:b.y+b.height};
 return [start,{x:start.x,y:start.y+35},{x:end.x,y:end.y+35},end];
}

/** Trusted vector compositions, not model-generated HTML. All displayed language
 * comes from approved labels. Motion is a function of time, including backwards seeks. */
export function editorialScene(source:EditSource,beat:EditorialBeat):string{
 const nodes=beat.graphics?.nodes??[];
 const kind=beat.scene??(beat.visual==='steps'?'process':beat.visual==='comparison'?'comparison':beat.visual==='typography'?'spotlight':'document');
 const at=(i:number)=>nodes[i]?.revealWord===undefined?Math.min(beat.end-.001,beat.start+.15+i*.45):source.words[nodes[i].revealWord!].start;
 const until=(i:number)=>Math.min(beat.end,...nodes.map((_,j)=>at(j)).filter(t=>t>at(i)));
 const firstContent=nodes.length?Math.min(...nodes.map((_,i)=>at(i))):beat.start;
 const index=(i:number,x:number,y:number)=>`<text class="ed-index" x="${x}" y="${y}">${String(i+1).padStart(2,'0')}</text>`;
 const panel=(x:number,y:number,w:number,h:number)=>`<rect class="ed-panel" x="${x}" y="${y}" width="${w}" height="${h}" rx="24"/>`;
 let body='';
 if(kind==='search'){
  // Query → candidate rows → selected result, as in the directed reference.
  // All query/result language is supplied by the approved edit plan.
  const results=nodes.slice(1),rowH=Math.min(104,340/Math.max(1,results.length));
  body=reveal(firstContent,panel(34,55,832,530)+`<rect class="ed-search-field" x="70" y="91" width="760" height="98" rx="14"/><circle class="ed-accent-stroke" cx="111" cy="135" r="13"/><path class="ed-accent-stroke" d="m121 145 12 12"/>`);
  if(nodes[0])body+=reveal(at(0),`${attention(at(0)-.4,results.length?at(1):beat.end,'<rect class="ed-selection" x="70" y="91" width="760" height="98" rx="14"/>')}<text x="155" y="150" class="ed-label ed-query"><tspan data-ed-type="${at(0)}" data-ed-text="${esc(nodes[0].label)}">${esc(nodes[0].label)}</tspan><tspan class="ed-caret" data-ed-caret="${at(0)}">|</tspan></text>`);
  body+=results.map((n,i)=>{
   const idx=i+1,y=216+i*rowH,icon=editorialAsset(n.label,18,18,44,n.asset),height=rowH-18;
   const expand=i===results.length-1?` data-ed-expand="${at(idx)+.1}" data-ed-height="${height}" data-ed-growth="${Math.min(48,578-y-height)}"`:"";
   const content=`<rect class="ed-row" width="760" height="${height}" rx="12"${expand}/>${attention(at(idx),until(idx),`<rect class="ed-selection" width="760" height="${height}" rx="12"${expand}/>`)}${icon||`<circle class="ed-dot" cx="39" cy="${height/2}" r="5"/>`}${label(n.label,82,9,592,height-18,results.length>3?27:34)}<g data-ed-result="${at(idx)}" data-ed-until="${until(idx)}"><path class="ed-accent-stroke" d="M705 ${height/2}h22m-9 -9 9 9-9 9"/><path class="ed-result-rule" d="M82 ${height-8}H665" pathLength="1" data-ed-draw="${at(idx)+.18}"/>${i===results.length-1?`<g data-ed-reveal="${at(idx)+.3}" data-ed-y="${height+14}" data-ed-x="82"><path class="ed-muted-line" d="M0 0H490"/><path class="ed-accent-stroke" d="M0 0H490" pathLength="1" data-ed-draw="${at(idx)+.45}"/><circle class="ed-dot" cx="490" cy="0" r="4"/></g>`:""}</g>`;
   return reveal(at(idx),focus(at(idx),until(idx),380,height/2,content),70,y)+cursor(at(idx),until(idx),775,y+height/2,775,i?216+(i-1)*rowH+height/2:140);
  }).join('');
 }else if(kind==='document'&&nodes.length>0&&nodes.length<=3&&nodes.every(n=>n.asset)){
  // Independent examples accumulate as large objects, with no invented connections.
  const width=780/nodes.length;
  body=reveal(firstContent,panel(24,60,852,320));
  body+=nodes.map((n,i)=>{
   const x=60+i*width,size=Math.min(150,width-40),center=width/2;
   return reveal(at(i),`<g data-ed-object="${at(i)}" data-ed-x="${center}" data-ed-y="165">${editorialAsset(n.label,center-size/2,165-size/2,size,n.asset)}</g>${label(n.label,12,260,width-24,90,34,'ed-center')}`,x,0);
  }).join('');
 }else if(kind==='document'){
  // A single coherent document, with one ruled row per spoken item. The
  // check stroke draws after the row lands instead of popping a static icon.
  const h=Math.min(104,448/Math.max(1,nodes.length)),panelHeight=80+nodes.length*h,panelY=(640-panelHeight)/2,top=panelY+60;
  body=reveal(firstContent,panel(34,panelY,832,panelHeight)+`<path class="ed-muted-line" d="M66 ${panelY+47}H834"/><circle class="ed-accent-stroke" cx="79" cy="${panelY+24}" r="8"/><path class="ed-accent-stroke" d="m85 ${panelY+30} 8 8"/><path class="ed-muted-line" d="M117 ${panelY+24}H335"/>`);
  body+=nodes.map((n,i)=>reveal(at(i),`<rect class="ed-row" x="0" y="0" width="764" height="${h-12}" rx="10"/>${attention(at(i),until(i),`<rect class="ed-selection" width="764" height="${h-12}" rx="10"/>`)}${editorialAsset(n.label,17,h/2-24,40,n.asset)||`<rect class="ed-check-box" x="18" y="${h/2-20}" width="30" height="30" rx="6"/><path class="ed-check" d="M24 ${h/2-5}l7 7 14 -17" pathLength="1" data-ed-draw="${at(i)}"/>`}${label(n.label,72,5,650,h-20,nodes.length>4?24:34)}`,68,top+i*h)+cursor(at(i),until(i),785,top+i*h+h/2)).join('');
 }else if(kind==='timeline'){
  const cols=Math.min(3,Math.max(1,nodes.length)),rows=Math.ceil(nodes.length/cols),w=770/cols;
  body=reveal(firstContent,panel(34,65,832,510));
  body+=nodes.map((n,i)=>{
   const x=65+(i%cols)*w,y=rows===1?215:155+Math.floor(i/cols)*210;
   const segment=i%cols<cols-1&&i<nodes.length-1?line(`M${x+w/2} ${y}H${x+w*1.5}`,at(i+1)):'';
   return segment+reveal(at(i),`<circle class="ed-step-ring" cx="${w/2}" cy="0" r="28"/>${editorialAsset(n.label,w/2-18,-18,36,n.asset)||index(i,w/2-13,7)}${label(n.label,10,47,w-20,104,Math.min(n.label.length>24?26:34,w/7),'ed-center')}`,x,y);
  }).join('');
 }else if(kind==='process'){
  // Spacious storyboard frames expose the source's distinct objects, then join
  // only relationships that the approved plan actually supplied.
  const rows=nodes.length>3?2:1,positions=editorialProcessLayout(nodes.length).map(p=>rows===1?{...p,y:105,height:300}:p);
  body=reveal(firstContent,panel(24,34,852,rows===1?452:572)+Array.from({length:34},(_,i)=>`<rect class="ed-perforation" x="${61+i*23}" y="${rows===1?448:568}" width="15" height="12" rx="2"/>`).join(''));
  body+=(beat.graphics?.links??[]).filter(l=>l.from!==l.to&&positions[l.from]&&positions[l.to]).map(l=>{
   const [a,c1,c2,b]=editorialProcessRoute(positions[l.from],positions[l.to]),time=Math.max(at(l.from),at(l.to));
   return connection(a,c1,c2,b,time,beat.end);
  }).join('');
  body+=nodes.map((n,i)=>{
   const {x,y,width:w,height:h}=positions[i],iconSize=rows===1?130:62,iconY=rows===1?53:51;
   const icon=editorialAsset(n.label,(w-iconSize)/2,iconY,iconSize,n.asset),labelHeight=icon?(rows===1?108:84):h-70;
   let font=36;while(font>22&&Math.ceil(n.label.length/Math.max(1,Math.floor((w-32)/(font*.58))))*font*1.13>labelHeight)font--;
   return reveal(at(i),focus(at(i),until(i),w/2,h/2,`${rows===1?'':`<rect class="ed-frame" width="${w}" height="${h}" rx="16"/>`}${attention(at(i),until(i),`<rect class="ed-selection" width="${w}" height="${h}" rx="16"/>`)}${rows===1?'':`<path class="ed-frame-rule" d="M18 44H${w-18}"/>`}${rows===1?'':index(i,20,30)}<g data-ed-object="${at(i)}" data-ed-x="${w/2}" data-ed-y="${iconY+iconSize/2}">${icon}</g>${label(n.label,16,icon?(rows===1?180:122):57,w-32,icon?(rows===1?108:84):h-70,font,'ed-center')}`),x,y);
  }).join('');
 }else if(kind==='network'){
  // A hub and independently labelled satellites, not a misleading quantitative
  // chart. Explicit links are respected; no arbitrary pulse implies causation.
  const hub={x:230,y:320},others=nodes.slice(1),gap=460/Math.max(1,others.length),pos=[hub,...others.map((_,i)=>({x:628,y:90+gap*(i+.5)}))];
  body+=(beat.graphics?.links??[]).filter(l=>l.from!==l.to&&pos[l.from]&&pos[l.to]).map(l=>{const a=pos[l.from],b=pos[l.to];return connection(a,{x:(a.x+b.x)/2,y:a.y},{x:(a.x+b.x)/2,y:b.y},b,Math.max(at(l.from),at(l.to)),beat.end);}).join('');
  if(nodes[0])body+=reveal(at(0),focus(at(0),until(0),0,0,`<circle class="ed-orbit" r="170"/>${attention(at(0),until(0),'<circle class="ed-focus-ring" r="151"/>')}<circle class="ed-hub" r="145"/><circle class="ed-orbit-inner" r="126"/>${editorialAsset(nodes[0].label,-25,-100,50,nodes[0].asset)}${label(nodes[0].label,-112,-45,224,110,nodes[0].label.length>24?28:35,'ed-center')}`),hub.x,hub.y);
  body+=others.map((n,i)=>reveal(at(i+1),focus(at(i+1),until(i+1),0,0,`<rect class="ed-satellite" x="-160" y="-${Math.min(48,gap/2-7)}" width="320" height="${Math.min(96,gap-14)}" rx="14"/>${attention(at(i+1),until(i+1),`<rect class="ed-selection" x="-160" y="-${Math.min(48,gap/2-7)}" width="320" height="${Math.min(96,gap-14)}" rx="14"/>`)}${editorialAsset(n.label,-140,-16,32,n.asset)}${label(n.label,editorialAsset(n.label,0,0,1,n.asset)?-95:-140,-Math.min(40,gap/2-12),editorialAsset(n.label,0,0,1,n.asset)?235:280,Math.min(80,gap-24),n.label.length>30?22:others.length>3?26:32)}`),pos[i+1].x,pos[i+1].y)).join('');
 }else if(kind==='statistic'){
  // A source-labelled hero figure; never derive bar lengths or percentages from
  // text. This also supports non-numeric source takeaways without coercion.
  body=reveal(firstContent,panel(44,60,812,520)+`<path class="ed-muted-line" d="M84 125H816"/><circle class="ed-dot" cx="88" cy="98" r="5"/>`);
  if(nodes[0])body+=reveal(at(0),label(nodes[0].label,84,148,732,205,nodes[0].label.length>24?58:82,'ed-stat'));
  body+=nodes.slice(1).map((n,i)=>reveal(at(i+1),`<path class="ed-muted-line" d="M84 ${385+i*80}H816"/>${label(n.label,84,393+i*80,732,66,30,'ed-context')}`)).join('');
 }else if(kind==='comparison'){
  const cols=nodes.length===1?1:2,rows=Math.ceil(nodes.length/cols),w=790/cols,h=Math.min(238,490/Math.max(1,rows));
  body=nodes.map((n,i)=>reveal(at(i),panel(0,0,w-20,h-20)+`${index(i,26,44)}${editorialAsset(n.label,w-84,20,36,n.asset)}<path class="ed-accent-stroke" d="M26 65H${w-46}"/>${label(n.label,26,82,w-72,h-120,rows>2?24:n.label.length>30?30:36)}`,55+(i%cols)*w,70+Math.floor(i/cols)*h)).join('');
 }else{
  // Editorial statement on open paper; no card chrome. A short secondary phrase
  // gets the serif treatment from the reference, preserving the actual words.
  const statements=nodes.length?nodes.map(n=>n.label):[beat.headline];
  const gap=480/statements.length;
  body=statements.map((text,i)=>reveal(nodes.length?at(i):beat.start,`${i===0?'<path class="ed-accent-stroke" d="M60 25H150"/>':''}${label(text,60,45,780,gap-35,statements.length>3?(text.length>30?26:36):text.length>28?56:74,i%2?'ed-serif ed-ink':'ed-ink')}`,0,45+i*gap)).join('');
 }
 return `<svg class="diagram editorial-scene" data-editorial-kind="${kind}" viewBox="0 0 900 ${kind==='process'&&nodes.length<=3?520:640}" role="img" aria-label="${esc(beat.headline)}">${body}</svg>`;
}

export const editorialSceneStyles=`
.editorial-scene{overflow:visible;--ed-accent:var(--editorial-accent,#1688ff);--ed-ink:var(--editorial-ink,#10263d)}
.editorial-scene .ed-panel{fill:#142333;stroke:#ffffff24;stroke-width:1;filter:drop-shadow(0 16px 15px #10263d20)}
.editorial-scene .ed-signal{fill:#f7fbff;filter:drop-shadow(0 0 5px var(--ed-accent))}.editorial-scene .ed-signal-tail{fill:var(--ed-accent)}
.editorial-scene .ed-click-ring{fill:none;stroke:var(--ed-accent);stroke-width:2}.editorial-scene .ed-result-rule{fill:none;stroke:var(--ed-accent);stroke-width:2;stroke-linecap:round}
.editorial-scene .ed-label{fill:#f6f8fc;color:#f6f8fc;font-family:Arial,sans-serif;font-weight:650;line-height:1.13;letter-spacing:-.7px;overflow-wrap:anywhere;box-sizing:border-box}
.editorial-scene .ed-selection{fill:var(--ed-accent);fill-opacity:.13;stroke:var(--ed-accent);stroke-width:2}
.editorial-scene .ed-search-field{fill:#091725;stroke:#ffffff25;stroke-width:1.5}.editorial-scene .ed-query{font-size:35px;font-weight:650;white-space:nowrap;overflow:hidden}.editorial-scene .ed-caret{color:var(--ed-accent);font-weight:400;margin-left:3px}
.editorial-scene .ed-cursor{fill:#f6f8fc;stroke:#091725;stroke-width:1.5;filter:drop-shadow(0 3px 4px #0006)}.editorial-scene .ed-focus-ring{fill:none;stroke:var(--ed-accent);stroke-width:3}
.editorial-scene .ed-center{justify-content:center;text-align:center}.editorial-scene .ed-serif{font-family:Georgia,serif;font-style:italic;font-weight:400}.editorial-scene .ed-ink{fill:var(--ed-ink);color:var(--ed-ink)}
.editorial-scene .ed-stat{font-weight:800;letter-spacing:-3px}.editorial-scene .ed-context{fill:#c0cedd;color:#c0cedd;font-weight:500}
.editorial-scene .ed-index{fill:#bfd1df;font:18px Arial,sans-serif;letter-spacing:2px}.editorial-scene .ed-row{fill:#0b1726;stroke:#ffffff08;stroke-width:1}
.editorial-scene .ed-muted-line{fill:none;stroke:#ffffff20;stroke-width:1.5}.editorial-scene .ed-accent-stroke{fill:none;stroke:var(--ed-accent);stroke-width:3;stroke-linecap:round}
.editorial-scene .ed-check-box{fill:#132737;stroke:#ffffff40;stroke-width:1.5}.editorial-scene .ed-check{fill:none;stroke:var(--ed-accent);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}
.editorial-scene .ed-connector{fill:none;stroke:var(--ed-accent);stroke-width:3;stroke-linecap:round;opacity:.75}
.editorial-scene .ed-step-ring{fill:#163c4b;stroke:var(--ed-accent);stroke-width:2}.editorial-scene .ed-frame{fill:#223546;stroke:#ffffff26;stroke-width:1}.editorial-scene .ed-frame-rule{stroke:#ffffff22;stroke-width:1}
.editorial-scene .ed-dot{fill:var(--ed-accent)}.editorial-scene .ed-perforation{fill:#668596;opacity:.55}
.editorial-scene .ed-hub{fill:#142333;stroke:#ffffff22;stroke-width:2}.editorial-scene .ed-orbit{fill:none;stroke:var(--ed-accent);stroke-width:1;opacity:.25}.editorial-scene .ed-orbit-inner{fill:none;stroke:#ffffff12;stroke-width:2}.editorial-scene .ed-satellite{fill:#142333;stroke:#ffffff24;stroke-width:1}
`;

/** Embed with .toString() and call after displaying the active section. No clock,
 * timers, CSS animation or retained state: every seek resets opacity and paths. */
export function seekEditorialScene(root:Element,t:number){
 const clamp=(v:number)=>Math.max(0,Math.min(1,v));
 const ease=(v:number)=>1-Math.pow(1-clamp(v),3);
 root.querySelectorAll<SVGElement>('[data-ed-reveal]').forEach(el=>{
  const p=ease((t-Number(el.dataset.edReveal)+.24)/.24),x=Number(el.dataset.edX??0),y=Number(el.dataset.edY??0);
  el.style.opacity=String(p);el.setAttribute('transform',`translate(${x} ${y+(1-p)*18})`);
 });
 root.querySelectorAll<SVGElement>('[data-ed-draw]').forEach(el=>{
  const p=ease((t-Number(el.dataset.edDraw)+.24)/.24);
  el.style.strokeDasharray='1';el.style.strokeDashoffset=String(1-p);el.style.opacity=String(p>0?1:0);
 });
 root.querySelectorAll<SVGElement>('[data-ed-attention]').forEach(el=>{
  const start=Number(el.dataset.edAttention),end=Number(el.dataset.edUntil);
  const enter=ease((t-start+.24)/.24),leave=ease((end-t)/.22);
  el.style.opacity=String(enter*leave);
 });
 root.querySelectorAll<SVGElement>('[data-ed-cursor]').forEach(el=>{
  const start=Number(el.dataset.edCursor),end=Number(el.dataset.edUntil),p=ease((t-start+.3)/.3);
  const x=Number(el.dataset.edX),y=Number(el.dataset.edY),fromX=Number(el.dataset.edFromX??x+45),fromY=Number(el.dataset.edFromY??y+35);
  el.style.opacity=String(p*ease((end-t)/.18));
  el.setAttribute('transform',`translate(${x+(1-p)*(fromX-x)} ${y+(1-p)*(fromY-y)})`);
 });
 // Interaction phases are independently seekable, including reset before arrival.
 root.querySelectorAll<SVGElement>('[data-ed-press]').forEach(el=>{
  const p=clamp((t-Number(el.dataset.edPress))/.22),press=Math.sin(Math.PI*p);
  el.setAttribute('transform',`scale(${1-.14*press})`);
 });
 root.querySelectorAll<SVGElement>('[data-ed-click-ring]').forEach(el=>{
  const raw=(t-Number(el.dataset.edClickRing))/.42,p=clamp(raw);
  el.setAttribute('r',String(8+28*p));el.style.opacity=String(raw>=0&&raw<1?(1-p)*.8:0);
 });
 root.querySelectorAll<SVGElement>('[data-ed-result]').forEach(el=>{
  const start=Number(el.dataset.edResult),end=Number(el.dataset.edUntil);
  el.style.opacity=String(ease((t-start)/.22)*ease((end-t)/.18));
 });
 root.querySelectorAll<SVGElement>('[data-ed-focus]').forEach(el=>{
  const start=Number(el.dataset.edFocus),end=Number(el.dataset.edUntil),x=Number(el.dataset.edX),y=Number(el.dataset.edY);
  const p=ease((t-start)/.32)*ease((end-t)/.25);
  el.setAttribute('transform',`translate(${x} ${y}) scale(${1+.035*p}) translate(${-x} ${-y})`);
 });
 root.querySelectorAll<SVGElement>('[data-ed-expand]').forEach(el=>{
  const p=ease((t-Number(el.dataset.edExpand))/.45);
  el.setAttribute('height',String(Number(el.dataset.edHeight)+Number(el.dataset.edGrowth)*p));
 });
 root.querySelectorAll<SVGElement>('[data-ed-object]').forEach(el=>{
  const p=ease((t-Number(el.dataset.edObject)+.3)/.3),x=Number(el.dataset.edX),y=Number(el.dataset.edY);
  el.style.opacity=String(p);
  el.setAttribute('transform',`translate(${x} ${y+(1-p)*24}) rotate(${(1-p)*-7}) scale(${.8+.2*p}) translate(${-x} ${-y})`);
 });
 root.querySelectorAll<SVGElement>('[data-ed-flow]').forEach(el=>{
  const raw=(t-Number(el.dataset.edFlow))/Number(el.dataset.edDuration),p=clamp(raw),q=1-p;
  const [x0,y0,x1,y1,x2,y2,x3,y3]=(el.dataset.edPoints??'').split(',').map(Number);
  el.setAttribute('cx',String(q*q*q*x0+3*q*q*p*x1+3*q*p*p*x2+p*p*p*x3));
  el.setAttribute('cy',String(q*q*q*y0+3*q*q*p*y1+3*q*p*p*y2+p*p*p*y3));
  el.style.opacity=String(raw>0&&raw<1?Math.min(1,p*8,(1-p)*8):0);
 });
 root.querySelectorAll<HTMLElement>('[data-ed-type]').forEach(el=>{
  const text=el.dataset.edText??'',at=Number(el.dataset.edType),p=clamp((t-at+.6)/.6);
  el.textContent=text.slice(0,Math.round(text.length*p));
 });
 root.querySelectorAll<HTMLElement>('[data-ed-caret]').forEach(el=>{
  const at=Number(el.dataset.edCaret);
  el.style.opacity=String(t>=at-.6&&t<at+.35?1:0);
 });

}
