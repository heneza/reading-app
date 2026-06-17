/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy tuned for this stack:
//  - Next.js App Router injects inline bootstrap/hydration scripts, and we
//    have an inline theme script in layout.tsx, so script-src needs
//    'unsafe-inline'. `next dev` additionally needs 'unsafe-eval' for HMR.
//  - Supabase REST/Auth (https) + Realtime (wss) for the browser client.
//  - Cloudflare Turnstile loads a script and renders in an iframe.
//  - frame-ancestors 'none' blocks click-jacking (with X-Frame-Options as a
//    fallback for older browsers).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: 'https', hostname: 'covers.openlibrary.org' }
    ]
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
    ];
  }
};
export default nextConfig;
