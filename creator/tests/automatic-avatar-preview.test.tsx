import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
it('keeps clean thumbnail requests separate from verified video previews and paid actions',()=>{
 const source=readFileSync(new URL('../src/components/SelectedAvatarOverlay.tsx',import.meta.url),'utf8');
 expect(source).toContain('/avatar-thumbnail/');
 expect(source).toContain('/avatar-preview/');
 expect(source).toContain('Placement preview · video not verified');
 expect(source).toContain('Retry preview');
 expect(source).not.toContain('start_test');
 expect(source).not.toContain('verify_avatar_test');
 expect(source).not.toContain('avatarPreviewCutout');
 expect(source).toContain('controller.abort()');
 expect(source).toContain('URL.revokeObjectURL');
});
