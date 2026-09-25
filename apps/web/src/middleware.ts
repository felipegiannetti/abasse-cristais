import { NextResponse, type NextRequest } from 'next/server';

// Routing rules (see README):
//  • English is the main language and has no URL prefix:  /products
//  • Portuguese lives under /pt:                          /pt/products
//  • The admin login is NOT at /admin. It only exists at the secret path "/<ADMIN_LOGIN_TOKEN>"
//    (or /pt/<token>). /admin/login is blocked, and /admin/* without a session answers 404.
//  • Without a valid token configured, the login is unavailable (fails closed).
const SESSION_COOKIES = ['__Host-abasse_admin', 'abasse_admin'];
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,128}$/;
const LOCALE_COOKIE = 'NEXT_LOCALE';

type Locale = 'en' | 'pt';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // /en/... is the same as the unprefixed path: keep one canonical URL
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    return NextResponse.redirect(url, 308);
  }

  const hasPtPrefix = pathname === '/pt' || pathname.startsWith('/pt/');
  const locale: Locale = hasPtPrefix ? 'pt' : 'en';
  const rest = hasPtPrefix ? pathname.slice(3) || '/' : pathname;

  // Someone who chose Portuguese before is sent to /pt when opening an unprefixed URL
  if (!hasPtPrefix && req.cookies.get(LOCALE_COOKIE)?.value === 'pt') {
    const url = req.nextUrl.clone();
    url.pathname = `/pt${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url, 307);
  }

  const internal = (path: string) => new URL(`/${locale}${path === '/' ? '' : path}${search}`, req.url);
  const notFound = () => NextResponse.rewrite(internal('/404'), { status: 404 });

  // Secret login screen
  const token = process.env.ADMIN_LOGIN_TOKEN?.trim();
  const tokenOk = !!token && TOKEN_FORMAT.test(token);
  if (tokenOk && (rest === `/${token}` || rest === `/${token}/`)) {
    const res = NextResponse.rewrite(internal('/admin/login'));
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  // Admin panel
  if (rest === '/admin' || rest.startsWith('/admin/')) {
    if (rest === '/admin/login') return notFound();
    if (!SESSION_COOKIES.some((name) => req.cookies.has(name))) return notFound();
  }

  return NextResponse.rewrite(internal(rest));
}

// Everything except Next internals, the API proxy (incl. /api/images) and files with an extension
// (robots.txt, sitemap.xml, icon.svg, images…).
export const config = { matcher: ['/((?!_next/|api/|.*\\..*).*)'] };
