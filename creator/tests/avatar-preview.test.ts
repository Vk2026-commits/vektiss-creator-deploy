import {expect,it} from 'vitest';
import {avatarPreviewCutout} from '../src/domain/avatar-preview';
import {avatarFraming,STEPHEN_AVATAR} from '../src/domain/avatar-framing';
const rose='a1d861d5-215f-4789-92c2-8a16f62f47c0';
const thumbnail='https://files2.heygen.ai/avatar/v3/91182ae2e1cd4a47a5f2b9e9e0b56084/half/2.2/preview_target.webp';
it('never substitutes a retouched still for Rose’s actual video cutout',()=>{
 expect(avatarPreviewCutout(rose,thumbnail)).toBeNull();
 expect(avatarPreviewCutout(rose,'https://example.com/new-look.webp')).toBeNull();
 expect(avatarPreviewCutout('other',thumbnail)).toBeNull();
 expect(avatarPreviewCutout(rose,null)).toBeNull();
});
it('does not change provider framing or Stephen’s existing crop',()=>{
 expect(avatarFraming(rose,'portrait')).toBeUndefined();
 expect(avatarFraming(STEPHEN_AVATAR,'portrait')).toBe('stephen-portrait-v1');
});
it('uses requested Rose Practice artwork only for the matching source thumbnail',()=>{
 const id='cebd8766-07ee-44eb-a914-88ba31733319';
 const source='https://files2.heygen.ai/talking_photo/9b0cb20813cc48cfa09c17368f69eec6/152377e920d5486495fa7b8801d677cc.WEBP?signature=renewed';
 expect(avatarPreviewCutout(id,source)?.url).toBe('/brand/rose-practice-preview-v1.png');
 expect(avatarPreviewCutout(id,null)).toBeNull();
 expect(avatarPreviewCutout(rose,source)).toBeNull();
 expect(avatarPreviewCutout(id,source.replace('files2.heygen.ai','example.com'))).toBeNull();
 expect(avatarFraming(id,'portrait')).toBeUndefined();
});
