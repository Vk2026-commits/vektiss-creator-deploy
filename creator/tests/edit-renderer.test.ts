import {it,expect} from 'vitest';
import {editRenderer} from '../src/domain/edit-renderer';
it('routes portrait Pop-out to the reference composition while preserving wide and other styles',()=>{
 expect(editRenderer('popout-explainer')).toBe('reference-remotion');
 expect(editRenderer('popout-explainer','9:16')).toBe('reference-remotion');
 expect(editRenderer('popout-explainer','16:9')).toBe('hyperframes');
 expect(editRenderer('glass-cards','9:16')).toBe('hyperframes');
 expect(editRenderer('premium-explainer')).toBe('remotion');
});
