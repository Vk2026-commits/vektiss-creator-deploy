// Local synthetic fixture; no paid provider requests or customer media.
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const folder=await mkdtemp(resolve(tmpdir(),'creator-edit-qa-'));
const ffmpeg=resolve(homedir(),'.codex/skills/video-use/bin/ffmpeg');
const sourceFile=resolve(folder,'source.mp4'),output=resolve(folder,'preview.mp4');
execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','color=c=0x20384e:s=540x960:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',sourceFile]);
const source={duration:3,words:[{start:0,end:.5,text:'Turn'},{start:.5,end:1,text:'problems'},{start:1,end:1.5,text:'into'},{start:1.5,end:2.5,text:'value.'}]};
const proposal={templateId:'premium-explainer',beats:[{firstWord:0,lastWord:3,visual:'diagram',headline:'Solve a problem. Create value.',graphics:{nodes:[{label:'Customer problem',shape:'box',x:25,y:50},{label:'Useful solution',shape:'circle',x:75,y:50}],links:[{from:0,to:1}]}}]};
for(const templateId of ['premium-explainer','tier-list','walkthrough']){
 const current=structuredClone(proposal);current.templateId=templateId;
 if(templateId==='tier-list'){current.beats[0].visual='tier-board';current.beats[0].graphics.nodes.forEach((n,i)=>{n.tier=i?'A':'B';});}
 const rendered=resolve(folder,`${templateId}.mp4`),job=resolve(folder,`${templateId}.json`);
 await writeFile(job,JSON.stringify({sourceFile,output:rendered,preview:true,source,proposal:current}));
 execFileSync(process.execPath,['render/run.mjs',job],{stdio:'inherit',timeout:240000});
 execFileSync(ffmpeg,['-v','error','-ss','1','-i',rendered,'-frames:v','1',resolve(folder,`${templateId}.png`)]);
}
console.log(folder);
