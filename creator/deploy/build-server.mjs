import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const viteRequire=createRequire(require.resolve('vite/package.json'));
await viteRequire('esbuild').build({entryPoints:['server/hosted-entry.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'hosted.mjs'});
