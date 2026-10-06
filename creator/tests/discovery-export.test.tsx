import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinishedVideo} from '../src/components/FinishedVideo';
import {newVideoPlan} from '../src/domain/video-plan';
import {fullCompositionSchema} from '../server/full-composition';
const command={job_id:'00000000-0000-4000-8000-000000000001',script_id:'00000000-0000-4000-8000-000000000002',position:'bottom-center',format:'portrait',size:70};
it('requires a background or explicit presenter-only assembly, never ambiguous input',()=>{
 expect(fullCompositionSchema.safeParse(command).success).toBe(false);
 expect(fullCompositionSchema.safeParse({...command,presenter_only:true}).success).toBe(true);
 expect(fullCompositionSchema.safeParse({...command,presenter_only:true,video_id:command.job_id}).success).toBe(false);
 expect(fullCompositionSchema.safeParse({...command,presenter_only:true,capture_id:command.job_id}).success).toBe(false);
});
it('does not pass a missing video background through as a raw presenter download',()=>{
 const html=renderToStaticMarkup(<FinishedVideo jobId={command.job_id} scriptId={command.script_id} sourceKind="video" plan={newVideoPlan()} rawVideoUrl="https://example.com/raw.webm"/>);
 expect(html).toContain('attach your background');
 expect(html).not.toContain('Download MP4');
 expect(html).not.toContain('raw.webm');
});
