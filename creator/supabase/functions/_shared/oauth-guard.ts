// Deny-only check. Authentication still verifies the token normally afterward.
// OAuth clients may use the preparation MCP endpoint, never the app's paid APIs.
export function isConnectorToken(authorization:string|null|undefined):boolean{
 try{const raw=(authorization??'').replace(/^Bearer\s+/i,'').split('.')[1];if(!raw)return false;
 const c=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')));
 return Boolean(c.client_id)||c.role==='creator_mcp';
 }catch{return false;}
}
