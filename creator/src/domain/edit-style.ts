import {defaultEditBrand,editBrandSchema,type EditBrand} from './edit-brand';
export type StyleOrigin='video'|'campaign'|'creator'|'fallback';
/** Snapshot identity per video. Saving a plan never writes back to the creator. */
export function resolveEditStyle(creator:Partial<EditBrand>={},campaign:Partial<EditBrand>={},video:Partial<EditBrand>={}){
 const fallback={...defaultEditBrand,fontFamily:'Arial' as const,presenterTreatment:'head-pop' as const,motionStyle:'balanced' as const};
 const values={...fallback},origins={} as Record<keyof EditBrand,StyleOrigin>;
 for(const key of Object.keys(fallback) as (keyof EditBrand)[]){
  const layer=video[key]!==undefined?'video':campaign[key]!==undefined?'campaign':creator[key]!==undefined?'creator':'fallback';
  Object.assign(values,{[key]:({video,campaign,creator,fallback}[layer])[key]});origins[key]=layer;
 }
 return {version:1,brand:editBrandSchema.parse(values),origins};
}
