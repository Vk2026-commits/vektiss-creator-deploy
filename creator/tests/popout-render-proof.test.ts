import {it,expect} from 'vitest';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mediaBinary} from '../server/media-binaries';
it.skipIf(!process.env.POPOUT_LOCAL_PROOF||!process.env.POPOUT_PROOF_SOURCE||!process.env.POPOUT_PROOF_MATTE)('renders the real cutout and word-timed graphics without any provider call',async()=>{
 const out=process.env.POPOUT_LOCAL_PROOF!;await mkdir(out,{recursive:true});
 const sourceFile=resolve(out,'source.mp4');
 await copyFile(process.env.POPOUT_PROOF_SOURCE!,sourceFile);
 await copyFile(process.env.POPOUT_PROOF_MATTE!,sourceFile+'.presenter-clean-v1.webm');
 const job={sourceFile,output:resolve(out,'proof.mp4'),preview:true,source:templateSampleSource,proposal:templateSample('popout-explainer'),brand:defaultEditBrand};
 await writeFile(resolve(out,'job.json'),JSON.stringify(job));
 execFileSync(process.execPath,['render/run.mjs',resolve(out,'job.json')],{timeout:240000,stdio:'pipe',env:process.env});
 const probe=JSON.parse(execFileSync(mediaBinary('ffprobe'),['-v','error','-show_format','-show_streams','-of','json',job.output],{encoding:'utf8'}));
 expect(probe.streams[0].width).toBe(540);expect(Number(probe.format.duration)).toBeCloseTo(5,1);
},300000);
