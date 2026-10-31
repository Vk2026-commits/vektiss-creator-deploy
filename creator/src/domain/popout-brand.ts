import type {EditBrand} from './edit-brand';
export const popoutDark=(brand:EditBrand)=>parseInt(brand.background.slice(1,3),16)*.2126+parseInt(brand.background.slice(3,5),16)*.7152+parseInt(brand.background.slice(5,7),16)*.0722<128;
/** Keep the creator palette, with readable text and a restrained accent glow. */
export function popoutBrand(brand:EditBrand):EditBrand{
 return {...brand,text:popoutDark(brand)?'#FFFFFF':'#171717'};
}
export function popoutBackground(brand:EditBrand):string{
 return `radial-gradient(ellipse at 95% 12%, ${brand.primary}${popoutDark(brand)?'30':'12'} 0%, transparent 65%), ${brand.background}`;
}
