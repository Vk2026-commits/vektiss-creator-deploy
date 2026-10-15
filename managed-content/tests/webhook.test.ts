import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/stripe/webhook/route';

const stripe = new Stripe('rk_test_not_real', { apiVersion: '2026-09-30.endive' });
const secret = 'whsec_test_only';

function signedRequest(paymentLink: string, paid = true) {
  const event = {
    id: 'evt_test_1', object: 'event', type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', object: 'checkout.session', mode: 'subscription', payment_link: paymentLink, payment_status: paid ? 'paid' : 'unpaid', subscription: 'sub_test_1', customer_details: { email: 'buyer@example.com' } } },
  };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new NextRequest('http://localhost:3000/api/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } });
}

test('webhook refuses invalid signatures and ignores unrelated payment links', async () => {
  process.env.STRIPE_RESTRICTED_KEY = 'rk_test_not_real';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.STRIPE_PAYMENT_LINK_ID = 'plink_expected';
  const unsigned = new NextRequest('http://localhost:3000/api/stripe/webhook', { method: 'POST', body: '{}' });
  assert.equal((await POST(unsigned)).status, 400);
  assert.equal((await POST(signedRequest('plink_other'))).status, 200);
  assert.equal((await POST(signedRequest('plink_expected', false))).status, 200);
});
