import type { MetadataRoute } from 'next';

// Web app manifest — makes the site installable to the home screen.
// Next serves this at /manifest.webmanifest and auto-injects the <link>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Reading App',
    short_name: 'Reading',
    description:
      'A community for readers — track books, match with people by taste, and join book clubs.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0809',
    theme_color: '#0b0809',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
