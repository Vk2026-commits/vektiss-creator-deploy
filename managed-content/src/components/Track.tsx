'use client';

import { useEffect } from 'react';

export type TrackName = 'page_view' | 'sample_play' | 'checkout_click';

export function track(name: TrackName, sampleId?: string) {
  const payload = JSON.stringify({ name, sampleId });
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
  } else {
    void fetch('/api/track', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true });
  }
}

export function PageTracker() {
  useEffect(() => { track('page_view'); }, []);
  return null;
}
