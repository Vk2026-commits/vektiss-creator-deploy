// Local operator tool, not an HTTP endpoint. Input is an existing validated render job.
import {readFile,writeFile,copyFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {hyperframesProject} from '../server/hyperframes-project.ts';
const [jobFile,destination]=process.argv.slice(2);
if(!jobFile||!destination)throw Error('Usage: node render/export-hyperframes.mjs JOB.json NEW_PROJECT_DIRECTORY');
const job=JSON.parse(await readFile(jobFile,'utf8'));
const html=hyperframesProject(job.source,job.proposal,job.brand);
const sourceFile=await realpath(job.sourceFile);
const directory=path.resolve(destination);
// Never overwrite an existing project or modify original footage.
await mkdir(directory,{recursive:false,mode:0o700});
await copyFile(sourceFile,path.join(directory,'source.mp4'));
await writeFile(path.join(directory,'index.html'),html,{flag:'wx',mode:0o600});
console.log(directory);
