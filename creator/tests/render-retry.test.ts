import {it,expect} from 'vitest';
import {testCommand} from '../supabase/functions/_shared/presenter-test';
import {readFileSync} from 'node:fs';
it('requires explicit paid consent for retry',()=>{const input={action:'start_test',script_id:crypto.randomUUID(),revision:'revision',scope:'full',retry_of:crypto.randomUUID()};expect(testCommand.safeParse(input).success).toBe(false);expect(testCommand.safeParse({...input,paid_consent:true}).success).toBe(true);});
it('guards retries by failed status and retains unique reservation protection',()=>{const service=readFileSync('supabase/functions/_shared/presenter-test-service.ts','utf8');expect(service).toContain("prior.data.status!=='failed'");expect(service).toContain(".eq('status','failed').eq('revision',revision)");expect(service).toContain("if(reserved.error)throw new PublicError('EXISTS'");});
it('removes verbose preview paragraphs',()=>{const source=readFileSync('src/components/VideoBackground.tsx','utf8');expect(source).not.toContain('Layout preview');expect(source).not.toContain('First: original clip');});
