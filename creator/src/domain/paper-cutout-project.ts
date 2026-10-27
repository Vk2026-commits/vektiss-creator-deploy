import type {EditBrand} from './edit-brand.ts';

/** Apply the tactile stage to trusted Motion HTML. presenter.webm must contain real alpha. */
export function paperCutoutTreatment(html:string,brand:EditBrand,wide:boolean,sample:boolean){
 const paper=`
 #stage{background:${brand.background};background-image:radial-gradient(${brand.text}18 .8px,transparent .8px);background-size:7px 7px}
 #stage:before{content:'';position:absolute;left:-8%;top:32%;width:116%;height:58%;background:${brand.primary}18;transform:rotate(-5deg);clip-path:polygon(0 2%,6% 0,13% 3%,23% 1%,34% 3%,46% 0,59% 2%,71% 0,82% 3%,94% 0,100% 2%,100% 97%,91% 100%,79% 97%,66% 100%,52% 98%,40% 100%,29% 97%,15% 100%,0 98%)}
 video{inset:auto!important;left:${wide?'48':'8'}%!important;bottom:8%!important;width:${wide?'48':'84'}%!important;height:${wide?'86':'68'}%!important;object-fit:contain;object-position:center bottom;transform-origin:50% 100%;z-index:2;background:transparent!important;filter:drop-shadow(10px 14px 8px #0003)}
 section{z-index:3}.scrim{display:none}h1{color:${brand.text};text-shadow:none;font-size:${wide?88:86}px;top:7%;left:7%;width:${wide?'43':'86'}%;letter-spacing:-3px}h1 span:last-child{color:${brand.primary};background:transparent}
 [data-kind="spotlight"] h1{top:7%;width:${wide?'43':'86'}%;font-size:${wide?96:92}px}
 .visual,[data-kind="document"] .visual{left:7%;width:${wide?'38':'86'}%;top:${wide?'45':'69'}%;height:${wide?'32':'17'}%;gap:20px}
 .card,[data-kind="document"] .card{border:0;border-radius:2px;background:${brand.background};box-shadow:5px 8px 0 ${brand.primary}55,0 12px 26px #0002;font-size:${wide?38:42}px;padding:24px;line-height:1.12}
 .beat-line{top:4%;height:8px}.index{color:${brand.primary}}#captions{z-index:10}
 ${sample?'#sample-label{z-index:4;top:52%;left:28%;color:'+brand.text+'}video{clip-path:polygon(38% 10%,62% 10%,68% 25%,60% 35%,80% 45%,90% 100%,10% 100%,20% 45%,40% 35%,32% 25%);background:'+brand.primary+'55!important}':''}
 `;
 return html.replace('<title>Vektiss Talking Head Motion</title>','<title>Vektiss Paper Cutout</title>').replace('</style>',paper+'</style>').replace('src="source.mp4"','src="presenter.webm"').replace('data-has-audio="true"','data-has-audio="false"');
}
