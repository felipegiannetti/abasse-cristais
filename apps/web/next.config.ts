import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// URL do backend NestJS. O navegador só fala com o próprio site (/api/*): o Next
// repassa para a API, então o cookie de sessão do admin fica same-origin (sem CORS).
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

// Content-Security-Policy. O Next injeta scripts inline de hidratação, então script-src precisa de
// 'unsafe-inline' (um CSP com nonce exigiria renderização 100% dinâmica e desligaria o cache/ISR).
// Mesmo assim o CSP bloqueia: iframes/clickjacking, <base>, <object>, formulários para outros
// domínios, conexões e scripts de origens externas e imagens de outros hosts.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`, // eval só no dev (React refresh)
  "style-src 'self' 'unsafe-inline'",
  // imagens vêm do próprio site (/api/images/<id>, guardadas no banco); blob: = pré-visualização no painel
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? '' : ' ws: wss:'}`,
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // só quando o site é servido em https (em http://localhost isso quebraria os assets)
  ...(isProd && process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    // Sem remotePatterns: as fotos são servidas pelo próprio site (/api/images/<id>), então o
    // otimizador só aceita imagens locais e não pode ser usado como proxy de imagens de terceiros.
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/:path*` },
    ];
  },
  async headers() {
    const noCache = [
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ];
    return [
      { source: '/:path*', headers: securityHeaders },
      // Área administrativa nunca deve ser guardada em cache nem indexada (EN e PT).
      { source: '/admin/:path*', headers: noCache },
      { source: '/pt/admin/:path*', headers: noCache },
    ];
  },
};

export default nextConfig;
