import {beforeEach,expect,it,vi} from 'vitest';
import {createServer} from 'node:http';
import {mcpRoutes} from '../server/mcp/routes';
const mocks=vi.hoisted(()=>({claims:{} as any,pilot:true,grant:'2026-11-18T12:00:00.000Z'}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getClaims:async()=>({data:{claims:mocks.claims},error:null})},from:(table:string)=>{const query:any={select:()=>query,eq:()=>query,is:()=>query,maybeSingle:async()=>({data:table==='creator_mcp_pilots'?{enabled:mocks.pilot}:{approved_at:mocks.grant}})};return query;}})}));
const config={origin:'https://creator.vektiss.com',supabaseUrl:'https://test.supabase.co',publicKey:'public',data:'/tmp/mcp-test'} as any;
beforeEach(()=>{vi.stubEnv('CREATOR_MCP_ENABLED','true');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','mock');mocks.pilot=true;mocks.grant='2026-11-18T12:00:00.000Z';mocks.claims={sub:'11111111-1111-4111-8111-111111111111',client_id:'22222222-2222-4222-8222-222222222222',iss:config.supabaseUrl+'/auth/v1',aud:'https://creator.vektiss.com/api/mcp',role:'creator_mcp',exp:Date.now()/1000+600,creator_mcp_grant:mocks.grant};});
async function request(path='/api/mcp',headers:Record<string,string>={authorization:'Bearer mock'},body='{}'){
 const server=createServer((req,res)=>{void mcpRoutes(req,res,config).catch(()=>{res.writeHead(500);res.end();});});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{return await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`,{method:'POST',headers,body});}finally{server.closeAllConnections();server.close();}
}
it('advertises OAuth discovery and challenges unauthenticated requests',async()=>{const metadata=await request('/.well-known/oauth-protected-resource/api/mcp');expect(await metadata.json()).toMatchObject({resource:'https://creator.vektiss.com/api/mcp'});const r=await request('/api/mcp',{});expect(r.status).toBe(401);expect(r.headers.get('www-authenticate')).toContain('resource_metadata');});
it.each(['role','iss','aud','client_id','exp'])('rejects invalid %s claims',async key=>{mocks.claims[key]=key==='exp'?1:'wrong';expect((await request()).status).toBe(401);});
it('rejects unapproved accounts and old grants after reconnection',async()=>{mocks.pilot=false;expect((await request()).status).toBe(403);mocks.pilot=true;mocks.grant='2026-11-18T12:01:00.000Z';expect((await request()).status).toBe(403);});
it('fails closed when disabled and rejects browser cross-origin calls',async()=>{vi.stubEnv('CREATOR_MCP_ENABLED','false');expect((await request()).status).toBe(503);vi.stubEnv('CREATOR_MCP_ENABLED','true');expect((await request('/api/mcp',{authorization:'Bearer mock',origin:'https://untrusted.example'})).status).toBe(403);});
it('bounds request bodies',async()=>expect((await request('/api/mcp',{authorization:'Bearer mock'},'x'.repeat(130*1024))).status).toBe(413));
