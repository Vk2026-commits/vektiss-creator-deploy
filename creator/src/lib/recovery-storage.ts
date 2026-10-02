// Storage may be unavailable in private mode. Never let that prevent normal work.
export function recoveryRead(key:string):string|null{try{return localStorage.getItem(key);}catch{return null;}}
export function recoveryWrite(key:string,value:string|null){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{/* Best effort on restricted browsers. */}}
