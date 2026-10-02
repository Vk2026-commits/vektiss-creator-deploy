// Bound the entire operation, including any auth wait before fetch starts.
export async function withDeadline<T>(run:(signal:AbortSignal)=>Promise<T>, milliseconds:number, message:string):Promise<T> {
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  return await Promise.race([
   run(controller.signal),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error(message));controller.abort();},milliseconds);}),
  ]);
 } finally {clearTimeout(timer);}
}
