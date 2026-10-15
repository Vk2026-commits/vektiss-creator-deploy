# Vektiss Managed Content

Standalone Next.js landing page for the managed **12 videos / $750 per month** offer. It is intentionally separate from Vektiss Creator.

## Local preview

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. Until recurring checkout is confirmed, purchase buttons visibly say **Checkout coming soon**. The public site must not launch in that state.

## Production configuration

Set the values in `.env.example` as Vercel environment variables. Keep server values sensitive and never place them in `NEXT_PUBLIC_` variables. A production build fails if checkout, policies, support, Stripe verification, Resend, or Supabase storage settings are missing. The supplied Stripe link displays **$750 per month** and **Subscribe**. Keep `NEXT_PUBLIC_CHECKOUT_RECURRING_CONFIRMED=false` until the webhook, onboarding email, legal links, and support contact are configured and tested. Configure the recurring link's success redirect to `https://react.vektiss.com/thank-you`. Configure the webhook endpoint at `https://react.vektiss.com/api/stripe/webhook` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`, `.updated`, `.deleted`
- `invoice.paid`, `invoice.payment_failed`

Set `STRIPE_PAYMENT_LINK_ID` to that exact Payment Link's `plink_...` ID. The webhook sends onboarding email only for a paid subscription session from that link. A thank-you page visit cannot trigger fulfillment. Its signing secret remains server-only; no Stripe API key is needed merely to verify the signed event. Use separate Stripe sandbox and live values. The same applies to Supabase and Resend.

Resend must use a verified sender. The support email is the reply-to address. Buyers are asked to reply with basic business context; approved likeness/voice material is handled separately through a secure process. Do not collect credentials by email.

Run `supabase/001_managed_store.sql` once in the existing Supabase project. It creates a dedicated private schema, enables server-only access, and leaves Creator tables alone. `SUPABASE_SECRET_KEY` is a Production Secret in Vercel; never expose it to the browser. This store provides a durable onboarding sent marker, a short processing lock, subscription status, and event counters. Stripe may retry failed webhook deliveries. A Resend idempotency key also prevents immediate duplicate emails. Metrics are aggregate counts, not a customer dashboard. Browser rate-limit keys use salted IP hashes that expire after 90 seconds. Daily keys are `managed:metrics:YYYY-MM-DD:<event>` for `page_view`, `sample_play:<sample-id>`, `checkout_click`, `invoice_paid`, and `invoice_payment_failed`. Verified purchases are unique subscription IDs in `managed:verified-purchases:YYYY-MM-DD`.

## Content and media

The gallery now starts with the newly supplied managed-content video and follows it with two finished Vektiss reactions. The supplied Vektiss logo is displayed without altering its artwork. Original MP4s are copied into `public/samples`; the page uses `preload="none"` so playback is requested only when a visitor clicks. PNG posters are derived from the actual footage. No transcript/caption file was supplied, so captions are not represented as available. Add accurate VTT captions before launch if they can be created and checked against the audio.

The older raw source clip was removed from the public site rather than shown as a finished example. Before public release, confirm the team has the right to display any third-party footage, likenesses, and trademarks appearing in the three displayed videos.

## Release checklist

1. Configure Vercel project and `react.vektiss.com` domain independently of the Creator app. The domain is reserved on this project, but DNS should not be enabled until the production launch requirements are met.
2. Configure the real recurring Stripe Payment Link, its success URL, matching Payment Link ID, and webhook signing secret.
3. Configure verified Resend sender, support mailbox, private Supabase store, real managed-service terms/privacy links, and accurate subscription/cancellation terms.
4. Consider applicable sales-tax registrations and Stripe Tax setup before enabling tax collection.
5. Run `npm run typecheck`, `npm test`, and `npm run build`; verify mobile/desktop layout and all three videos.
6. Run a Stripe **sandbox** paid-checkout test; verify one onboarding email despite repeated webhook delivery and no email from a thank-you page visit.
7. Review the actual delivered samples and their public display rights. Only then promote the production build and attach the domain.

This site does not create Creator accounts, publish posts, promise results, or treat an outbound checkout click as a purchase.
