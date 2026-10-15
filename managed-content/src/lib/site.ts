export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://managed.vektiss.com';
export const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || '';
export const termsUrl = process.env.NEXT_PUBLIC_TERMS_URL || '';
export const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_URL || '';
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '';

export const samples = [
  { id: 'sample-01', label: '01 / FINISHED VIDEO', title: 'An expert reaction, finished', description: 'A completed vertical Vektiss video reacting to a technology story.', src: '/samples/video-14.mp4', poster: '/samples/poster-1.png', duration: '1:02' },
  { id: 'sample-02', label: '02 / FINISHED VIDEO', title: 'A different expert perspective', description: 'A completed Vektiss reaction to financial-industry news.', src: '/samples/video-4.mp4', poster: '/samples/poster-2.png', duration: '0:54' },
  { id: 'sample-03', label: '03 / SOURCE CLIP', title: 'The conversation that starts it', description: 'An example source clip—not a finished Vektiss production. A creator adds their own perspective to material they can lawfully use.', src: '/samples/video-2.mp4', poster: '/samples/poster-3.png', duration: '1:36' },
] as const;

export function safeCheckoutUrl(): string | null {
  return /^https:\/\/(?:buy|checkout)\.stripe\.com\//.test(checkoutUrl) ? checkoutUrl : null;
}
