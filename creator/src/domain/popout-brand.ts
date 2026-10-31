import type {EditBrand} from './edit-brand';
/** Pop-out uses a fixed light canvas; brand color remains an accent, never a wall. */
export function popoutBrand(brand:EditBrand):EditBrand{
 let rgb=brand.primary.slice(1).match(/../g)!.map(v=>parseInt(v,16));
 const luminance=()=>rgb.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 while(1.05/(luminance()+.05)<4.5)rgb=rgb.map(v=>Math.floor(v*.95));
 return {...brand,background:'#FFFFFF',text:'#171717',primary:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()};
}
