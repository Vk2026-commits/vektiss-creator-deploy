const listeners=new Set<()=>void>();
export function subscribeAvatarLibrary(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function notifyAvatarLibrary(){listeners.forEach(listener=>listener());}
