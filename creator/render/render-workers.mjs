import {availableParallelism,freemem} from 'node:os';
import {readFileSync} from 'node:fs';
function limit(path){try{return readFileSync(path,'utf8').trim();}catch{return '';}}
/** Keep expensive matte templates and quick previews on one browser. */
export function rankingRenderWorkers(job,limits={}){
 if(job.preview||job.proposal?.templateId!=='tier-list')return 1;
 const requested=limits.requested??process.env.CREATOR_RANKING_RENDER_WORKERS;
 if(requested==='1')return 1;
 const cores=limits.cores??availableParallelism();
 const memory=limits.memory??freemem();
 const cpuMax=limits.cpuMax??limit('/sys/fs/cgroup/cpu.max');
 const memoryMax=limits.memoryMax??limit('/sys/fs/cgroup/memory.max');
 const memoryUsed=limits.memoryUsed??limit('/sys/fs/cgroup/memory.current');
 const [quota,period]=cpuMax.split(' ').map(Number);
 if(cores<2||memory<1024**3||(quota>0&&period>0&&quota/period<2))return 1;
 if(Number(memoryMax)>0&&Number(memoryMax)-Number(memoryUsed)<1024**3)return 1;
 return 2;
}
