import type { NextConfig } from 'next';

// URL do backend NestJS. O navegador só fala com o próprio site (/api/*): o Next
// repassa para a API, então o cookie de sessão do admin fica same-origin (sem CORS).
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/:path*` },
      // Somente desenvolvimento: imagens gravadas em disco pela API (sem Vercel Blob).
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Área administrativa nunca deve ser guardada em cache nem indexada.
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
