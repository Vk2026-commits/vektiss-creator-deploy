// Never substitute an edited still for the actual provider video cutout.
// Authenticated, visually approved test previews are supplied separately.
export function avatarPreviewCutout(_id:string|null,_thumbnail:string|null):{url:string;viewBox:string;width:number;height:number}|null{
 return null;
}
