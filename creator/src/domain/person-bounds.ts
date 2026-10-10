// Match the compositor's alpha bbox threshold. Never trim visible hands/hair
// merely to create a tighter face crop.
export function personBounds(rgba:ArrayLike<number>,width:number,height:number){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left||bottom<top)throw Error('Empty person preview');
 return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}
