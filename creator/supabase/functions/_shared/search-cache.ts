// Private, owner-scoped cache. Filter/profile changes produce a different key.
export async function searchCacheKey(value:unknown):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function createSearchCache(db:any,userId:string){
 return {
  async get(key:string){const {data}=await db.from('creator_search_cache').select('payload').eq('user_id',userId).eq('cache_key',key).gt('expires_at',new Date().toISOString()).maybeSingle();return data?.payload;},
  async put(key:string,payload:unknown,ttlMs:number){await db.from('creator_search_cache').delete().eq('user_id',userId).lt('expires_at',new Date().toISOString());await db.from('creator_search_cache').upsert({user_id:userId,cache_key:key,payload,expires_at:new Date(Date.now()+ttlMs).toISOString()},{onConflict:'user_id,cache_key'});}
 };
}
