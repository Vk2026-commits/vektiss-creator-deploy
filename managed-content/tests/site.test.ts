import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { samples, safeCheckoutUrl } from '../src/lib/site';

test('all three supplied samples and actual-frame posters are present', () => {
  assert.equal(samples.length, 3);
  for (const sample of samples) {
    const video = `public${sample.src}`;
    const poster = `public${sample.poster}`;
    assert.ok(existsSync(video), video);
    assert.ok(existsSync(poster), poster);
    assert.ok(statSync(video).size > 100_000);
  }
  assert.match(samples[2].label, /SOURCE CLIP/);
});

test('checkout fails closed without a valid Stripe URL', () => {
  assert.equal(safeCheckoutUrl(), null);
});
