import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const key=randomUUID();
const child=spawn(process.execPath,['/app/creator-start.mjs'],{
  env:{...process.env,CREATOR_COBALT_KEY:key,API_URL:'http://127.0.0.1:9000/'},stdio:'ignore',
});
try {
  let ready=false;
  for(let i=0;i<40;i++){
    await new Promise(resolve=>setTimeout(resolve,500));
    try {await fetch('http://127.0.0.1:9000/',{signal:AbortSignal.timeout(1500)});ready=true;break;}catch{}
  }
  assert(ready,'Importer must start');
  for(const authorized of [false,true]){
    const response=await fetch('http://127.0.0.1:9000/',{
      method:'POST',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json',Accept:'application/json',
        ...(authorized?{Authorization:`Api-Key ${key}`}:{})},
      body:JSON.stringify({url:'https://example.com/video'}),
    });
    const body=await response.json();
    if(!authorized){assert(!response.ok);assert.equal(body.error?.code,'error.api.auth.key.missing');}
    else {assert(body.error?.code);assert(!body.error.code.includes('auth'),'Valid key must pass authentication');}
    console.log(JSON.stringify({authorized,status:response.status,error:body.error?.code}));
  }
  console.log('Authentication smoke test passed.');
}finally{child.kill('SIGTERM');}
