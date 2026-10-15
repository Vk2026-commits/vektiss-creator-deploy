import { store } from './store';

export interface Purchase {
  sessionId: string;
  subscriptionId: string;
  email: string;
}

function emailHtml() {
  return `<div style="font-family:Arial,sans-serif;max-width:590px;margin:auto;color:#10203a;line-height:1.6"><div style="background:#07152b;color:#fff;padding:22px 27px;font-weight:800;letter-spacing:.08em">VEKTISS MANAGED CONTENT</div><div style="padding:30px 26px"><h1 style="font-size:28px;line-height:1.15">Welcome to Vektiss Managed Content.</h1><p>Your subscription is confirmed. We&apos;re excited to start making content around your expertise.</p><p>Reply to this email with your business name, website or social links, your audience, and the topics you want to cover or avoid. We&apos;ll follow up with a secure way to provide approved avatar and voice materials and explain the content review process.</p><p>Please do not email passwords or sensitive account credentials.</p><p style="margin-top:28px">Your expertise. Our production.</p></div></div>`;
}

export async function sendOnboardingEmail(purchase: Purchase) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  if (!apiKey || !from || !replyTo) throw new Error('Onboarding email is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `vektiss-managed-onboarding-${purchase.subscriptionId}` },
    body: JSON.stringify({ from, to: [purchase.email], reply_to: replyTo, subject: 'Welcome to Vektiss Managed Content — your next steps', html: emailHtml() }),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
}

export async function fulfillPurchase(purchase: Purchase) {
  const completedKey = `managed:onboarding:sent:${purchase.subscriptionId}`;
  const lockKey = `managed:onboarding:lock:${purchase.subscriptionId}`;
  const recordPurchase = () => store(['SADD', `managed:verified-purchases:${new Date().toISOString().slice(0, 10)}`, purchase.subscriptionId]);
  if (await store(['GET', completedKey])) { await recordPurchase(); return 'already-sent'; }
  const lock = await store(['SET', lockKey, purchase.sessionId, 'NX', 'EX', 120]);
  if (lock !== 'OK') {
    // Returning a non-2xx lets Stripe retry if an in-flight handler later fails.
    throw new Error('Onboarding delivery is in progress');
  }
  try {
    if (await store(['GET', completedKey])) { await recordPurchase(); return 'already-sent'; }
    await sendOnboardingEmail(purchase);
    await store(['SET', completedKey, purchase.sessionId]);
    await recordPurchase();
    return 'sent';
  } finally {
    // The lock is short lived even if this cleanup fails.
    await store(['DEL', lockKey]).catch(() => undefined);
  }
}
