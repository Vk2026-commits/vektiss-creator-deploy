import {expect,it} from 'vitest';
import {prepareMcpDraft,mcpDraftPatch,mcpProjectLink} from '../src/domain/mcp-draft';
import {isConnectorToken} from '../supabase/functions/_shared/oauth-guard';
import {emptyBrief} from '../src/domain/script-brief';
import {newVideoPlan} from '../src/domain/video-plan';
it('prepares a Studio ranking with language and no approvals',()=>{
 const d=prepareMcpDraft(undefined,{title:'Safety',topic:'Habits',template:'tier-list',language_level:'simple',items:[{label:'Notice exits',rating:'S'}]},'profile');
 expect(d.brief.avatar_creation?.approved).toBe(false);expect(d.brief.avatar_creation?.items[0].label).toBe('Notice exits');expect(d.brief.production?.approved_at).toBeNull();expect(d.brief.mcp_review_pending).toBe(true);expect(d.brief.production?.render).toBeUndefined();expect(d.brief.language_level).toBe('simple');
});
it('preserves reaction source and workflow when revising a script',()=>{
 const old={title:'Source',content_profile_id:'p',hook:'Opening',body:'Old',cta:'Comment build',brief:{...emptyBrief(),url:'https://example.com',source:'Qualified source',production:{...newVideoPlan(),approved_at:'today'}}};
 const next=prepareMcpDraft(old,{body:'New'},'p');expect(next.brief.avatar_creation).toBeUndefined();expect(next.brief.url).toBe(old.brief.url);expect(next.brief.source).toBe(old.brief.source);expect(next.cta).toBe(old.cta);expect(next.brief.production?.approved_at).toBeNull();expect(old.brief.production.approved_at).toBe('today');
});
it('cannot accept approvals, render IDs, credentials or code in patches',()=>{
 for(const key of ['approved_at','approved','render','user_id','code','provider_key'])expect(mcpDraftPatch.safeParse({[key]:'x'}).success).toBe(false);
});
it('cannot overwrite a project with existing paid render',()=>{
 const old=prepareMcpDraft(undefined,{},'p');old.brief.production!.render={job_id:'j',status:'pending',submitted_at:'now',updated_at:'now'};
 expect(()=>prepareMcpDraft(old,{body:'new'},'p')).toThrow(/render/);
});
it('rejects connector tokens at normal paid endpoints',()=>{
 const token=(claims:unknown)=>'x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.x';
 expect(isConnectorToken('Bearer '+token({client_id:'c',role:'authenticated'}))).toBe(true);expect(isConnectorToken(token({role:'creator_mcp'}))).toBe(true);expect(isConnectorToken(token({role:'authenticated'}))).toBe(false);
});
it('returns same-origin project deep links',()=>expect(mcpProjectLink('https://creator.vektiss.com','abc')).toBe('https://creator.vektiss.com/?project=abc'));
