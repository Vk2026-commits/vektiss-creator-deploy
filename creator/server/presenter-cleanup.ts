import {createHash} from 'node:crypto';

// A verified repair for this exact completed render, not a generic person mask.
const jobId='debf8b35-a0d0-4ccf-af91-20f30e656c01';
const sourceHash='aee62aa10c194941c6572b471382ad2d6899b0897b1c68346452159f5b4ddf3e';
export function repairedCompositionId(base:string,job:string){
 return job===jobId?createHash('sha256').update(`${base}:table-cleanup-v1`).digest('hex'):base;
}
export function presenterCleanup(job:string,bytes:Uint8Array,width:number,height:number){
 if(job!==jobId)return '';
 if(width!==720||height!==1280||createHash('sha256').update(bytes).digest('hex')!==sourceHash){
  throw Error('This presenter differs from the verified cleanup source. The original is preserved; no new render was started.');
 }
 // Preserve the moving face, sleeves and hands; remove the neutral tabletop
 // and its outer edges with a two-pixel feather below the seated silhouette.
 return "format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(Y,1096)*lt(r(X,Y)-g(X,Y),22)*gt(r(X,Y),65),0,alpha(X,Y))*clip((1185-0.00065*(X-360)*(X-360)-Y)/2,0,1)',";
}
