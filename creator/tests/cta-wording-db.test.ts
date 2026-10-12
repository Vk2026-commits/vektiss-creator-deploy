import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('accepts historical CTA data and validates only supported optional wording settings',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../supabase/migrations/202610120001_cta_wording.sql',import.meta.url),'utf8'));
  const cta={text:'Comment AUDIT for my plan.',keyword:'AUDIT',offer:'My plan',delivery:'I send it.'};
  for(const [extra,expected] of [[{},true],[{wording:'natural'},true],[{wording:'exact'},true],[{wording:null},false],[{wording:'other'},false]] as const){
   const result=await db.query<{valid:boolean}>('select public.creator_valid_cta($1::jsonb) as valid',[JSON.stringify({...cta,...extra})]);
   expect(result.rows[0].valid).toBe(expected);
  }
 }finally{await db.close();}
});
