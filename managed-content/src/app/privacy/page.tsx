import Link from 'next/link';

export const metadata = { title: 'Managed Content Privacy | Vektiss' };

export default function PrivacyPage() {
  return <main className="legal-page"><div className="legal-wrap">
    <Link className="legal-back" href="/">← Back to Vektiss Managed Content</Link>
    <p className="eyebrow">MANAGED CONTENT · PRIVACY</p>
    <h1>How your information supports your videos.</h1>
    <p className="legal-updated">Effective October 15, 2026 · Vektiss LLC</p>
    <section><h2>What we collect</h2><p>When you visit this site, we may record basic page-view and sample-play activity, checkout clicks, and technical information needed to operate and protect the site. If you subscribe, Stripe provides us with your purchase status, email address, and subscription identifiers; Vektiss does not collect card numbers on this site. During onboarding and production, we may receive the business information, instructions, images, video, voice, likeness materials, and feedback you choose to provide.</p></section>
    <section><h2>How we use it</h2><p>We use this information to operate the site, confirm purchases, send onboarding and service email, research and produce your videos, support revisions, manage your subscription, and improve the service. We use likeness and voice materials for the managed-content work you authorize, not for automatic public posting. We will explain the materials and permissions needed during onboarding.</p></section>
    <section><h2>Service providers</h2><p>Stripe processes checkout and subscription payments. Resend sends service email. Supabase stores limited purchase, delivery, and site-activity records used to prevent duplicate onboarding and measure the site. Vercel hosts this website. Approved AI and video-production providers may process the materials needed to create your videos. These providers act in support of the service, not to receive your information for their own marketing. The providers used for a particular production workflow can be discussed during onboarding.</p></section>
    <section><h2>Sharing and retention</h2><p>We do not sell your personal information. Access is limited to the Vektiss team and service providers needed to deliver the service. We retain information as needed to perform the subscription, handle support, maintain records, and meet legal obligations; retention can differ by record and provider. Contact us if you want to request access, correction, or deletion, and we will respond subject to applicable obligations.</p></section>
    <section><h2>Your choices</h2><p>You can choose whether to play the sample videos or subscribe. Required service emails, such as onboarding and production notices, support the subscription. You may request cancellation by emailing us. You can also ask us about your information or authorized presenter materials at <a href="mailto:info@vektiss.com">info@vektiss.com</a>.</p></section>
    <section><h2>More information</h2><p>This notice supplements the <a href="https://vektiss.com/privacy">Vektiss Privacy Policy</a> for this managed-content service. See the <Link href="/terms">Managed Content Terms</Link> for billing and delivery details. The service is not intended for people under 18.</p></section>
  </div></main>;
}
