import { NextResponse, type NextRequest } from 'next/server';

// Routing rules (see README):
//  • English is the main language and has no URL prefix:  /products
//  • Portuguese lives under /pt and Spanish under /es:    /pt/products · /es/products
//  • The admin area is Portuguese only: /admin, /pt/admin and /es/admin all render the Portuguese panel.
//  • The admin login is NOT at /admin. It only exists at the secret path "/<ADMIN_LOGIN_TOKEN>"
//    (optionally with a language prefix). /admin/login is blocked, and /admin/* without a session answers 404.
//  • Without a valid token configured, the login is unavailable (fails closed).
const SESSION_COOKIES = ['__Host-abasse_admin', 'abasse_admin'];
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,128}$/;
const LOCALE_COOKIE = 'NEXT_LOCALE';
const PREFIXED = ['pt', 'es'] as const;

type Locale = 'en' | 'pt' | 'es';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // /en/... is the same as the unprefixed path: keep one canonical URL
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    return NextResponse.redirect(url, 308);
  }

  const prefix = PREFIXED.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  let locale: Locale = prefix ?? 'en';
  const rest = prefix ? pathname.slice(prefix.length + 1) || '/' : pathname;

  // Someone who chose Portuguese/Spanish before is sent to the matching prefix when opening an unprefixed URL
  const saved = req.cookies.get(LOCALE_COOKIE)?.value;
  if (!prefix && (saved === 'pt' || saved === 'es')) {
    const url = req.nextUrl.clone();
    url.pathname = `/${saved}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url, 307);
  }

  const token = process.env.ADMIN_LOGIN_TOKEN?.trim();
  const tokenOk = !!token && TOKEN_FORMAT.test(token);
  const isLogin = tokenOk && (rest === `/${token}` || rest === `/${token}/`);
  const isAdmin = rest === '/admin' || rest.startsWith('/admin/');

  // the admin area is Portuguese only: always render it with the Portuguese dictionary
  if (isLogin || isAdmin) locale = 'pt';

  const internal = (path: string) => new URL(`/${locale}${path === '/' ? '' : path}${search}`, req.url);
  const notFound = () => NextResponse.rewrite(internal('/404'), { status: 404 });

  // Next routes a percent-encoded path as its decoded form ("/pt/%61dmin" is "/pt/admin"), but the checks
  // below compare the raw text. Any encoded path that decodes to an admin path is answered like /admin itself.
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    /* malformed escape: Next rejects it on its own */
  }
  if (decoded !== pathname && /(^|\/)admin(\/|$)/i.test(decoded)) return notFound();

  // Secret login screen
  if (isLogin) {
    const res = NextResponse.rewrite(internal('/admin/login'));
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  // Admin panel
  if (isAdmin) {
    if (rest === '/admin/login') return notFound();
    if (!SESSION_COOKIES.some((name) => req.cookies.has(name))) return notFound();
  }

  return NextResponse.rewrite(internal(rest));
}

// Everything except Next internals, the API proxy (incl. /api/images), the printed-QR redirect
// (/q/<slug>, outside the [locale] tree on purpose — see app/q/[slug]/route.ts) and files with an
// extension (robots.txt, sitemap.xml, icon.svg, images…).
export const config = { matcher: ['/((?!_next/|api/|q/|.*\\..*).*)'] };
