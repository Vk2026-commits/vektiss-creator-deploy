// One source-space crop shared by the reference PNG, editor and compositor.
// The portrait preset stops above Stephen's tabletop; do not auto-tighten it
// around each render's moving hands, which changes the apparent face size.
export const STEPHEN_AVATAR='157e1395-cb66-47cf-9bd2-62e00ba5108c';
export const STEPHEN_FRAMING='stephen-portrait-v1' as const;
export const stephenCrop={x:0,y:186,width:720,height:910};
export function avatarFraming(avatarId:string|null,format:string){
 return avatarId===STEPHEN_AVATAR&&format==='portrait'?STEPHEN_FRAMING:undefined;
}
export function fixedPresenterCrop(framing:typeof STEPHEN_FRAMING|undefined,width:number,height:number){
 if(!framing)return undefined;
 if(width!==720||height!==1280)throw Error('Unsupported presenter framing. This render needs a matching preview before export.');
 return {...stephenCrop};
}
