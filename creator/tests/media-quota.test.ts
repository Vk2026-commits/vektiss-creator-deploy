import {expect,it} from 'vitest';
import {mediaQuotaCount,mediaQuotaMessage} from '../server/media-quota';
it('isolates discovery inspections from video processing, including existing jobs',()=>{
 const jobs=[...Array.from({length:60},()=>({created:'2026-11-02T10:00:00Z',route:'/api/local-capture/discovery-review'})),{created:'2026-11-02T10:00:00Z',route:'/api/local-capture/video-import'},{created:'2026-11-01T10:00:00Z',route:'/api/local-capture/video-import'}];
 expect(mediaQuotaCount(jobs,'/api/local-capture/video-import','2026-11-02')).toBe(1);
 expect(mediaQuotaCount(jobs,'/api/local-capture/discovery-review','2026-11-02')).toBe(60);
 expect(mediaQuotaMessage('/api/local-capture/discovery-review')).toContain('Video creation remains available');
});
