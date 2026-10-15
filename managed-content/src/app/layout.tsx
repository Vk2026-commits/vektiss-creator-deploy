import type { Metadata } from 'next';
import './globals.css';
import { siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '12 Done-for-You AI Reaction Videos | Vektiss Managed Content',
  description: 'Get 12 AI-avatar reaction videos every month for $750. Vektiss handles content research, scripting, avatar setup, and production so you can focus on your business.',
  openGraph: {
    title: 'Vektiss Managed Content — Your expertise. Our production.',
    description: '12 done-for-you AI reaction videos every month. $750/month.',
    type: 'website',
    url: siteUrl,
    images: [{ url: '/og-image.svg', width: 1200, height: 630, alt: 'Vektiss Managed Content' }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
