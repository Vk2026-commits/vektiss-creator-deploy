import { CheckoutButton } from '@/components/CheckoutButton';
import { SampleGallery } from '@/components/SampleGallery';
import { PageTracker } from '@/components/Track';
import { privacyUrl, safeCheckoutUrl, supportEmail, termsUrl } from '@/lib/site';

const checkout = safeCheckoutUrl();
const features = [
  ['01', '12 finished videos', 'A consistent stream of vertical, reaction-based videos designed for your audience.'],
  ['02', 'Research with a point of view', 'We find relevant conversations and opportunities worth responding to—not just trending noise.'],
  ['03', 'Scripts shaped around you', 'Natural commentary built from your expertise, perspective, and preferred way of speaking.'],
  ['04', 'AI presenter setup', 'We guide the initial avatar setup using materials and permissions you approve.'],
  ['05', 'Production & editing', 'We assemble the reaction, presenter, source context, and finished video.'],
  ['06', 'Ready-to-post files', 'You receive the completed vertical files; you decide when and where to publish.'],
];
const steps = [
  ['01', 'Tell us what you know', 'We learn your business, audience, voice, and the topics that matter to you.'],
  ['02', 'We find the conversation', 'Our team researches relevant stories, questions, and situations.'],
  ['03', 'We make it yours', 'We write and produce reactions around your approved perspective and materials.'],
  ['04', 'You get finished videos', 'Your subscription starts on purchase day. We deliver 12 files within 72 hours after receiving all required materials and approvals.'],
];
const faqs = [
  ['Do I need to film every month?', 'No ongoing filming is required for these AI-avatar videos. Initial setup may require an approved recording or other likeness and voice materials.'],
  ['What if I do not know what to talk about?', 'That is part of what we handle. We research relevant opportunities and build scripts around your expertise and audience.'],
  ['Will the videos sound like me?', 'We learn your communication style during onboarding and shape scripts around it. AI voice delivery may differ from a live recording, and you will review content requiring your input.'],
  ['Are the videos ready to post?', 'Yes. We deliver finished vertical video files. Publishing to your social accounts is not included.'],
  ['Do I have to learn the Creator software?', 'No. This is a managed production service; our team runs the workflow.'],
  ['What happens after I pay?', 'Once Stripe confirms your subscription, we email onboarding instructions so you can provide your business details and begin avatar setup.'],
  ['When will my videos arrive?', 'Your subscription starts on the day you purchase. We deliver the 12 finished videos within 72 hours after we receive all required materials and approvals from you.'],
  ['Can I request changes?', 'Yes. One revision is included for each of the 12 videos.'],
  ['What if I change my mind?', 'You can request a refund during the first seven days if production has not begun. Production begins with the first research or scripting work on your videos; we email you when that starts. After that, we address changes through the included revision for each video.'],
  ['How do I cancel?', 'Email info@vektiss.com. Cancellation stops your next renewal, and we finish the current paid month. We confirm the cancellation by email.'],
  ['Can you guarantee followers or clients?', 'No. We provide production, not guaranteed views, engagement, or customer acquisition.'],
];

function Wordmark() { return <a className="wordmark logo-lockup" href="#top" aria-label="Vektiss Managed Content home"><span className="logo-image-frame"><img src="/vektiss-logo.png" alt="Vektiss" /></span><small>MANAGED CONTENT</small></a>; }

export default function HomePage() {
  return <><PageTracker /><main id="top">
    <div className="announcement"><span className="announcement-dot" /> A content team for the ideas only you can share <span className="announcement-line" /></div>
    <header className="site-header container"><Wordmark /><nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#examples">Examples</a><a href="#pricing">The offer</a></nav><CheckoutButton href={checkout} className="button-header">Get My 12 Videos</CheckoutButton></header>

    <section className="hero container">
      <div className="hero-content"><p className="eyebrow"><span className="eyebrow-rule" /> VEKTISS MANAGED CONTENT</p><h1>Show up with <em>your point of view.</em><br />We&apos;ll make the videos.</h1><p className="hero-lead">12 AI reaction videos. Researched, scripted, and produced for you—every month. So your expertise stays visible without another production job on your calendar.</p><div className="hero-actions"><CheckoutButton href={checkout}>Get My 12 Videos <strong>$750/mo</strong></CheckoutButton><a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↘</span></a></div><div className="hero-proof"><span>YOUR EXPERTISE</span><i aria-hidden="true" /><span>OUR PRODUCTION</span><i aria-hidden="true" /><span>YOUR VIDEOS</span></div></div>
      <div className="hero-visual"><div className="hero-glow" /><SampleGallery compact /></div>
    </section>

    <section className="marquee-bar" aria-label="Service highlights"><div className="container"><span>RESEARCH</span><b>✦</b><span>SCRIPTING</span><b>✦</b><span>AI AVATAR</span><b>✦</b><span>PRODUCTION</span><b>✦</b><span>DELIVERY</span></div></section>

    <section className="section section-light" id="problem"><div className="container"><div className="section-intro split-intro"><p className="eyebrow dark">THE PROBLEM</p><div><h2>Your business needs your attention.<br /><em>Content does too.</em></h2><p>You know what your audience needs to hear. But turning that knowledge into a steady stream of videos takes research, writing, recording, and editing—again and again.</p></div></div><div className="problem-grid"><article><span className="card-icon">◷</span><h3>No time to record</h3><p>Running the business already fills the day. Camera time keeps getting pushed back.</p></article><article><span className="card-icon">⌘</span><h3>Too many blank pages</h3><p>You have the expertise. Finding the right angle every week is the hard part.</p></article><article><span className="card-icon">▤</span><h3>Production piles up</h3><p>A short video can require hours of sourcing, scripting, editing, and polishing.</p></article></div><div className="statement">You do not need another task.<br /><span>You need the content handled.</span></div></div></section>

    <section className="section section-dark" id="included"><div className="container"><div className="section-heading"><p className="eyebrow">THE SOLUTION</p><h2>All the work behind the video.<br /><em>Off your plate.</em></h2><p>We build reaction content from your professional perspective. You stay involved in the message while our team handles the production.</p></div><div className="feature-grid">{features.map(([number,title,copy])=><article className="feature-card" key={number}><span className="feature-number">{number} / 06</span><span className="feature-spark" aria-hidden="true">✦</span><h3>{title}</h3><p>{copy}</p></article>)}</div><div className="inline-cta"><span>One package. A full production workflow.</span><CheckoutButton href={checkout}>Get My 12 Videos</CheckoutButton></div></div></section>

    <section className="section section-cream" id="how-it-works"><div className="container"><div className="section-heading"><p className="eyebrow dark">THE PROCESS</p><h2>Four steps. <em>One less thing to do.</em></h2><p>Simple on your side. Thoughtful production on ours.</p></div><div className="step-list">{steps.map(([number,title,copy])=><article className="step" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{copy}</p><span className="step-arrow" aria-hidden="true">↗</span></article>)}</div><p className="process-note">Initial avatar setup requires your approved likeness and voice materials. You also review content where your input is needed.</p></div></section>

    <section className="section section-examples" id="examples"><div className="container"><div className="section-heading"><p className="eyebrow">THE OUTPUT</p><h2>Do not just imagine it.<br /><em>Watch it.</em></h2><p>Watch the managed-content introduction and two finished Vektiss reaction videos.</p></div><SampleGallery /><div className="example-bottom"><p>Not a repost. A reaction built around a real perspective.</p><a href="#pricing" className="text-link">Make yours next <span aria-hidden="true">↗</span></a></div></div></section>

    <section className="section section-light audience-section"><div className="container"><div className="section-intro split-intro"><p className="eyebrow dark">WHO IT IS FOR</p><div><h2>For people with something <em>worth saying.</em></h2><p>Built initially for credit repair professionals, and useful wherever knowledge deserves a clearer, more consistent presence.</p></div></div><div className="audience-row"><span>Credit repair professionals</span><span>Financial service experts</span><span>Coaches & consultants</span><span>Service business owners</span></div></div></section>

    <section className="section pricing-section" id="pricing"><div className="container pricing-layout"><div className="pricing-copy"><p className="eyebrow">ONE CLEAR OFFER</p><h2>Your expertise.<br /><em>Our production.</em></h2><p>Consistent, expert-led content without taking on another production schedule.</p><p className="pricing-aside">No software to learn. No sales call to book. Just a team making content with you.</p></div><div className="price-card"><div className="price-top"><span>VEKTISS MANAGED CONTENT</span><span className="price-badge">MONTHLY</span></div><div className="price"><strong>$750</strong><span>/ month</span></div><h3>12 AI reaction videos, done for you.</h3><ul><li>Personalized research and topic selection</li><li>Scripts built around your perspective</li><li>Initial AI avatar setup and guidance</li><li>Video generation, editing, and assembly</li><li>Finished vertical video files</li><li>One revision per video</li><li>Delivery within 72 hours after required materials and approvals arrive</li></ul><CheckoutButton href={checkout}>Get My 12 Videos</CheckoutButton><p className="price-fine">Recurring $750/month subscription starts on purchase day. Cancel by emailing info@vektiss.com; this stops the next renewal and we finish your paid month. Refund requests in the first seven days are eligible only before the first research or scripting work begins. We email you when that work starts. Initial avatar setup needs your materials and permission. Publishing, ad management, and performance guarantees are not included.</p></div></div></section>

    <section className="section faq-section"><div className="container"><div className="section-intro split-intro"><p className="eyebrow dark">GOOD TO KNOW</p><div><h2>A few things you <em>might ask.</em></h2><div className="faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">＋</span></summary><p>{a}</p></details>)}</div></div></div></div></section>

    <section className="final-cta"><div className="container"><p className="eyebrow">READY WHEN YOU ARE</p><h2>You already have the expertise.<br /><em>Let us make it visible.</em></h2><p>12 done-for-you reaction videos every month. $750/month.</p><CheckoutButton href={checkout}>Get My 12 Videos</CheckoutButton></div></section>
  </main><footer className="footer"><div className="container footer-main"><Wordmark /><p>Your expertise. Our production.</p><div className="footer-links">{privacyUrl&&<a href={privacyUrl}>Privacy</a>}{termsUrl&&<a href={termsUrl}>Terms</a>}{supportEmail&&<a href={`mailto:${supportEmail}`}>Support</a>}</div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Vektiss. All rights reserved.</span><span>Managed content production · Not guaranteed marketing results</span></div></footer></>;
}
