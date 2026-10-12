import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ctaSchema,ctaInstruction,finalizeCta,type CTASelection} from '../src/domain/cta';
import {CtaWording} from '../src/components/CtaWording';
const cta={text:'I want viewers to discover leverage. Invite them to comment AUDIT for a free personalized AI Business Opportunity Plan.',keyword:'AUDIT',offer:'Free personalized AI Business Opportunity Plan',delivery:'Send an assessment link; they complete it and receive their plan.'};
describe('natural CTA endings',()=>{
 it.each(['default','campaign','video'] as const)('adapts legacy %s selections instead of reading instructions',scope=>{
  const selected:CTASelection={scope,campaign_id:null,cta:ctaSchema.parse(cta)};
  const spoken='Comment AUDIT and I’ll send you an assessment link for your free personalized AI Business Opportunity Plan.';
  expect(finalizeCta(spoken,selected)).toBe(spoken);
  expect(ctaInstruction(selected)).toContain('specific problem discussed');
 });
 it.each(['save time on admin','reduce manual content work','improve your customer follow-up'])('accepts a relevant invitation about %s',benefit=>{
  const spoken=`Comment AUDIT and I’ll send you a free personalized AI Business Opportunity Plan to help you ${benefit}.`;
  expect(finalizeCta(spoken,{scope:'default',campaign_id:null,cta})).toBe(spoken);
 });
 it.each(['I want viewers to comment AUDIT.','Invite them to comment AUDIT.','Ask viewers to comment AUDIT.','Comment GUIDE for a plan.',''])('rejects invalid generated ending: %s',spoken=>{
  expect(()=>finalizeCta(spoken,{scope:'default',campaign_id:null,cta})).toThrow('SCRIPT_STYLE');
 });
 it('preserves explicitly locked wording exactly, regardless of model output',()=>{
  const exact={...cta,text:'Comment AUDIT for my plan.',wording:'exact' as const};
  expect(finalizeCta('Something else',{scope:'video',campaign_id:null,cta:exact})).toBe(exact.text);
  expect(ctaInstruction({scope:'video',campaign_id:null,cta:exact})).toContain('CTA OVERRIDE');
 });
 it('does not require a keyword for a follow invitation',()=>{
  expect(finalizeCta('Follow for more practical tips.',{scope:'default',campaign_id:null,cta:{...cta,keyword:''}})).toBe('Follow for more practical tips.');
 });
 it('rejects unknown wording while accepting legacy CTA fields',()=>{
  expect(ctaSchema.safeParse(cta).success).toBe(true);
  expect(ctaSchema.safeParse({...cta,wording:'invent'}).success).toBe(false);
 });
 it('labels a default natural control and the exact wording choice',()=>{
  const html=renderToStaticMarkup(<CtaWording value={undefined} onChange={()=>{}}/>);
  expect(html).toContain('CTA wording');expect(html).toContain('value="natural" selected');expect(html).toContain('Use exact wording');
 });
});
