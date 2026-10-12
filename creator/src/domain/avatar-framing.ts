import {z} from 'zod';
// One source-space crop shared by the reference PNG, editor and compositor.
// The portrait preset stops above Stephen's tabletop; do not auto-tighten it
// around each render's moving hands, which changes the apparent face size.
export const STEPHEN_AVATAR='157e1395-cb66-47cf-9bd2-62e00ba5108c';
export const STEPHEN_FRAMING='stephen-portrait-v1' as const;
export const stephenCrop={x:0,y:186,width:720,height:910};
export const avatarFramings=['original','head-shoulders','chest-up','waist-up','custom'] as const;
export type AvatarFraming=typeof avatarFramings[number];
export const avatarFramingSchema=z.enum(avatarFramings);

// Crop fractions are measured from the already-detected transparent-pixel
// bounds. This keeps the operation a cut of the existing generated video and
// avoids inferring body landmarks from a single frame.
export const framePresetAmounts:Record<Exclude<AvatarFraming,'custom'|'original'>,number>={
 'head-shoulders':55,
 'chest-up':68,
 'waist-up':82,
};
const DEFAULT_CUSTOM_AMOUNT=70;
const CUSTOM_MIN_AMOUNT=30;
const CUSTOM_MAX_AMOUNT=100;
export const customFramingBounds={min:CUSTOM_MIN_AMOUNT,max:CUSTOM_MAX_AMOUNT,default:DEFAULT_CUSTOM_AMOUNT};
export const customFramingPositionBounds={min:0,max:100,default:0};

export type PersonCrop={x:number;y:number;width:number;height:number};
export function framingAmount(framing:AvatarFraming|undefined,amount:number|undefined){
 if(!framing||framing==='original')return CUSTOM_MAX_AMOUNT;
 const value=framing==='custom'?Math.round(amount??DEFAULT_CUSTOM_AMOUNT):framePresetAmounts[framing];
 return Math.max(CUSTOM_MIN_AMOUNT,Math.min(CUSTOM_MAX_AMOUNT,value));
}
export function framingPosition(framing:AvatarFraming|undefined,position:number|undefined){
 if(framing!=='custom')return 0;
 const value=Math.round(position??customFramingPositionBounds.default);
 return Math.max(customFramingPositionBounds.min,Math.min(customFramingPositionBounds.max,value));
}
export function framedAspect(baseAspect:number,framing:AvatarFraming|undefined,amount:number|undefined){
 return baseAspect*CUSTOM_MAX_AMOUNT/framingAmount(framing,amount);
}
export function avatarFramingCrop(base:PersonCrop,framing:AvatarFraming|undefined,amount:number|undefined,position?:number){
 if(!framing||framing==='original')return base;
 const height=Math.min(base.height,Math.max(32,Math.floor(base.height*framingAmount(framing,amount)/100)));
 const y=base.y+Math.round((base.height-height)*framingPosition(framing,position)/100);
 return {x:base.x,y,width:base.width,height};
}
export function avatarFraming(avatarId:string|null,format:string){
 return avatarId===STEPHEN_AVATAR&&format==='portrait'?STEPHEN_FRAMING:undefined;
}
// Legacy fixed crop applies when an old request omits presenter_framing. New
// requests still use it as the "Original" baseline for Stephen.
export function fixedPresenterCrop(framing:typeof STEPHEN_FRAMING|undefined,width:number,height:number){
 if(!framing)return undefined;
 if(width!==720||height!==1280)throw Error('Unsupported presenter framing. This render needs a matching preview before export.');
 return {...stephenCrop};
}
