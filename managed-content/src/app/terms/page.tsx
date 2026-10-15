import Link from 'next/link';

export const metadata = { title: 'Managed Content Terms | Vektiss' };

export default function TermsPage() {
  return <main className="legal-page"><div className="legal-wrap">
    <Link className="legal-back" href="/">← Back to Vektiss Managed Content</Link>
    <p className="eyebrow">MANAGED CONTENT · TERMS</p>
    <h1>Clear terms for your content subscription.</h1>
    <p className="legal-updated">Effective October 15, 2026 · Vektiss LLC</p>
    <section><h2>The service</h2><p>Vektiss Managed Content is a done-for-you subscription for 12 AI reaction videos per monthly subscription period. We research relevant topics, prepare scripts around your perspective, set up and use an approved AI presenter, and deliver finished vertical video files. One revision per video is included. Publishing to your social accounts, ad management, and guaranteed marketing results are not included.</p></section>
    <section><h2>Price and billing</h2><p>The price is $750 per month, charged by Stripe. Your subscription begins on the day you purchase and renews monthly until canceled. Your Stripe checkout displays the payment details before you pay.</p></section>
    <section><h2>What we need from you</h2><p>We need your business brief, relevant content direction, and any required approvals and authorized likeness or voice materials before production can be completed. Only provide materials you have the right to use. We will contact you about the secure way to provide presenter materials; do not email passwords or sensitive account credentials.</p></section>
    <section><h2>Delivery and revisions</h2><p>We deliver the 12 videos within 72 hours after we receive all required materials and approvals. The delivery clock does not begin simply because you purchased. One revision is included for each delivered video. Please send revision requests to <a href="mailto:info@vektiss.com">info@vektiss.com</a>.</p></section>
    <section><h2>Refunds and cancellation</h2><p>You may request a refund within the first seven days after purchase only if production has not begun. Production begins when our team first performs research or scripting work on your videos; we will email you when that work starts. After production begins, problems are handled through the included revision. To cancel, email <a href="mailto:info@vektiss.com">info@vektiss.com</a>. Cancellation stops the next renewal, and we finish the current paid subscription period. We confirm cancellation by email.</p></section>
    <section><h2>AI-generated output</h2><p>AI-presented video and voice may differ from a live recording. You should review the final files before publishing and confirm any factual, professional, or industry-specific claims appropriate to your use. We do not promise a particular number of views, followers, leads, or sales.</p></section>
    <section><h2>Privacy and contact</h2><p>Our <Link href="/privacy">Managed Content Privacy Notice</Link> explains how purchase, onboarding, and production information is handled. For support or questions about these terms, email <a href="mailto:info@vektiss.com">info@vektiss.com</a>.</p></section>
  </div></main>;
}
