import {loadEnv} from 'vite';
import {spawnSync} from 'node:child_process';
const env=loadEnv('production',process.cwd(),'VITE_');
const result=spawnSync('/Applications/Docker.app/Contents/Resources/bin/docker',['build','--platform=linux/amd64','-f','deploy/creator.Dockerfile','--build-arg',`VITE_SUPABASE_URL=${env.VITE_SUPABASE_URL}`,'--build-arg',`VITE_SUPABASE_PUBLISHABLE_KEY=${env.VITE_SUPABASE_PUBLISHABLE_KEY}`,'-t','ghcr.io/vk2026-commits/vektiss-creator:pilot','.'],{stdio:'inherit'});
process.exit(result.status??1);
