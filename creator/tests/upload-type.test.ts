import {expect,it} from 'vitest';
import {sourceUploadType} from '../src/domain/upload-type';
it.each(['','application/octet-stream','video/quicktime','video/x-m4v'])('accepts an uppercase MP4 with mobile MIME %s',type=>{
 expect(sourceUploadType({name:'miss.chievousss_TikTokDownloader.com_f5c53 2.MP4',type})).toBe('video/mp4');
});
it('retains supported MIME and normalizes image extensions',()=>{
 expect(sourceUploadType({name:'upload',type:'video/mp4'})).toBe('video/mp4');
 expect(sourceUploadType({name:'photo.JPEG',type:''})).toBe('image/jpeg');
 expect(sourceUploadType({name:'clip.WebM',type:''})).toBe('video/webm');
});
it('rejects unsupported formats and disguised suffixes',()=>{
 for(const name of ['movie.mov','file','video.mp4.exe','page.html'])expect(sourceUploadType({name,type:'application/octet-stream'})).toBeNull();
});
