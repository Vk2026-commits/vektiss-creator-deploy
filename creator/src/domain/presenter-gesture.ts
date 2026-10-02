export type Placement={x:number;y:number;width:number};
export type Point={x:number;y:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function movePlacement(p:Placement,from:Point,to:Point,canvas:{width:number;height:number;left:number;top:number},scale=1,resize=false){
 const width=clamp(resize?p.width+(to.x-from.x)/canvas.width*200:p.width*scale,5,100);
 const actualScale=width/p.width;
 return {width,x:clamp(resize?p.x:((to.x-canvas.left)+(p.x*canvas.width-(from.x-canvas.left))*actualScale)/canvas.width,-2,3),y:clamp(resize?p.y:((to.y-canvas.top)+(p.y*canvas.height-(from.y-canvas.top))*actualScale)/canvas.height,-2,3)};
}
