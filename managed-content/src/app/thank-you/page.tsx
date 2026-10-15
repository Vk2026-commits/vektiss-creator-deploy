import type { Metadata } from 'next';
import Link from 'next/link';
import { supportEmail } from '@/lib/site';

export const metadata: Metadata = { title: 'Thank you | Vektiss Managed Content', robots: { index: false, follow: false } };

export default function ThankYouPage() {
  return <main className="thank-you"><div className="thank-you-card"><p className="eyebrow">VEKTISS MANAGED CONTENT</p><div className="thank-you-mark" aria-hidden="true">✦</div><h1>Welcome to Vektiss Managed Content.</h1><p>Thanks for taking the next step. After Stripe confirms your subscription, we&apos;ll email instructions for sharing your business details, approved avatar materials, and content preferences.</p><p className="thank-you-note">This page alone does not confirm a payment. Please check your Stripe receipt and onboarding email. If you do not see them, check spam or contact support.</p><div className="thank-you-actions"><Link className="button" href="/">Back to the site <span aria-hidden="true">↗</span></Link>{supportEmail&&<a className="text-link" href={`mailto:${supportEmail}`}>Contact support</a>}</div></div></main>;
}
