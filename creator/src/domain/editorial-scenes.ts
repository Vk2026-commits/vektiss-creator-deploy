import type {EditProposal,EditSource} from './edit-templates';

export type EditorialBeat=EditProposal['beats'][number]&{start:number;end:number};
const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const label=(text:string,x:number,y:number,w:number,h:number,size=32,extra='')=>`<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" class="ed-label ${extra}" style="font-size:${size}px">${esc(text)}</div></foreignObject>`;
const reveal=(at:number,body:string,x=0,y=0)=>`<g data-ed-reveal="${at}" data-ed-x="${x}" data-ed-y="${y}" transform="translate(${x} ${y})">${body}</g>`;
const line=(d:string,at:number)=>`<path class="ed-connector" d="${d}" pathLength="1" data-ed-draw="${at}"/>`;

/** Trusted vector compositions, not model-generated HTML. All displayed language
 * comes from approved labels. Motion is a function of time, including backwards seeks. */
export function editorialScene(source:EditSource,beat:EditorialBeat):string{
 const nodes=beat.graphics?.nodes??[];
 const kind=beat.scene??(beat.visual==='steps'?'process':beat.visual==='comparison'?'comparison':beat.visual==='typography'?'spotlight':'document');
 const at=(i:number)=>nodes[i]?.revealWord===undefined?Math.min(beat.end-.001,beat.start+.15+i*.45):source.words[nodes[i].revealWord!].start;
 const index=(i:number,x:number,y:number)=>`<text class="ed-index" x="${x}" y="${y}">${String(i+1).padStart(2,'0')}</text>`;
 const panel=(x:number,y:number,w:number,h:number)=>`<rect class="ed-panel" x="${x}" y="${y}" width="${w}" height="${h}" rx="24"/>`;
 let body='';
 if(kind==='document'){
  // A single coherent document, with one ruled row per spoken item. The
  // check stroke draws after the row lands instead of popping a static icon.
  const h=Math.min(104,448/Math.max(1,nodes.length)),panelHeight=80+nodes.length*h,panelY=(640-panelHeight)/2,top=panelY+60;
  body=reveal(beat.start,panel(34,panelY,832,panelHeight)+`<path class="ed-muted-line" d="M66 ${panelY+47}H834"/><circle class="ed-accent-stroke" cx="79" cy="${panelY+24}" r="8"/><path class="ed-accent-stroke" d="m85 ${panelY+30} 8 8"/><path class="ed-muted-line" d="M117 ${panelY+24}H335"/>`);
  body+=nodes.map((n,i)=>reveal(at(i),`<rect class="ed-row" x="0" y="0" width="764" height="${h-12}" rx="10"/><rect class="ed-check-box" x="18" y="${h/2-20}" width="30" height="30" rx="6"/><path class="ed-check" d="M24 ${h/2-5}l7 7 14 -17" pathLength="1" data-ed-draw="${at(i)+.18}"/>${label(n.label,72,5,650,h-20,nodes.length>4?24:34)}`,68,top+i*h)).join('');
 }else if(kind==='timeline'){
  const cols=Math.min(3,Math.max(1,nodes.length)),rows=Math.ceil(nodes.length/cols),w=770/cols;
  body=reveal(beat.start,panel(34,65,832,510));
  body+=nodes.map((n,i)=>{
   const x=65+(i%cols)*w,y=rows===1?215:155+Math.floor(i/cols)*210;
   const segment=i%cols<cols-1&&i<nodes.length-1?line(`M${x+w/2} ${y}H${x+w*1.5}`,at(i+1)):'';
   return segment+reveal(at(i),`<circle class="ed-step-ring" cx="${w/2}" cy="0" r="28"/>${index(i,w/2-13,7)}${label(n.label,10,47,w-20,104,Math.min(n.label.length>24?26:34,w/7),'ed-center')}`,x,y);
  }).join('');
 }else if(kind==='process'){
  // A storyboard tray: approved steps occupy illustrated frames; only explicit
  // model/user links connect them. No fake play counts, app data or measurements.
  const cols=Math.min(3,Math.max(1,nodes.length)),rows=Math.ceil(nodes.length/cols),w=760/cols;
  const positions=nodes.map((_,i)=>({x:70+(i%cols)*w,y:rows===1?170:95+Math.floor(i/cols)*235}));
  body=reveal(beat.start,panel(34,40,832,560)+Array.from({length:34},(_,i)=>`<rect class="ed-perforation" x="${61+i*23}" y="560" width="15" height="16" rx="2"/>`).join(''));
  body+=(beat.graphics?.links??[]).filter(l=>l.from!==l.to&&positions[l.from]&&positions[l.to]).map(l=>{const a=positions[l.from],b=positions[l.to];return line(`M${a.x+w/2} ${a.y+165}C${a.x+w/2} ${a.y+210},${b.x+w/2} ${b.y+210},${b.x+w/2} ${b.y+165}`,Math.max(at(l.from),at(l.to))+.18);}).join('');
  body+=nodes.map((n,i)=>reveal(at(i),`<rect class="ed-frame" width="${w-18}" height="172" rx="12"/><path class="ed-frame-rule" d="M15 48H${w-33}"/>${index(i,18,31)}<circle class="ed-dot" cx="${w-45}" cy="26" r="5"/>${label(n.label,18,61,w-54,92,Math.min(n.label.length>24?25:34,w/7))}`,positions[i].x,positions[i].y)).join('');
 }else if(kind==='network'){
  // A hub and independently labelled satellites, not a misleading quantitative
  // chart. Explicit links are respected; no arbitrary pulse implies causation.
  const hub={x:230,y:320},others=nodes.slice(1),gap=460/Math.max(1,others.length),pos=[hub,...others.map((_,i)=>({x:628,y:90+gap*(i+.5)}))];
  body+=(beat.graphics?.links??[]).filter(l=>l.from!==l.to&&pos[l.from]&&pos[l.to]).map(l=>{const a=pos[l.from],b=pos[l.to];return line(`M${a.x} ${a.y}C${(a.x+b.x)/2} ${a.y},${(a.x+b.x)/2} ${b.y},${b.x} ${b.y}`,Math.max(at(l.from),at(l.to))+.15);}).join('');
  if(nodes[0])body+=reveal(at(0),`<circle class="ed-orbit" r="170"/><circle class="ed-hub" r="145"/><circle class="ed-orbit-inner" r="126"/>${label(nodes[0].label,-112,-65,224,130,nodes[0].label.length>24?28:35,'ed-center')}`,hub.x,hub.y);
  body+=others.map((n,i)=>reveal(at(i+1),`<rect class="ed-satellite" x="-160" y="-${Math.min(48,gap/2-7)}" width="320" height="${Math.min(96,gap-14)}" rx="14"/>${label(n.label,-140,-Math.min(40,gap/2-12),280,Math.min(80,gap-24),n.label.length>30?22:others.length>3?26:32)}`,pos[i+1].x,pos[i+1].y)).join('');
 }else if(kind==='statistic'){
  // A source-labelled hero figure; never derive bar lengths or percentages from
  // text. This also supports non-numeric source takeaways without coercion.
  body=reveal(beat.start,panel(44,60,812,520)+`<path class="ed-muted-line" d="M84 125H816"/><circle class="ed-dot" cx="88" cy="98" r="5"/>`);
  if(nodes[0])body+=reveal(at(0),label(nodes[0].label,84,148,732,205,nodes[0].label.length>24?58:82,'ed-stat'));
  body+=nodes.slice(1).map((n,i)=>reveal(at(i+1),`<path class="ed-muted-line" d="M84 ${385+i*80}H816"/>${label(n.label,84,393+i*80,732,66,30,'ed-context')}`)).join('');
 }else if(kind==='comparison'){
  const cols=nodes.length===1?1:2,rows=Math.ceil(nodes.length/cols),w=790/cols,h=Math.min(238,490/Math.max(1,rows));
  body=nodes.map((n,i)=>reveal(at(i),panel(0,0,w-20,h-20)+`${index(i,26,44)}<path class="ed-accent-stroke" d="M26 65H${w-46}"/>${label(n.label,26,82,w-72,h-120,rows>2?24:n.label.length>30?30:36)}`,55+(i%cols)*w,70+Math.floor(i/cols)*h)).join('');
 }else{
  // Editorial statement on open paper; no card chrome. A short secondary phrase
  // gets the serif treatment from the reference, preserving the actual words.
  const statements=nodes.length?nodes.map(n=>n.label):[beat.headline];
  const gap=480/statements.length;
  body=statements.map((text,i)=>reveal(nodes.length?at(i):beat.start,`${i===0?'<path class="ed-accent-stroke" d="M60 25H150"/>':''}${label(text,60,45,780,gap-35,statements.length>3?(text.length>30?26:36):text.length>28?56:74,i%2?'ed-serif ed-ink':'ed-ink')}`,0,45+i*gap)).join('');
 }
 return `<svg class="diagram editorial-scene" data-editorial-kind="${kind}" viewBox="0 0 900 640" role="img" aria-label="${esc(beat.headline)}">${body}</svg>`;
}

export const editorialSceneStyles=`
.editorial-scene{overflow:visible;--ed-accent:var(--editorial-accent,#1688ff);--ed-ink:var(--editorial-ink,#10263d)}
.editorial-scene .ed-panel{fill:#142333;stroke:#ffffff24;stroke-width:1;filter:drop-shadow(0 16px 15px #10263d20)}
.editorial-scene .ed-label{height:100%;display:flex;align-items:center;color:#f6f8fc;font-family:Arial,sans-serif;font-weight:650;line-height:1.13;letter-spacing:-.7px;overflow-wrap:anywhere;box-sizing:border-box}
.editorial-scene .ed-center{justify-content:center;text-align:center}.editorial-scene .ed-serif{font-family:Georgia,serif;font-style:italic;font-weight:400}.editorial-scene .ed-ink{color:var(--ed-ink)}
.editorial-scene .ed-stat{font-weight:800;letter-spacing:-3px}.editorial-scene .ed-context{color:#c0cedd;font-weight:500}
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
  const p=ease((t-Number(el.dataset.edReveal))/.48),x=Number(el.dataset.edX??0),y=Number(el.dataset.edY??0);
  el.style.opacity=String(p);el.setAttribute('transform',`translate(${x} ${y+(1-p)*18})`);
 });
 root.querySelectorAll<SVGElement>('[data-ed-draw]').forEach(el=>{
  const p=ease((t-Number(el.dataset.edDraw))/.65);
  el.style.strokeDasharray='1';el.style.strokeDashoffset=String(1-p);el.style.opacity=String(p>0?1:0);
 });
}
