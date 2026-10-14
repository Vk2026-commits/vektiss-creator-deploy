export type CostEvent={id:string;user_id:string;project_id:string|null;provider:string;operation:string;model:string|null;avatar:string|null;engine:string|null;voice:string|null;status:string;at:string;reported:number|null;estimate:number|null;seconds:number;bytes:number};
export type SharedCost={id:string;provider:string;amount_usd:number;period_start:string;period_end:string;basis:'invoice'|'estimate';note:string};
export type DashboardData={asOf:string;truncated:boolean;creators:{id:string;name:string}[];events:CostEvent[];shared:SharedCost[];researchJobs:{id:string;user_id:string;status:string;delivered:number}[]};
export function costTotals(events:CostEvent[]){
 return events.reduce((t,e)=>{t.reported+=Number(e.reported??0);t.estimated+=e.reported==null?Number(e.estimate??0):0;t.unknown+=e.reported==null&&e.estimate==null?1:0;t.attempts++;t.failed+=['failed','error','interrupted','uncertain','FAILED','ABORTED','TIMED-OUT'].includes(e.status)?1:0;return t;},{reported:0,estimated:0,unknown:0,attempts:0,failed:0});
}
export function groupedCosts(events:CostEvent[],key:(e:CostEvent)=>string){
 const groups=new Map<string,CostEvent[]>();for(const e of events){const k=key(e);groups.set(k,[...(groups.get(k)??[]),e]);}
 return [...groups].map(([name,rows])=>({name,...costTotals(rows)})).sort((a,b)=>(b.reported+b.estimated)-(a.reported+a.estimated));
}
export function allocatedShared(cost:SharedCost,from:string,to:string){
 const start=Date.parse(cost.period_start+'T00:00:00Z'),end=Date.parse(cost.period_end+'T00:00:00Z')+86400000;
 const overlap=Math.max(0,Math.min(end,Date.parse(to))-Math.max(start,Date.parse(from)));
 return Number(cost.amount_usd)*overlap/(end-start);
}
export function priceForMargin(cost:number,margin:number){return cost>=0&&margin>=0&&margin<100?cost/(1-margin/100):null;}
export function globalSpending(data:DashboardData,from:string,to:string){
 const usage=costTotals(data.events);
 const bills=data.shared.reduce((sum,bill)=>sum+allocatedShared(bill,from,to),0);
 return {recorded:usage.reported,estimated:usage.estimated,bills,total:usage.reported+usage.estimated+bills,missing:usage.unknown};
}
