import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PasswordSetup} from '../src/App';
it('requires confirmed masked passwords with password-manager support',()=>{
 const html=renderToStaticMarkup(<PasswordSetup onDone={()=>{}}/>);
 expect(html.match(/type="password"/g)).toHaveLength(2);
 expect(html.match(/autoComplete="new-password"/g)).toHaveLength(2);
 expect(html.match(/minLength="12"/g)).toHaveLength(2);
 expect(html).toContain('Confirm password');
});
