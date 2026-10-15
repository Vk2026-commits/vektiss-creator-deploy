import type { NextConfig } from 'next';

const requiredForLaunch = [
  'NEXT_PUBLIC_CHECKOUT_URL',
  'NEXT_PUBLIC_CHECKOUT_RECURRING_CONFIRMED',
  'NEXT_PUBLIC_TERMS_URL',
  'NEXT_PUBLIC_PRIVACY_URL',
  'NEXT_PUBLIC_SUPPORT_EMAIL',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PAYMENT_LINK_ID',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'METRICS_SALT',
];

if (process.env.VERCEL_ENV === 'production') {
  const missing = requiredForLaunch.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Managed Content production configuration missing: ${missing.join(', ')}`);
  const checkout = process.env.NEXT_PUBLIC_CHECKOUT_URL!;
  if (!/^https:\/\/(?:buy|checkout)\.stripe\.com\//.test(checkout)) {
    throw new Error('NEXT_PUBLIC_CHECKOUT_URL must be a real HTTPS Stripe checkout/payment link.');
  }
  if (process.env.NEXT_PUBLIC_CHECKOUT_RECURRING_CONFIRMED !== 'true') {
    throw new Error('The configured Stripe Payment Link must be verified as a $750/month subscription before production launch.');
  }
  for (const name of ['NEXT_PUBLIC_TERMS_URL', 'NEXT_PUBLIC_PRIVACY_URL']) {
    if (!/^https:\/\//.test(process.env[name]!)) throw new Error(`${name} must be an HTTPS link.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.NEXT_PUBLIC_SUPPORT_EMAIL!)) throw new Error('NEXT_PUBLIC_SUPPORT_EMAIL must be a valid email address.');
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }];
  },
};

export default nextConfig;
