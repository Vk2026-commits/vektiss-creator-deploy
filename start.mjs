import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';

// Supply this UUID through the hosting secret store, never the image or browser.
const key=process.env.CREATOR_COBALT_KEY;
if(!key||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/i.test(key)){
  throw new Error('A valid CREATOR_COBALT_KEY is required.');
}
if(!process.env.API_URL)throw new Error('API_URL is required.');
await writeFile('/tmp/creator-cobalt-keys.json',JSON.stringify({[key]:{name:'Creator server',limit:5,allowedServices:['tiktok','instagram','youtube']}}),{mode:0o600});
const env={...process.env,API_AUTH_REQUIRED:'1',API_KEY_URL:'file:///tmp/creator-cobalt-keys.json'};
delete env.CREATOR_COBALT_KEY;
const child=spawn(process.execPath,['src/cobalt.js'],{cwd:'/app',env,stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
child.on('error',()=>process.exit(1));
