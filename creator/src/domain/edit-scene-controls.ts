import type {EditProposal} from './edit-templates';
export type EditBeat=EditProposal['beats'][number];
export const visualChoices=[
 {id:'presenter',label:'Presenter only'},
 {id:'spotlight',label:'Text emphasis'},
 {id:'comparison',label:'Comparison'},
 {id:'process',label:'Steps'},
 {id:'timeline',label:'Timeline'},
 {id:'network',label:'Diagram'},
 {id:'statistic',label:'Statistic'},
 {id:'document',label:'Checklist'},
] as const;
export type VisualChoice=typeof visualChoices[number]['id'];
export function setSceneVisual(beat:EditBeat,choice:VisualChoice):EditBeat{
 if(choice==='presenter')return {...beat,visual:'presenter',layout:'presenter',headline:'',graphics:undefined,illustration:'Show the original presenter without added graphics.',motion:'Original footage.'};
 const max=choice==='statistic'?3:choice==='comparison'||choice==='document'?4:6;
 // Retain user-authored labels, not invented statistics or placeholder business claims.
 const nodes=(beat.graphics?.nodes??[]).slice(0,max).map(({tier:_,...node})=>node);
 return {...beat,scene:choice,visual:choice==='comparison'?'comparison':choice==='process'?'steps':choice==='spotlight'?'typography':'diagram',layout:'bottom-presenter',graphics:{nodes,links:[]},illustration:`${visualChoices.find(v=>v.id===choice)!.label} alongside the original presenter.`,motion:'Reveal elements in speech order.'};
}
export function removeSceneNode(beat:EditBeat,index:number):EditBeat{
 if(!beat.graphics)return beat;
 const nodes=beat.graphics.nodes.filter((_,i)=>i!==index);
 if(!nodes.length)return setSceneVisual(beat,'presenter');
 return {...beat,graphics:{nodes,links:beat.graphics.links.filter(l=>l.from!==index&&l.to!==index).map(l=>({from:l.from>index?l.from-1:l.from,to:l.to>index?l.to-1:l.to}))}};
}
