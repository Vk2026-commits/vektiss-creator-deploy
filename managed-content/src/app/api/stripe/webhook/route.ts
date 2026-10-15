import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { fulfillPurchase } from '@/lib/onboarding';
import { redis, recordMetric } from '@/lib/redis';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_RESTRICTED_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const paymentLinkId = process.env.STRIPE_PAYMENT_LINK_ID;
  if (!key || !secret || !paymentLinkId) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(key, { apiVersion: '2026-09-30.endive' });
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription' || session.payment_link !== paymentLinkId) return NextResponse.json({ received: true });
      if (session.payment_status !== 'paid') return NextResponse.json({ received: true, awaitingPayment: true });
      const email = session.customer_details?.email || session.customer_email;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!email || !subscriptionId) throw new Error('Paid checkout is missing email or subscription');
      await redis(['SET', `managed:subscription:${subscriptionId}:managed`, session.id]);
      await fulfillPurchase({ sessionId: session.id, subscriptionId, email });
    }
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      if (await redis(['GET', `managed:subscription:${subscription.id}:managed`])) await redis(['SET', `managed:subscription:${subscription.id}:status`, subscription.status]);
    }
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const linked = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof linked === 'string' ? linked : linked?.id;
      if (subscriptionId && await redis(['GET', `managed:subscription:${subscriptionId}:managed`])) {
        const keyName = `managed:invoice:event:${event.type}:${invoice.id}`;
        if (await redis(['SET', keyName, event.id, 'NX']) === 'OK') await recordMetric(event.type.replaceAll('.', '_'));
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Managed Content webhook processing failed', { eventId: event.id, type: event.type, reason: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Webhook processing failed; retry required' }, { status: 500 });
  }
}
