import {expect,it} from 'vitest';
import {closingPreview} from '../src/domain/voice-excerpt';

it('previews the transition into the complete CTA rather than the opening hook',()=>{
 const script={hook:'Would you notice this?',body:'Create some distance. Move toward people who can help.',cta:'Comment SAFETY for the guide. Stay alert. Stay safe.'};
 expect(closingPreview(script)).toBe('Move toward people who can help.\n\nComment SAFETY for the guide. Stay alert. Stay safe.');
});

it('never cuts a final sentence to fit the voice-test limit',()=>{
 const cta='A'.repeat(1201)+'. Finish here.';
 expect(closingPreview({hook:'Opening.',body:'Context.',cta})).toBe('Finish here.');
});
