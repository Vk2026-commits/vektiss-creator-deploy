import {it,expect} from 'vitest';
import {backgroundFilter,backgroundFramingSchema,backgroundImageStyle,fillBackground} from '../src/domain/background-framing';
import {videoPlanSchema,newVideoPlan} from '../src/domain/video-plan';
it('preserves old fit behavior and saves explicit framing',()=>{
 expect(backgroundFilter(720,1280)).toContain('force_original_aspect_ratio=decrease');
 expect(backgroundImageStyle().objectFit).toBe('contain');
 expect(videoPlanSchema.parse(newVideoPlan()).background_framing).toBeUndefined();
 expect(videoPlanSchema.parse({...newVideoPlan(),background_framing:fillBackground}).background_framing).toEqual(fillBackground);
});
it('fills without stretching, with matching normalized zoom and position',()=>{
 const frame={...fillBackground,zoom:2,x:.25,y:.75};
 expect(backgroundImageStyle(frame)).toMatchObject({objectFit:'cover',width:'200%',height:'200%',left:'-25%',top:'-75%',objectPosition:'25% 75%'});
 expect(backgroundFilter(720,1280,frame)).toContain('force_original_aspect_ratio=increase');
 expect(backgroundFilter(720,1280,frame)).toContain('crop=720:1280:(iw-ow)*0.25:(ih-oh)*0.75');
});
it('rejects out-of-range and injected composition input',()=>{
 for(const patch of [{zoom:0},{zoom:4},{x:-1},{y:2},{mode:'stretch'},{zoom:'2,evil'}])expect(backgroundFramingSchema.safeParse({...fillBackground,...patch}).success).toBe(false);
});
