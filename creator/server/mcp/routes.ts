import {createClient} from '@supabase/supabase-js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {resolve} from 'node:path';
import {creatorMcpServer} from './tools';
import type {HostingConfig} from '../hosted-server';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function mcpRoutes(req:IncomingMessage,res:ServerResponse,c:HostingConfig):Promise<boolean>{
 const path=new URL(req.url??'/',c.origin).pathname;
 if(!['/api/mcp','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/api/mcp'].includes(path))return false;
 const origin=c.webOrigin??c.origin,resource=`${origin}/api/mcp`;
 const reply=(status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));return true;};
 if(path!=='/api/mcp')return reply(200,{resource,authorization_servers:[`${c.supabaseUrl}/auth/v1`],bearer_methods_supported:['header'],scopes_supported:['openid'],resource_name:'Vektiss Creator'});
 if(req.headers.origin&&req.headers.origin!==origin)return reply(403,{error:'Origin not allowed'});
 if(process.env.CREATOR_MCP_ENABLED!=='true'||!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(503,{error:'Creator AI connections are not enabled yet.'});
 if(req.method==='GET'||req.method==='DELETE')return reply(405,{error:'Use POST; this endpoint uses stateless requests.'});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 const authorization=req.headers.authorization??'';
 const unauth=()=>{res.setHeader('WWW-Authenticate',`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`);return reply(401,{error:'Sign in with Creator.'});};
 if(!authorization.startsWith('Bearer '))return unauth();
 const auth=createClient(c.supabaseUrl,c.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await auth.auth.getClaims(authorization.slice(7));
 const claims=data?.claims;
 if(error||!claims||!uuid.test(claims.sub)||claims.iss!==`${c.supabaseUrl}/auth/v1`||claims.aud!==resource||claims.role!=='creator_mcp'||typeof claims.client_id!=='string'||!uuid.test(claims.client_id)||!claims.exp||claims.exp<=Date.now()/1000)return unauth();
 const db=createClient(c.supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const [pilot,connection]=await Promise.all([db.from('creator_mcp_pilots').select('enabled').eq('user_id',claims.sub).maybeSingle(),db.from('creator_mcp_connections').select('approved_at').eq('user_id',claims.sub).eq('client_id',claims.client_id).is('revoked_at',null).maybeSingle()]);
 if(pilot.error||connection.error||!pilot.data?.enabled||!connection.data||typeof claims.creator_mcp_grant!=='string'||Date.parse(claims.creator_mcp_grant)!==Date.parse(connection.data.approved_at))return reply(403,{error:'This pilot connection is unavailable. Reconnect in Creator.'});
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>128*1024)return reply(413,{error:'Request too large'});chunks.push(Buffer.from(chunk));}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply(400,{error:'Invalid JSON'});}
 const server=creatorMcpServer(db,claims.sub,claims.client_id,resolve(c.data,claims.sub),origin);
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{await server.connect(transport);await transport.handleRequest(req,res,body);}finally{await server.close();}
 return true;
}
