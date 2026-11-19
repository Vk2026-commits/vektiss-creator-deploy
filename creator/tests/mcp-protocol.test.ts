import {expect,it} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {creatorMcpServer} from '../server/mcp/tools';
it('exposes only preparation tools over the real MCP protocol',async()=>{
 const db={rpc:async()=>({data:1,error:null}),from:()=>({update:()=>({eq:async()=>({error:null})})})};
 const server=creatorMcpServer(db as never,'u','c','/tmp/mcp-test','https://creator.vektiss.com');
 const client=new Client({name:'mock-client',version:'1'});
 const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);
 try{const {tools}=await client.listTools();expect(tools.map(t=>t.name).sort()).toEqual(['create_draft','get_project','list_avatars','list_profiles','list_projects','list_templates','update_draft']);
 const result=await client.callTool({name:'list_templates',arguments:{}});expect(JSON.stringify(result)).toContain('tier-list');
 expect(tools.some(t=>/render|generate|approve|delete/.test(t.name))).toBe(false);
 }finally{await client.close();await server.close();}
});
it('revoked connections cannot call even read tools',async()=>{
 const db={rpc:async()=>({data:null,error:{message:'MCP_ACCESS_DENIED'}})};
 const server=creatorMcpServer(db as never,'u','c','/tmp/mcp-test','https://creator.vektiss.com');const client=new Client({name:'mock',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);
 try{const result=await client.callTool({name:'list_templates',arguments:{}});expect(result.isError).toBe(true);expect(JSON.stringify(result)).toContain('Reconnect');}finally{await client.close();await server.close();}
});
