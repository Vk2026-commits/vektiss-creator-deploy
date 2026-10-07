import {expect,it} from 'vitest';
import {z} from 'zod';
import {normalizeGraphicText} from '../src/domain/graphic-text';
it('keeps a full-length multiline excerpt valid after multipart encoding',()=>{
 const original='a\n'.repeat(1000);
 const encoded=original.replace(/\n/g,'\r\n');
 expect(z.string().max(2000).parse(normalizeGraphicText(encoded))).toBe(original);
});
it('does not relax the text limit or coerce other values',()=>{
 expect(z.string().max(2000).safeParse(normalizeGraphicText('a'.repeat(2001))).success).toBe(false);
 expect(normalizeGraphicText(null)).toBe(null);
});
