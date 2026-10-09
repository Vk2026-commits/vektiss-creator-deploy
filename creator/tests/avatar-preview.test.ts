import {expect,it} from 'vitest';
import {avatarPreviewCutout} from '../src/domain/avatar-preview';
import {avatarFraming,STEPHEN_AVATAR} from '../src/domain/avatar-framing';
const rose='a1d861d5-215f-4789-92c2-8a16f62f47c0';
const thumbnail='https://files2.heygen.ai/avatar/v3/91182ae2e1cd4a47a5f2b9e9e0b56084/half/2.2/preview_target.webp';
it('uses Rose cutout only for the verified saved look and thumbnail',()=>{
 expect(avatarPreviewCutout(rose,thumbnail)?.url).toBe('/brand/rose-preview-cutout-v1.png');
 expect(avatarPreviewCutout(rose,'https://example.com/new-look.webp')).toBeNull();
 expect(avatarPreviewCutout('other',thumbnail)).toBeNull();
 expect(avatarPreviewCutout(rose,null)).toBeNull();
});
it('does not change provider framing or Stephen’s existing crop',()=>{
 expect(avatarFraming(rose,'portrait')).toBeUndefined();
 expect(avatarFraming(STEPHEN_AVATAR,'portrait')).toBe('stephen-portrait-v1');
});
