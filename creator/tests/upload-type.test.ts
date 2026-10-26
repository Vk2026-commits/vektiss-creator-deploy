import {expect,it} from 'vitest';
import {sourceUploadType,editVideoUploadType} from '../src/domain/upload-type';
it.each(['','application/octet-stream','video/quicktime','video/x-m4v'])('accepts an uppercase MP4 with mobile MIME %s',type=>{
 expect(sourceUploadType({name:'miss.chievousss_TikTokDownloader.com_f5c53 2.MP4',type})).toBe('video/mp4');
});
it.each(['','application/octet-stream','video/quicktime','video/x-m4v'])('normalizes Edit Studio MP4 uploads with mobile MIME %s',type=>{
 expect(editVideoUploadType({name:'recording.MP4',type})).toBe('video/mp4');
});
it('restricts Edit Studio uploads to video and explains unsupported recordings',()=>{
 expect(editVideoUploadType({name:'clip.webm',type:''})).toBe('video/webm');
 for(const file of [{name:'photo.png',type:'image/png'},{name:'recording.MOV',type:'video/quicktime'},{name:'clip.mp4.exe',type:''}])expect(()=>editVideoUploadType(file)).toThrow('Choose an MP4 or WebM video');
});
it('retains supported MIME and normalizes image extensions',()=>{
 expect(sourceUploadType({name:'upload',type:'video/mp4'})).toBe('video/mp4');
 expect(sourceUploadType({name:'photo.JPEG',type:''})).toBe('image/jpeg');
 expect(sourceUploadType({name:'clip.WebM',type:''})).toBe('video/webm');
});
it('rejects unsupported formats and disguised suffixes',()=>{
 for(const name of ['movie.mov','file','video.mp4.exe','page.html'])expect(sourceUploadType({name,type:'application/octet-stream'})).toBeNull();
});
