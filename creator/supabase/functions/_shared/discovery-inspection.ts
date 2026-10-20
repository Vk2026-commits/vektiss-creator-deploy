import {z} from 'zod';
import {sourceReviewSchema,metadataReview} from '../../../src/domain/discovery-pilot.ts';
import {researchSourceSchema,providerResearchCandidateSchema,type ResearchSource,type ProviderResearchCandidate} from '../../../src/domain/research.ts';
declare const Deno:{env:{get(k:string):string|undefined}};
const resultsSchema=z.object({results:z.array(z.object({providerSourceId:z.number().int(),review:sourceReviewSchema,summary:z.string().max(2500).optional(),angle:z.string().max(1800).optional()})).max(5),elapsedMs:z.number(),inspectedCount:z.number()});
export async function inspectPilot(jobId:string,authorization:string){
 const origin=Deno.env.get('CREATOR_MEDIA_ORIGIN')??'https://creator.vektiss.com';const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw Error('MEDIA_ORIGIN');
 const headers={authorization,'x-creator-capture':'1','content-type':'application/json','x-creator-job':jobId};
 const existing=await fetch(`${origin}/api/local-capture/jobs/${jobId}`,{headers,signal:AbortSignal.timeout(15000)});
 if(existing.status===202)return {state:'pending' as const};
 if(existing.ok)return {state:'completed' as const,...resultsSchema.parse(await existing.json())};
 if(existing.status!==404){if([429,503].includes(existing.status))return {state:'pending' as const};return {state:'failed' as const,reason:`Media review ${existing.status}; watch original.`};}
 const created=await fetch(`${origin}/api/local-capture/discovery-review`,{method:'POST',headers,body:JSON.stringify({jobId}),signal:AbortSignal.timeout(15000)});
 if(created.status===202||created.status===429)return {state:'pending' as const};return {state:'failed' as const,reason:`Media review ${created.status}; watch original.`};
}
export function mergePilotEvidence(sources:ResearchSource[],candidates:ProviderResearchCandidate[],results:z.infer<typeof resultsSchema>['results']){
 const byId=new Map(results.map(r=>[r.providerSourceId,r]));
 const reviewed=sources.map(s=>({...s,review:byId.get(s.providerSourceId)?.review??metadataReview()}));
 const next=candidates.map(c=>{const evidence=byId.get(c.sourceIds[0]);return {...c,...(evidence?.summary?{factualSummary:evidence.summary}:{}),...(evidence?.angle?{recommendedAngle:evidence.angle}:{}),uncertainty:[c.uncertainty,evidence?.review.limitations??'Only source metadata reviewed. Watch the original before reacting.'].filter(Boolean).join(' ').slice(0,1000)};});
 return {sources:z.array(researchSourceSchema).parse(reviewed),candidates:z.array(providerResearchCandidateSchema).parse(next)};
}
