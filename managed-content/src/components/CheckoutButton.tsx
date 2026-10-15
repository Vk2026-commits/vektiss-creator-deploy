'use client';

import { track } from './Track';

export function CheckoutButton({ href, children, className = '' }: { href: string | null; children: React.ReactNode; className?: string }) {
  if (!href) return <span className={`button button-disabled ${className}`} role="status" title="Checkout is not configured yet">Checkout coming soon</span>;
  return <a className={`button ${className}`} href={href} rel="noopener noreferrer" onClick={() => track('checkout_click')}>{children}<span aria-hidden="true">↗</span></a>;
}
