'use client';

import { useEffect } from 'react';

// Registers the service worker (production only — avoids stale caches in dev).
// Renders nothing.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration is best-effort */
      });
    }
  }, []);
  return null;
}
