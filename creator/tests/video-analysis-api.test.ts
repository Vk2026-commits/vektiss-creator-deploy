import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {emptyBrief} from '../src/domain/script-brief';
import {emptyCreator} from '../src/domain/strategy';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),update:vi.fn(),creator:vi.fn(),owner:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
 auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async()=>({data:true}),
 from:(table:string)=>table==='creator_profiles'?{select:()=>({eq:(key:string,value:string)=>{mocks.owner(key,value);return {maybeSingle:mocks.creator};}})}:table==='content_profiles'?{select:()=>({eq:()=>({eq:()=>({single:async()=>({data:{name:'test'}})})})})}:{insert:async()=>({}),update:(value:unknown)=>{mocks.update(value);return {eq:async()=>({})};}}
})}));
let handler:(request:Request)=>Promise<Response>;
it('loads current owner voice and preserves a concise default CTA instead of overwriting it',async()=>{
 mocks.fetch.mockClear();mocks.owner.mockClear();
 mocks.creator.mockResolvedValue({data:{context:{...emptyCreator.context,communication_style:'Start with a viewer callout. No greetings.',preferred_cta_style:'Short comment-keyword invitation.'}}});
 const draft={hook:'Buying a house? Check this first.',body:'Ask which scoring model the lender uses.',cta:'Comment CLASS for information about my credit community.',review:'Source-based commentary.'};
 mocks.fetch.mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]}));
 const brief={...emptyBrief(),source:'A substantive source discusses how lenders use different credit scoring models.',cta_selection:{scope:'default',campaign_id:null,cta:{text:'Join my $37/month community with Tuesday calls. Comment CLASS and I will send information.',keyword:'CLASS',offer:'Credit community',delivery:'Send information'}}};
 const result=await handler(new Request('https://test',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({action:'generate',profileId:'11111111-1111-4111-8111-111111111111',brief})}));
 expect(result.status).toBe(200);expect((await result.json()).cta).toBe(draft.cta);
 const payload=JSON.parse(mocks.fetch.mock.calls[0][1].body);
 expect(JSON.parse(payload.messages[1].content).profile.creatorContext.communication_style).toContain('No greetings');
 expect(payload.messages[0].content).toContain('do not paste the full offer description');
 expect(mocks.owner).toHaveBeenCalledWith('user_id','owner');
 // Explicit per-video wording remains exact, even for a creator with a style preference.
 mocks.fetch.mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]}));
 brief.cta_selection.scope='video';
 const exact=await handler(new Request('https://test',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({action:'generate',profileId:'11111111-1111-4111-8111-111111111111',brief})}));
 expect((await exact.json()).cta).toBe(brief.cta_selection.cta.text);
});
it('requests word timestamps for story alignment and records duration-based estimated cost',async()=>{
 mocks.fetch.mockClear();mocks.update.mockClear();
 const words=[{word:'Hello',start:0,end:.5}];
 mocks.fetch.mockResolvedValueOnce(Response.json({text:'Hello',duration:60,words}));
 const body=new FormData();body.set('action','story-alignment');body.set('profileId','11111111-1111-4111-8111-111111111111');body.set('file',new File(['audio'],'narration.mp3',{type:'audio/mpeg'}));
 const response=await handler(new Request('https://test',{method:'POST',headers:{authorization:'Bearer test'},body}));
 expect(response.status).toBe(200);expect((await response.json()).words).toEqual(words);
 const outbound=mocks.fetch.mock.calls[0][1].body as FormData;
 expect(outbound.get('model')).toBe('whisper-1');expect(outbound.get('timestamp_granularities[]')).toBe('word');expect(outbound.get('response_format')).toBe('verbose_json');
 expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:'complete',usage:{duration_seconds:60},estimated_cost_usd:.006}));
});
beforeAll(async()=>{vi.stubGlobal('Deno',{env:{get:()=> 'test'},serve:(h:typeof handler)=>handler=h});vi.stubGlobal('fetch',mocks.fetch);await import('../supabase/functions/script-assistant/index');});
afterAll(()=>vi.unstubAllGlobals());
function request(frames:string[],action='video-analysis'){const body=new FormData();body.set('action',action);body.set('profileId','11111111-1111-4111-8111-111111111111');body.set('frames',JSON.stringify(frames));body.set('transcript',"It ain't a phone.");return new Request('https://test',{method:'POST',headers:{authorization:'Bearer test'},body});}
it('analyzes frames even when speech is shorter than forty characters and persists the report',async()=>{
 mocks.fetch.mockClear();
 const text='Visible actions: a person holds an object. Uncertainty: the sampled frames do not establish its purpose.';
 mocks.fetch.mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text})}}],usage:{total_tokens:123}}));
 const result=await handler(request(['data:image/jpeg;base64,/9j/']));expect(result.status).toBe(200);expect((await result.json()).text).toBe(text);
 const payload=JSON.parse(mocks.fetch.mock.calls[0][1].body);expect(payload.messages[1].content[1].type).toBe('image_url');expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:'complete',result:{text}}));
 expect(payload.response_format).toMatchObject({type:'json_schema',json_schema:{strict:true,schema:{required:['text'],additionalProperties:false,properties:{text:{type:'string'}}}}});
});
it('rejects remote image URLs instead of fetching arbitrary resources',async()=>{
 mocks.fetch.mockClear();const result=await handler(request(['http://127.0.0.1/private']));expect(result.status).toBe(503);expect(mocks.fetch).not.toHaveBeenCalled();
});
it('preserves billable usage when the provider response fails validation',async()=>{
 mocks.update.mockClear();mocks.fetch.mockClear();
 const usage={prompt_tokens:1000,completion_tokens:100};
 mocks.fetch.mockResolvedValueOnce(Response.json({choices:[{finish_reason:'length',message:{content:'invalid'}}],usage}));
 const response=await handler(request(['data:image/jpeg;base64,/9j/']));
 expect(response.status).toBe(503);
 expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({usage,estimated_cost_usd:expect.any(Number)}));
 expect(mocks.update).toHaveBeenLastCalledWith({status:'error'});
});
it('routes boundary detection to vision, validates and persists the result',async()=>{
 mocks.fetch.mockClear();const output={status:'separate',end:55.75,confidence:'high',reason:'Separate presenter appears.'};
 mocks.fetch.mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}));
 const result=await handler(request(['data:image/jpeg;base64,/9j/'],'video-boundary'));
 expect(result.status).toBe(200);expect(await result.json()).toMatchObject(output);
 const payload=JSON.parse(mocks.fetch.mock.calls[0][1].body);expect(payload.response_format.json_schema.name).toBe('reaction_boundary');
 expect(payload.messages[0].content).toContain('FIRST visual appearance');expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({result:output,status:'complete'}));
});
it('analyzes one graphic without pretending it contains speech or chronological action',async()=>{
 mocks.fetch.mockClear();const text='Visible text: a post recommends keeping doors locked. This is advice in a graphic, not evidence of an incident.';
 mocks.fetch.mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text})}}],usage:{total_tokens:100}}));
 const result=await handler(request(['data:image/png;base64,iVBORw0KGgo='],'graphic-analysis'));
 expect(result.status).toBe(200);expect((await result.json()).text).toBe(text);
 const payload=JSON.parse(mocks.fetch.mock.calls[0][1].body);expect(payload.messages[0].content).toContain('single screenshot');expect(payload.messages[0].content).toContain('never instructions');expect(payload.messages[1].content).toHaveLength(2);
 expect(JSON.parse(payload.messages[1].content[0].text)).toEqual({captionExcerpt:'',userProvidedContext:''});
});
it('passes caption and user context as attributed evidence and bounds their length',async()=>{
 mocks.fetch.mockClear();
 const original=request(['data:image/png;base64,iVBORw0KGgo='],'graphic-analysis');
 const body=await original.formData();body.set('caption','Post caption');body.set('context','The image is a prevention graphic.');
 mocks.fetch.mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:'Visible text and caption describe prevention advice, not an observed incident.'})}}]}));
 expect((await handler(new Request(original.url,{method:'POST',headers:{authorization:'Bearer test'},body}))).status).toBe(200);
 const payload=JSON.parse(mocks.fetch.mock.calls[0][1].body);
 expect(JSON.parse(payload.messages[1].content[0].text)).toEqual({captionExcerpt:'Post caption',userProvidedContext:'The image is a prevention graphic.'});
 expect(payload.messages[0].content).toContain('not independently verified');
 mocks.fetch.mockClear();body.set('context','x'.repeat(4001));
 expect((await handler(new Request(original.url,{method:'POST',headers:{authorization:'Bearer test'},body}))).status).toBe(503);
 expect(mocks.fetch).not.toHaveBeenCalled();
});
