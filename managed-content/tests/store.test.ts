import test from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/lib/store';

test('managed storage sends server-only RPC arguments, including NX and expiry', async () => {
  const previous = global.fetch;
  const calls: unknown[] = [];
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  global.fetch = async (input, init) => {
    assert.equal(String(input), 'https://example.supabase.co/rest/v1/rpc/managed_content_store');
    assert.equal((init?.headers as Record<string, string>).apikey, 'test-secret');
    calls.push(JSON.parse(String(init?.body)));
    return Response.json('OK');
  };
  try {
    assert.equal(await store(['SET', 'managed:onboarding:lock:test', 'session', 'NX', 'EX', 120]), 'OK');
    assert.deepEqual(calls[0], {
      p_command: 'SET', p_key: 'managed:onboarding:lock:test', p_value: 'session', p_nx: true, p_ttl_seconds: 120,
    });
    await assert.rejects(store(['GET', 'creator:private']), /Invalid managed storage command/);
    assert.equal(calls.length, 1);
  } finally { global.fetch = previous; }
});

test('managed storage treats RPC failures as retryable errors', async () => {
  const previous = global.fetch;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  global.fetch = async () => new Response('unavailable', { status: 503 });
  try { await assert.rejects(store(['GET', 'managed:onboarding:sent:test']), /storage returned 503/); }
  finally { global.fetch = previous; }
});
