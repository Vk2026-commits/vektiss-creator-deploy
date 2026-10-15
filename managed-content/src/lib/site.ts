export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://managed.vektiss.com';
// Supplied live link is retained as the candidate checkout, but remains gated
// until its recurring billing terms are verified against the monthly offer.
export const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || 'https://buy.stripe.com/aFa5kF9h0ddp2Ju5sB9EI0c';
export const checkoutRecurringConfirmed = process.env.NEXT_PUBLIC_CHECKOUT_RECURRING_CONFIRMED === 'true';
export const termsUrl = process.env.NEXT_PUBLIC_TERMS_URL || '';
export const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_URL || '';
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '';

export const samples = [
  { id: 'sample-01', label: '01 / THE SERVICE', title: '12 reaction videos, done for you', description: 'See the managed-content offer explained in a real Vektiss video.', src: '/samples/video-16.mp4', poster: '/samples/poster-16.png', duration: 'WATCH' },
  { id: 'sample-02', label: '02 / FINISHED VIDEO', title: 'An expert reaction, finished', description: 'A completed vertical Vektiss video reacting to a technology story.', src: '/samples/video-14.mp4', poster: '/samples/poster-1.png', duration: '1:02' },
  { id: 'sample-03', label: '03 / FINISHED VIDEO', title: 'A different expert perspective', description: 'A completed Vektiss reaction to financial-industry news.', src: '/samples/video-4.mp4', poster: '/samples/poster-2.png', duration: '0:54' },
] as const;

export function safeCheckoutUrl(): string | null {
  return checkoutRecurringConfirmed && /^https:\/\/(?:buy|checkout)\.stripe\.com\//.test(checkoutUrl) ? checkoutUrl : null;
}
