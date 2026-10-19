import { beforeAll, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({getUser:vi.fn(),from:vi.fn(),rpc:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({auth:{getUser:mocks.getUser},from:mocks.from,rpc:mocks.rpc})}));
let handler:(request:Request)=>Promise<Response>;
beforeAll(async()=>{
  vi.stubGlobal("Deno",{env:{get:(key:string)=>key==="APP_ORIGIN"?"https://creator.vektiss.com":"test"},serve:(fn:typeof handler)=>{handler=fn;}});
  await import("../supabase/functions/search-quality-admin/index");
});
const request=(body:unknown)=>new Request("https://example.test",{method:"POST",headers:{origin:"https://creator.vektiss.com",authorization:"Bearer test","content-type":"application/json"},body:JSON.stringify(body)});
it("allows the actual Supabase SDK preflight headers",async()=>{
  const result=await handler(new Request("https://example.test",{method:"OPTIONS",headers:{origin:"https://creator.vektiss.com","access-control-request-headers":"authorization,x-client-info,apikey,content-type"}}));
  expect(result.status).toBe(204);
  expect(result.headers.get("access-control-allow-headers")).toContain("x-client-info");
});
it("denies ordinary creators before any cross-account query",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:"user",app_metadata:{}}},error:null});
  const result=await handler(request({action:"creators"}));
  expect(result.status).toBe(403); expect(mocks.from).not.toHaveBeenCalled();
});
it("lists creators for the trusted owner and rejects client supplied owner flags",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:"admin",app_metadata:{creator_cost_admin:true}}},error:null});
  const query:any={select:vi.fn(()=>query),order:vi.fn(()=>query),range:vi.fn(async()=>({data:[{id:"a",display_name:"Steve"}],count:1,error:null}))};
  mocks.from.mockReturnValue(query);
  expect(await (await handler(request({action:"creators"}))).json()).toEqual({creators:[{id:"a",display_name:"Steve"}],total:1});
  mocks.getUser.mockResolvedValue({data:{user:{id:"user",app_metadata:{}}},error:null});
  expect((await handler(request({action:"creators",creator_cost_admin:true}))).status).toBe(403);
});
