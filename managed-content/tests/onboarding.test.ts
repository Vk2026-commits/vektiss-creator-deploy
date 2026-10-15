import test from 'node:test';
import assert from 'node:assert/strict';
import { fulfillPurchase } from '../src/lib/onboarding';

function fakeServices(failEmail = false) {
  const values = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  let emails = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://api.resend.com/emails') {
      emails++;
      return Response.json(failEmail ? { error: 'temporary' } : { id: 'email-1' }, { status: failEmail ? 503 : 200 });
    }
    const { p_command: command, p_key: key, p_value: value, p_nx: nx } = JSON.parse(String(init?.body)) as { p_command: string; p_key: string; p_value: string; p_nx: boolean };
    let result: string | number | null = null;
    if (command === 'GET') result = values.get(key) ?? null;
    if (command === 'SET') { if (!nx || !values.has(key)) { values.set(key, value); result = 'OK'; } }
    if (command === 'DEL') { result = Number(values.delete(key)); }
    if (command === 'SADD') { const set = sets.get(key) ?? new Set<string>(); result = set.has(value) ? 0 : 1; set.add(value); sets.set(key, set); }
    return Response.json(result);
  };
  return { fetcher, values, sets, get emails() { return emails; } };
}

test('paid checkout onboarding is sent only once on replay', async () => {
  const oldFetch = global.fetch;
  const service = fakeServices();
  global.fetch = service.fetcher;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Vektiss <hello@example.com>';
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'support@example.com';
  try {
    const purchase = { sessionId: 'cs_123', subscriptionId: 'sub_123', email: 'buyer@example.com' };
    assert.equal(await fulfillPurchase(purchase), 'sent');
    assert.equal(await fulfillPurchase(purchase), 'already-sent');
    assert.equal(service.emails, 1);
    assert.equal([...service.sets.values()][0].size, 1);
  } finally { global.fetch = oldFetch; }
});

test('failed email leaves purchase retryable', async () => {
  const oldFetch = global.fetch;
  const service = fakeServices(true);
  global.fetch = service.fetcher;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'Vektiss <hello@example.com>';
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'support@example.com';
  try {
    await assert.rejects(fulfillPurchase({ sessionId: 'cs_456', subscriptionId: 'sub_456', email: 'buyer@example.com' }), /Resend returned 503/);
    assert.equal(service.values.has('managed:onboarding:sent:sub_456'), false);
    assert.equal(service.values.has('managed:onboarding:lock:sub_456'), false);
  } finally { global.fetch = oldFetch; }
});
