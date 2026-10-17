// Security regression suite for the API. Runs against a RUNNING API + database (local/staging only —
// never point it at production: it creates and deletes products and can lock the admin account).
//
//   npm run test:security -w apps/api
//
// Env (read from apps/api/.env when present):
//   API_URL                 default http://localhost:4000
//   ADMIN_LOGIN_TOKEN       secret login token (same as the API/web config)
//   JWT_SECRET              lets us forge tokens signed with the REAL secret to test iss/aud checks
//   ADMIN_USERNAME          default "admin"
//   ADMIN_TEST_PASSWORD     permanent admin password  → enables the authenticated tests
//   ADMIN_TEMP_PASSWORD     (optional) fresh temp password → also tests the forced first-login flow,
//                           then sets ADMIN_TEST_PASSWORD as the permanent one
//   TEST_LOCKOUT=1          also tests the brute-force lockout (leaves the account locked for 15 min)
import { createHmac } from 'node:crypto';

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  /* no .env */
}

const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN = process.env.ADMIN_LOGIN_TOKEN || '';
const USER = process.env.ADMIN_USERNAME || 'admin';
const PASS = process.env.ADMIN_TEST_PASSWORD || '';
const TEMP = process.env.ADMIN_TEMP_PASSWORD || '';
const ORIGIN = (process.env.WEB_ORIGIN || 'http://localhost:3000').split(',')[0].trim();
const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-abasse_admin' : 'abasse_admin';

// Safety: this suite creates/deletes data and can lock the admin account. Never run it against a real site.
const host = new URL(API).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && process.env.ALLOW_NON_LOCAL_TESTS !== '1') {
  console.error(`Refusing to run against ${host}: this suite is destructive. Use a local/staging API (or set ALLOW_NON_LOCAL_TESTS=1 knowingly).`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
let skipped = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else {
    fail++;
    failures.push(name);
  }
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `\n        ${String(detail).slice(0, 300)}`}`);
};
const skip = (name, why) => {
  skipped++;
  console.log(`SKIP  ${name} (${why})`);
};

async function call(method, path, { body, cookie, headers = {}, raw } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined && !isForm && raw === undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, json, headers: res.headers, setCookie, cookie: setCookie.split(';')[0] || '' };
}

// POST /auth/login is limited to 10 per minute per IP (that is what section C tests), and this suite logs in more
// than 10 times. A 429 here would not be a product bug, just the suite outrunning its own limiter, so `login`
// waits out the window and retries once. Pass { retry: false } where the 429 is the thing being tested.
const loginOnce = (username, password, token) =>
  call('POST', '/auth/login', {
    body: { username, password },
    headers: { 'x-admin-login-token': token, origin: ORIGIN },
  });
const login = async (username, password, token = TOKEN, { retry = true } = {}) => {
  let res = await loginOnce(username, password, token);
  if (retry && res.status === 429) {
    console.log('  (login rate limit reached — waiting 61s for the window to reset)');
    await new Promise((resolve) => setTimeout(resolve, 61_000));
    res = await loginOnce(username, password, token);
  }
  return res;
};
const mut = (method, path, cookie, body) => call(method, path, { body, cookie, headers: { origin: ORIGIN } });

const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function forge(header, payload, secret) {
  const data = `${b64u(header)}.${b64u(payload)}`;
  const sig = secret ? createHmac('sha256', secret).update(data).digest('base64url') : '';
  return `${data}.${sig}`;
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);
const png = (name = 'x.png', type = 'image/png') => {
  const fd = new FormData();
  fd.append('file', new Blob([PNG], { type }), name);
  return fd;
};
const fileForm = (buf, name, type) => {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type }), name);
  return fd;
};

// ======================================================================
console.log(`\nTarget: ${API}\n`);
try {
  await fetch(`${API}/health`);
} catch {
  console.error('API is not reachable. Start it first.');
  process.exit(2);
}

console.log('--- A. Unauthenticated attack surface');

// SEC-01: login is unreachable without the secret address token
let r = await call('POST', '/auth/login', { body: { username: USER, password: 'x' }, headers: { origin: ORIGIN } });
ok('login without token → 404 (no oracle)', r.status === 404 && r.json.code === 'LOGIN_UNAVAILABLE', JSON.stringify(r.json));
r = await login(USER, 'x', 'wrong-token-wrong-token');
ok('login with wrong token → 404', r.status === 404, r.status);
r = await login(USER, 'x', '');
ok('login with empty token → 404', r.status === 404, r.status);
if (TOKEN) {
  // also sent with NO Origin header at all (unlike the login() helper, which always sets one): proves
  // /auth/login reaches real auth logic even without Origin, since it has no session yet to protect
  // (the Origin check requires it everywhere else under /admin and /auth — see the CSRF tests below)
  r = await call('POST', '/auth/login', { body: { username: 'no-such-user-zzz', password: 'whatever-password' }, headers: { 'x-admin-login-token': TOKEN } });
  ok('correct token + unknown user → 401 INVALID_CREDENTIALS (even with no Origin header)', r.status === 401 && r.json.code === 'INVALID_CREDENTIALS', JSON.stringify(r.json));
} else skip('correct-token login checks', 'ADMIN_LOGIN_TOKEN not set');

// DoS shield: floods WITHOUT the token must be answered cheaply and must not burn the login rate limiter,
// otherwise an outsider could lock the real admin out of logging in (the bucket is shared behind the proxy IP)
if (TOKEN) {
  const flood = await Promise.all(Array.from({ length: 40 }, () => login(USER, 'x', 'no-token-flood')));
  ok('40 login attempts without the token → all 404, none rate-limited', flood.every((x) => x.status === 404), flood.map((x) => x.status).join(','));
  r = await login('no-such-user-zzz', 'whatever-password');
  ok('after the flood, a real token holder is still NOT rate-limited (401, not 429)', r.status === 401, r.status);
}
{
  const spam = await Promise.all(Array.from({ length: 150 }, () => call('GET', '/admin/products')));
  ok('150 unauthenticated hits on an admin route → all 401 (bucket cannot be exhausted → admin never blocked)', spam.every((x) => x.status === 401), [...new Set(spam.map((x) => x.status))].join(','));
}
r = await call('GET', '/auth/me');
ok('/auth/me is Cache-Control: no-store', /no-store/.test(r.headers.get('cache-control') || ''), r.headers.get('cache-control'));
r = await call('GET', '/admin/products');
ok('/admin/* is Cache-Control: no-store', /no-store/.test(r.headers.get('cache-control') || ''), r.headers.get('cache-control'));

// Broken access control: every admin route requires a session
const adminRoutes = [
  ['GET', '/admin/products'],
  ['GET', '/admin/products/categories'],
  ['GET', '/admin/products/stats'],
  ['GET', '/admin/settings'],
  ['PUT', '/admin/settings'],
  ['GET', '/admin/team'],
  ['POST', '/admin/team'],
  ['POST', '/admin/team/abc/delete'],
  ['POST', '/admin/team/abc/reset-password'],
  ['GET', '/admin/sales'],
  ['POST', '/admin/sales'],
  ['GET', '/admin/sales/abc'],
  ['PATCH', '/admin/sales/abc'],
  ['POST', '/admin/sales/abc/photos'],
  ['GET', '/admin/sales/photos/abcdefghijklmnopqrstu'],
  ['DELETE', '/admin/sales/abc/photos/def'],
  ['GET', '/admin/customers'],
  ['POST', '/admin/customers'],
  ['GET', '/admin/customers/abc'],
  ['PATCH', '/admin/customers/abc'],
  ['POST', '/admin/customers/abc/erase'],
  ['GET', '/admin/analytics/clicks'],
  ['POST', '/admin/analytics/confirm'],
  ['GET', '/admin/finance/summary'],
  ['GET', '/admin/products/abc'],
  ['POST', '/admin/products'],
  ['PATCH', '/admin/products/abc'],
  ['DELETE', '/admin/products/abc'],
  ['POST', '/admin/products/abc/images'],
  ['PUT', '/admin/products/abc/images/order'],
  ['DELETE', '/admin/products/abc/images/def'],
  ['GET', '/auth/me'],
  ['POST', '/auth/change-password'],
  ['POST', '/auth/sign-out-everywhere'],
  ['GET', '/admin/audit-log'],
  ['POST', '/admin/products/abc/duplicate'],
];
for (const [m, p] of adminRoutes) {
  const res = await call(m, p, { body: m === 'GET' || m === 'DELETE' ? undefined : {}, headers: { origin: ORIGIN } });
  ok(`${m} ${p} without session → 401`, res.status === 401, res.status);
}

// JWT forging
const now = Math.floor(Date.now() / 1000);
const claims = { sub: 'x', tv: 0, iat: now, exp: now + 3600, iss: 'abasse-api', aud: 'abasse-admin' };
const forged = {
  'alg=none token': forge({ alg: 'none', typ: 'JWT' }, claims, ''),
  'token signed with a wrong secret': forge({ alg: 'HS256', typ: 'JWT' }, claims, 'not-the-real-secret'),
  'HS512 confusion': forge({ alg: 'HS512', typ: 'JWT' }, claims, 'not-the-real-secret'),
  'garbage token': 'not.a.jwt',
};
if (process.env.JWT_SECRET) {
  forged['real signature but no iss/aud'] = forge({ alg: 'HS256', typ: 'JWT' }, { sub: 'x', tv: 0, iat: now, exp: now + 3600 }, process.env.JWT_SECRET);
  forged['real signature, wrong audience'] = forge({ alg: 'HS256', typ: 'JWT' }, { ...claims, aud: 'other-app' }, process.env.JWT_SECRET);
  forged['real signature, expired'] = forge({ alg: 'HS256', typ: 'JWT' }, { ...claims, exp: now - 10 }, process.env.JWT_SECRET);
} else skip('iss/aud/expiry forging with the real secret', 'JWT_SECRET not available to the test');
for (const [name, t] of Object.entries(forged)) {
  r = await call('GET', '/admin/products', { cookie: `${COOKIE_NAME}=${t}` });
  ok(`forged session: ${name} → 401`, r.status === 401, r.status);
}

// CSRF (Origin check)
r = await call('POST', '/auth/logout', { headers: { origin: 'https://evil.example' } });
ok('foreign Origin on state-changing request → 403', r.status === 403 && r.json.code === 'ORIGIN_NOT_ALLOWED', JSON.stringify(r.json));
r = await call('POST', '/auth/logout', { headers: { origin: 'null' } });
ok('Origin: null (sandboxed iframe) → 403', r.status === 403, r.status);
// /admin and /auth (except /auth/login) read the session cookie: a missing Origin is refused there too
r = await call('POST', '/auth/logout', {});
ok('missing Origin on /auth/* (not login) → 403', r.status === 403 && r.json.code === 'ORIGIN_NOT_ALLOWED', JSON.stringify(r.json));
r = await call('PATCH', '/admin/products/abc', { body: {} });
ok('missing Origin on /admin/* → 403', r.status === 403 && r.json.code === 'ORIGIN_NOT_ALLOWED', JSON.stringify(r.json));
// /auth/login itself stays exempt (tested above, with no Origin header, right after the token checks)
r = await call('POST', '/track/click', { body: { ref: 'NOORIG', source: 'MENU', path: '/', locale: 'en' } });
ok('missing Origin on the public /track/click still works (server-to-server QR redirect relies on this)', r.status === 204, r.status);

// Injection / input validation on the public API
for (const payload of ["' OR '1'='1", "'; DROP TABLE \"Product\";--", '%', '_', '\\', '{"$ne":null}', '<script>alert(1)</script>']) {
  r = await call('GET', `/products?q=${encodeURIComponent(payload)}&category=${encodeURIComponent(payload)}`);
  ok(`injection payload in q/category is inert (${payload.slice(0, 18)}) → 200, no error`, r.status === 200 && Array.isArray(r.json.items), r.status);
}
r = await call('GET', `/products/${encodeURIComponent("' OR 1=1--")}`);
ok('injection in slug → 404', r.status === 404, r.status);
r = await call('GET', '/products?pageSize=100000');
ok('pageSize abuse → 400', r.status === 400, r.status);
r = await call('GET', '/products?page=-1');
ok('negative page → 400', r.status === 400, r.status);
r = await call('GET', '/products?foo=bar');
ok('unknown query param rejected (whitelist) → 400', r.status === 400, r.status);
r = await call('GET', '/products?q=' + 'a'.repeat(500));
ok('oversized search term → 400', r.status === 400, r.status);

// Hardening / info leaks
r = await call('POST', '/auth/login', { raw: '{"broken json', headers: { 'content-type': 'application/json', 'x-admin-login-token': TOKEN } });
ok('malformed JSON → 4xx without stack trace / paths', r.status >= 400 && r.status < 500 && !/at .*\.(js|ts):\d+|node_modules|C:\\\\/.test(JSON.stringify(r.json)), JSON.stringify(r.json));
r = await call('POST', '/auth/login', { raw: JSON.stringify({ username: USER, password: 'x'.repeat(2_000_000) }), headers: { 'content-type': 'application/json', 'x-admin-login-token': TOKEN } });
ok('2 MB JSON body → 413', r.status === 413, r.status);
r = await call('GET', '/health');
ok('no X-Powered-By header', !r.headers.get('x-powered-by'));
ok('X-Content-Type-Options: nosniff', r.headers.get('x-content-type-options') === 'nosniff');
r = await call('GET', '/.env');
ok('/.env not served → 404', r.status === 404);

// Exchange rate (public, same number printed on every page). Depends on the Banco Central / AwesomeAPI being
// reachable, so "no rate yet" (503 FX_UNAVAILABLE) is accepted; when there is one, its shape must be sane.
r = await call('GET', '/fx/usd-brl');
ok(
  'GET /fx/usd-brl → a plausible rate (or 503 FX_UNAVAILABLE when no source answered)',
  (r.status === 200 && r.json.base === 'USD' && r.json.quote === 'BRL' && r.json.rate > 1 && r.json.rate < 20 && ['BCB_PTAX', 'AWESOMEAPI'].includes(r.json.source)) ||
    (r.status === 503 && r.json.code === 'FX_UNAVAILABLE'),
  `${r.status} ${JSON.stringify(r.json).slice(0, 160)}`,
);
ok('the rate is cacheable by shared caches for a few minutes', r.status !== 200 || /public, max-age=\d+/.test(r.headers.get('cache-control') || ''));
for (const bad of ['../../.env', '..%2f..%2f.env', '%2e%2e%2f', "x'%20OR%20'1'='1", 'a'.repeat(200), 'clx0000000000000000000000']) {
  r = await call('GET', `/images/${bad}`);
  ok(`GET /images/${bad.slice(0, 22)} → 404 (no traversal/injection/enumeration leak)`, r.status === 404, r.status);
}

// ======================================================================
console.log('\n--- B. Authenticated (admin)');
let session = '';
if (!PASS) {
  skip('all authenticated tests', 'ADMIN_TEST_PASSWORD not set');
} else if (!TOKEN) {
  skip('all authenticated tests', 'ADMIN_LOGIN_TOKEN not set');
} else {
  if (TEMP) {
    r = await login(USER, TEMP);
    ok('login with temp password → 200 mustChangePassword=true', r.status === 200 && r.json.mustChangePassword === true, JSON.stringify(r.json));
    const tempSession = r.cookie;
    for (const [m, p] of [['GET', '/admin/products'], ['POST', '/admin/products'], ['GET', '/admin/products/categories'], ['GET', '/admin/products/stats'], ['GET', '/admin/team'], ['POST', '/admin/team'], ['PUT', '/admin/settings'], ['GET', '/admin/sales'], ['POST', '/admin/sales'], ['GET', '/admin/customers'], ['GET', '/admin/finance/summary']]) {
      const res = await mut(m, p, tempSession, m === 'POST' || m === 'PUT' ? {} : undefined);
      ok(`forced first login: ${m} ${p} → 403 PASSWORD_CHANGE_REQUIRED`, res.status === 403 && res.json.code === 'PASSWORD_CHANGE_REQUIRED', JSON.stringify(res.json));
    }
    r = await mut('POST', '/auth/change-password', tempSession, { currentPassword: TEMP, newPassword: 'short' });
    ok('weak new password → 400', r.status === 400, r.status);
    r = await mut('POST', '/auth/change-password', tempSession, { currentPassword: TEMP, newPassword: 'é'.repeat(40) + 'Aa1' });
    ok('password over 72 BYTES (multi-byte) → 400 PASSWORD_TOO_LONG', r.status === 400 && r.json.code === 'PASSWORD_TOO_LONG', JSON.stringify(r.json));
    r = await mut('POST', '/auth/change-password', tempSession, { currentPassword: 'wrong-current', newPassword: PASS });
    ok('wrong current password → 400 (not 401)', r.status === 400 && r.json.code === 'WRONG_CURRENT_PASSWORD', JSON.stringify(r.json));
    r = await mut('POST', '/auth/change-password', tempSession, { currentPassword: TEMP, newPassword: PASS });
    ok('password change succeeds', r.status === 200 && r.json.mustChangePassword === false, JSON.stringify(r.json));
    r = await call('GET', '/auth/me', { cookie: tempSession });
    ok('old session is invalidated after password change → 401', r.status === 401, r.status);
    r = await login(USER, TEMP);
    ok('temp password no longer works', r.status === 401, r.status);
  }

  r = await login(USER, PASS);
  ok('login with permanent password → 200', r.status === 200 && r.json.mustChangePassword === false, JSON.stringify(r.json));
  session = r.cookie;
  ok('session cookie is HttpOnly', /HttpOnly/i.test(r.setCookie));
  ok('session cookie is SameSite=Lax (or Strict)', /SameSite=(Lax|Strict)/i.test(r.setCookie));
  ok('session cookie lasts 60 days', /Max-Age=5184000/.test(r.setCookie), r.setCookie);
  ok('login response does not leak the password hash', !/hash|\$2[aby]\$/i.test(JSON.stringify(r.json)));

  r = await call('GET', '/auth/me', { cookie: session });
  ok('GET /auth/me with session → 200', r.status === 200 && r.json.username === USER, JSON.stringify(r.json));

  // Dashboard stats: admin-only, aggregate numbers, never image bytes
  r = await call('GET', '/admin/products/stats', { cookie: session });
  ok('GET /admin/products/stats → 200 with aggregate numbers', r.status === 200 && typeof r.json.total === 'number' && r.json.byStatus && Array.isArray(r.json.recent), JSON.stringify(r.json).slice(0, 200));
  {
    // "stock value" = price × stock of every AVAILABLE product (kg-priced ones: grams × price / 1000)
    const all = await call('GET', '/admin/products?pageSize=100', { cookie: session });
    const expected = (all.json.items ?? [])
      .filter((p) => p.status === 'AVAILABLE' && p.priceCents != null)
      .reduce((n, p) => n + (p.saleMode === 'WEIGHT' ? Math.round((p.priceCents * p.stockGrams) / 1000) : p.priceCents * p.stockQuantity), 0);
    ok('products/stats availableValueCents = price × stock (not a plain sum of prices)', r.json.availableValueCents === expected, `${r.json.availableValueCents} vs ${expected}`);
  }
  ok('stats payload is small (no image bytes)', JSON.stringify(r.json).length < 20000, JSON.stringify(r.json).length);

  // Mass assignment / validation
  r = await mut('POST', '/admin/products', session, { name: 'Sec Test Piece', description: 'd', category: 'SecTest', priceCents: 1000 });
  ok('create product → 201', r.status === 201, JSON.stringify(r.json));
  const A = r.json;
  r = await mut('PATCH', `/admin/products/${A.id}`, session, { slug: 'hijack', id: 'x', createdAt: '2000-01-01' });
  ok('mass assignment (slug/id/createdAt) rejected → 400', r.status === 400, JSON.stringify(r.json));

  // Optimistic concurrency: an edit based on a stale copy of the product must not overwrite newer changes
  {
    const fresh = await call('GET', `/admin/products/${A.id}`, { cookie: session });
    const v1 = fresh.json.updatedAt;
    r = await mut('PATCH', `/admin/products/${A.id}`, session, { featured: false, expectedUpdatedAt: '2000-01-01T00:00:00.000Z' });
    ok('stale expectedUpdatedAt → 409 PRODUCT_CHANGED', r.status === 409 && r.json.code === 'PRODUCT_CHANGED', JSON.stringify(r.json));
    r = await mut('PATCH', `/admin/products/${A.id}`, session, { featured: false, expectedUpdatedAt: 'not-a-date' });
    ok('malformed expectedUpdatedAt → 400', r.status === 400, r.status);
    r = await mut('PATCH', `/admin/products/${A.id}`, session, { featured: false, expectedUpdatedAt: v1 });
    ok('current expectedUpdatedAt → 200 and the version moves on', r.status === 200 && r.json.updatedAt !== v1, JSON.stringify(r.json).slice(0, 120));
    r = await mut('PATCH', `/admin/products/${A.id}`, session, { featured: false, expectedUpdatedAt: v1 });
    ok('replaying the now-stale version → 409 (no silent overwrite)', r.status === 409 && r.json.code === 'PRODUCT_CHANGED', JSON.stringify(r.json));
    r = await mut('PATCH', `/admin/products/${A.id}`, session, { featured: false });
    ok('PATCH without expectedUpdatedAt still works (quick toggles in the list)', r.status === 200, r.status);
  }
  for (const [name, body] of [
    ['negative price', { priceCents: -5 }],
    ['non-integer price', { priceCents: 1.5 }],
    ['string price', { priceCents: '10; DROP' }],
    ['huge price', { priceCents: 10 ** 12 }],
    ['invalid status enum', { status: 'ADMIN' }],
    ['name too long', { name: 'x'.repeat(500) }],
  ]) {
    r = await mut('PATCH', `/admin/products/${A.id}`, session, body);
    ok(`validation: ${name} → 400`, r.status === 400, JSON.stringify(r.json));
  }
  // __proto__/constructor keys must be inert: rejected or ignored, never applied to the product or to Object.prototype
  r = await mut('PATCH', `/admin/products/${A.id}`, session, JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}},"name":"Sec Test Piece"}'));
  ok('prototype-pollution keys are inert (400 or ignored, product unchanged)', (r.status === 400 || r.status === 200) && (r.status === 400 || (r.json.name === 'Sec Test Piece' && !('isAdmin' in r.json))), JSON.stringify(r.json).slice(0, 200));
  r = await call('GET', `/admin/products/${A.id}`, { cookie: session });
  ok('server still behaves normally after the pollution attempt', r.status === 200 && r.json.id === A.id, r.status);

  // Stored XSS payloads are stored verbatim as data (React escapes on render) and never executed by the API
  r = await mut('PATCH', `/admin/products/${A.id}`, session, { description: '<img src=x onerror=alert(1)>' });
  ok('HTML in description is accepted as plain data (escaped by the UI)', r.status === 200 && r.json.description.includes('<img'), r.status);

  // Uploads
  r = await mut('POST', `/admin/products/${A.id}/images`, session, fileForm(Buffer.from('<?php system($_GET[0]); ?>........'), 'shell.php', 'image/png'));
  ok('upload: PHP disguised as PNG → 415', r.status === 415, r.status);
  r = await mut('POST', `/admin/products/${A.id}/images`, session, fileForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'image/svg+xml'));
  ok('upload: SVG (script vector) → 415', r.status === 415, r.status);
  r = await mut('POST', `/admin/products/${A.id}/images`, session, fileForm(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64)]), 'x.gif', 'image/gif'));
  ok('upload: GIF → 415', r.status === 415, r.status);
  r = await mut('POST', `/admin/products/${A.id}/images`, session, fileForm(Buffer.alloc(5 * 1024 * 1024, 1), 'big.png', 'image/png'));
  ok('upload: 5 MB file → 413', r.status === 413, r.status);
  r = await mut('POST', `/admin/products/${A.id}/images`, session);
  ok('upload: no file → 400', r.status === 400, r.status);
  r = await mut('POST', `/admin/products/${A.id}/images`, session, png('../../../etc/passwd.png'));
  ok('upload: traversal in filename ignored, server-generated id', r.status === 201 && /^\/api\/images\/[a-z0-9]+$/.test(r.json.url), JSON.stringify(r.json));
  const imgA = r.json;

  // Images live in the database and are served by GET /images/:id
  r = await call('GET', `/images/${imgA.id}`);
  ok('image served from the database → 200 image/png', r.status === 200 && r.headers.get('content-type') === 'image/png', `${r.status} ${r.headers.get('content-type')}`);
  const imgRes = await fetch(`${API}/images/${imgA.id}`);
  const imgBytes = Buffer.from(await imgRes.arrayBuffer());
  ok('image bytes round-trip exactly (stored as bytea)', imgBytes.equals(PNG), `${imgBytes.length} vs ${PNG.length}`);
  ok('image response: nosniff + public cache (browser + CDN) + ETag', imgRes.headers.get('x-content-type-options') === 'nosniff' && /public/.test(imgRes.headers.get('cache-control') || '') && /s-maxage/.test(imgRes.headers.get('cache-control') || '') && !!imgRes.headers.get('etag'), imgRes.headers.get('cache-control'));
  ok('image response: sandboxed CSP', /sandbox/.test(imgRes.headers.get('content-security-policy') || ''));
  r = await call('GET', `/images/${imgA.id}`, { headers: { 'if-none-match': `"${imgA.id}"` } });
  ok('conditional request → 304', r.status === 304, r.status);
  r = await call('GET', `/admin/products/${A.id}`, { cookie: session });
  ok('product payload references images by url, never embeds bytes', r.json.images.every((i) => Object.keys(i).sort().join() === 'id,url') && JSON.stringify(r.json).length < 2000, JSON.stringify(r.json).length);
  r = await call('GET', '/products?category=SecTest');
  ok('public list stays small (no image bytes)', JSON.stringify(r.json).length < 5000, JSON.stringify(r.json).length);

  // IDOR-style: images/ids of one product must not be usable through another
  r = await mut('POST', '/admin/products', session, { name: 'Sec Test Piece B', description: 'd', category: 'SecTest' });
  const B = r.json;
  r = await mut('POST', `/admin/products/${B.id}/images`, session, png());
  const imgB = r.json;
  r = await mut('PUT', `/admin/products/${B.id}/images/order`, session, { ids: [imgA.id] });
  ok("reorder B using A's image id → 400", r.status === 400, JSON.stringify(r.json));
  r = await mut('DELETE', `/admin/products/${B.id}/images/${imgA.id}`, session);
  ok("delete A's image through product B → 404", r.status === 404, r.status);
  r = await call('GET', `/admin/products/${A.id}`, { cookie: session });
  ok("A's image still exists after the cross-product attempts", r.json.images?.some((i) => i.id === imgA.id), JSON.stringify(r.json.images));
  r = await mut('DELETE', `/admin/products/${B.id}/images/${imgB.id}`, session);
  ok('delete own image → 204', r.status === 204, r.status);
  r = await call('GET', `/images/${imgB.id}`);
  ok('deleted image is gone (bytes removed from the DB) → 404', r.status === 404, r.status);

  // Race: parallel uploads must not exceed the per-product limit
  r = await mut('POST', '/admin/products', session, { name: 'Sec Race', description: 'd', category: 'SecTest' });
  const R = r.json;
  const results = await Promise.all(Array.from({ length: 14 }, () => mut('POST', `/admin/products/${R.id}/images`, session, png())));
  const created = results.filter((x) => x.status === 201).length;
  ok('14 parallel uploads → exactly 10 stored (limit holds under concurrency)', created === 10, `created=${created}`);
  r = await call('GET', `/admin/products/${R.id}`, { cookie: session });
  ok('stored image count is 10', r.json.images.length === 10, r.json.images.length);
  await mut('DELETE', `/admin/products/${R.id}`, session);

  // Hidden products are not public
  r = await mut('PATCH', `/admin/products/${A.id}`, session, { status: 'HIDDEN' });
  r = await call('GET', `/products/${A.slug}`);
  ok('HIDDEN product → 404 on the public API', r.status === 404, r.status);
  r = await call('GET', '/products?category=SecTest');
  ok('HIDDEN product absent from public list', !r.json.items.some((p) => p.id === A.id), JSON.stringify(r.json.items?.map((p) => p.slug)));
  r = await call('GET', `/images/${imgA.id}`);
  ok("photo of a HIDDEN product → 404 for the public (no leak via a known id)", r.status === 404, r.status);
  r = await call('GET', `/images/${imgA.id}`, { cookie: session });
  ok('photo of a HIDDEN product → 200 for the logged-in admin (panel preview keeps working)', r.status === 200, r.status);
  ok('...and that response is private/no-store (a shared cache can never serve it to the public)', /private/.test(r.headers.get('cache-control') || '') && /no-store/.test(r.headers.get('cache-control') || ''), r.headers.get('cache-control'));
  r = await mut('PATCH', `/admin/products/${A.id}`, session, { status: 'AVAILABLE' });
  r = await call('GET', `/images/${imgA.id}`);
  ok('photo is public again once the product is AVAILABLE', r.status === 200, r.status);
  r = await call('GET', `/products/${A.slug}`);
  ok('AVAILABLE product visible again', r.status === 200, r.status);
  ok('public product payload has no admin-only fields', !('passwordHash' in r.json) && !('storageKey' in r.json));

  // Cleanup (deleting a product must also delete its image bytes)
  for (const p of [A, B]) {
    r = await mut('DELETE', `/admin/products/${p.id}`, session);
    ok(`cleanup: delete ${p.slug}`, r.status === 204, r.status);
  }
  r = await call('GET', `/images/${imgA.id}`);
  ok("deleting a product cascades to its image bytes → 404", r.status === 404, r.status);

  // ---- Site settings (WhatsApp, SMS, Email) ----
  r = await call('GET', '/settings/public');
  ok(
    'GET /settings/public is open and exposes exactly whatsapp+sms+email+templates (no admin-only fields)',
    r.status === 200 && Object.keys(r.json).sort().join() === 'email,sms,templates,whatsapp',
    JSON.stringify(r.json),
  );
  r = await call('GET', '/admin/settings', { cookie: session });
  const original = { whatsapp: r.json.whatsapp, sms: r.json.sms, email: r.json.email, templates: r.json.templates };
  ok(
    'GET /admin/settings → 200',
    r.status === 200 &&
      typeof original.whatsapp === 'string' &&
      typeof original.sms === 'string' &&
      typeof original.email === 'string' &&
      typeof original.templates === 'object' &&
      original.templates !== null,
    JSON.stringify(r.json),
  );
  for (const [input, expected] of [['+55 (11) 99999-9999', '5511999999999'], ['5511988887777', '5511988887777'], ['https://wa.me/5511977776666', '5511977776666'], ['https://api.whatsapp.com/send?phone=5511966665555&text=hi', '5511966665555']]) {
    r = await mut('PUT', '/admin/settings', session, { whatsapp: input });
    ok(`whatsapp "${input.slice(0, 32)}" is normalized to digits only`, r.status === 200 && r.json.whatsapp === expected, JSON.stringify(r.json));
  }
  r = await call('GET', '/settings/public');
  ok('the public endpoint reflects the saved number (whole site follows it)', r.json.whatsapp === '5511966665555', JSON.stringify(r.json));
  for (const bad of ['https://evil.example/5511999999999', 'http://wa.me.evil.example/5511999999999', 'javascript:alert(1)', 'data:text/html,<script>1</script>', '<script>alert(1)</script>', '123', '0123456789012', '55119999999999999999', 'call me maybe', 'https://wa.me/', 'ftp://wa.me/5511999999999']) {
    r = await mut('PUT', '/admin/settings', session, { whatsapp: bad });
    ok(`whatsapp rejected: ${bad.slice(0, 40)}`, r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }
  r = await mut('PUT', '/admin/settings', session, { whatsapp: 'x'.repeat(500) });
  ok('oversized whatsapp value → 400', r.status === 400, r.status);

  // SMS phone: same digits-only rule as WhatsApp, but no wa.me link accepted (a plain phone number)
  for (const [input, expected] of [['+55 (11) 98888-7777', '5511988887777'], ['5511977776666', '5511977776666']]) {
    r = await mut('PUT', '/admin/settings', session, { sms: input });
    ok(`sms "${input}" is normalized to digits only`, r.status === 200 && r.json.sms === expected, JSON.stringify(r.json));
  }
  for (const bad of ['https://wa.me/5511999999999', 'javascript:alert(1)', '123', '55119999999999999999', 'call me maybe']) {
    r = await mut('PUT', '/admin/settings', session, { sms: bad });
    ok(`sms rejected: ${bad.slice(0, 40)}`, r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }
  r = await mut('PUT', '/admin/settings', session, { sms: '' });
  ok('empty sms clears the field (hides the button) → 200', r.status === 200 && r.json.sms === '', JSON.stringify(r.json));

  // Contact email
  for (const good of ['loja@abassecrystal.com', 'Loja@AbasseCrystal.com']) {
    r = await mut('PUT', '/admin/settings', session, { email: good });
    ok(`email "${good}" accepted and lower-cased`, r.status === 200 && r.json.email === good.toLowerCase(), JSON.stringify(r.json));
  }
  for (const bad of ['not-an-email', 'javascript:alert(1)', '<script>alert(1)</script>@x.com', 'a@b', 'x'.repeat(260) + '@x.com']) {
    r = await mut('PUT', '/admin/settings', session, { email: bad });
    ok(`email rejected: ${bad.slice(0, 40)}`, r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }
  r = await mut('PUT', '/admin/settings', session, { email: '' });
  ok('empty email clears the field (hides the button) → 200', r.status === 200 && r.json.email === '', JSON.stringify(r.json));

  r = await mut('PUT', '/admin/settings', session, { whatsapp: '5511999999999', evil: 1 });
  ok('unknown settings field rejected (mass assignment) → 400', r.status === 400, r.status);
  r = await call('GET', '/settings/public');
  ok('rejected inputs did not change the saved number', r.json.whatsapp === '5511966665555', JSON.stringify(r.json));

  // Message templates (admin-editable WhatsApp/SMS/email text, per language)
  r = await mut('PUT', '/admin/settings', session, {
    templates: { en: { whatsappGeneral: '  Hi from the admin!  ', emailSubjectProduct: 'A question' }, pt: { smsProduct: 'Olá, {name}?' } },
  });
  ok(
    'templates saved, trimmed, split by language',
    r.status === 200 &&
      r.json.templates.en.whatsappGeneral === 'Hi from the admin!' &&
      r.json.templates.en.emailSubjectProduct === 'A question' &&
      r.json.templates.pt.smsProduct === 'Olá, {name}?' &&
      r.json.templates.es === undefined,
    JSON.stringify(r.json),
  );
  r = await call('GET', '/settings/public');
  ok('the public endpoint reflects the saved templates (the site builds messages from them)', r.json.templates?.en?.whatsappGeneral === 'Hi from the admin!', JSON.stringify(r.json));

  // PUT replaces the whole templates blob (the admin UI always sends its full current state — see
  // updateContact), so clearing one field here means resending everything else unchanged alongside it.
  r = await mut('PUT', '/admin/settings', session, {
    templates: { en: { whatsappGeneral: '   ', emailSubjectProduct: 'A question' }, pt: { smsProduct: 'Olá, {name}?' } },
  });
  ok(
    'a whitespace-only value clears that override (falls back to the default text) without touching the rest',
    r.status === 200 && r.json.templates.en?.whatsappGeneral === undefined && r.json.templates.en?.emailSubjectProduct === 'A question' && r.json.templates.pt?.smsProduct === 'Olá, {name}?',
    JSON.stringify(r.json),
  );

  for (const bad of [
    { fr: { whatsappGeneral: 'bonjour' } }, // unknown language
    { en: { subject: 'x' } }, // unknown field name
    { en: { whatsappGeneral: 123 } }, // not a string
    { en: 'not an object' },
    { en: { emailSubjectGeneral: 'x'.repeat(151) } }, // over the subject cap
    { en: { whatsappProduct: 'x'.repeat(2001) } }, // over the body cap
  ]) {
    r = await mut('PUT', '/admin/settings', session, { templates: bad });
    ok(`templates rejected: ${JSON.stringify(bad).slice(0, 50)}`, r.status === 400 && r.json.code === 'INVALID_TEMPLATES', `${r.status} ${JSON.stringify(r.json).slice(0, 140)}`);
  }
  // The whole `templates` value itself must be an object — this is rejected by the DTO layer
  // (no custom `code`, just the framework's standard validation-error shape).
  r = await mut('PUT', '/admin/settings', session, { templates: 'not an object at all' });
  ok('templates rejected when not an object at all → 400', r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 140)}`);
  r = await call('GET', '/settings/public');
  ok('rejected template payloads did not change what was saved', r.json.templates?.pt?.smsProduct === 'Olá, {name}?', JSON.stringify(r.json));

  r = await mut('PUT', '/admin/settings', session, { whatsapp: '5511966665555' }); // templates omitted entirely
  ok('omitting templates from the PUT leaves the saved templates untouched', r.status === 200 && r.json.templates.pt?.smsProduct === 'Olá, {name}?', JSON.stringify(r.json));

  await mut('PUT', '/admin/settings', session, original);
  r = await call('GET', '/settings/public');
  ok('templates restored to their original state', JSON.stringify(r.json.templates) === JSON.stringify(original.templates), JSON.stringify(r.json.templates));

  // an empty PUT (every field omitted) is valid but changes nothing: it must not pollute the audit log
  r = await call('GET', '/admin/audit-log?entityType=Settings&pageSize=1', { cookie: session });
  const auditTotalBefore = r.json.total;
  r = await mut('PUT', '/admin/settings', session, {});
  ok('empty settings update → 200, nothing changed', r.status === 200, r.status);
  r = await call('GET', '/admin/audit-log?entityType=Settings&pageSize=1', { cookie: session });
  ok('an empty settings update does not add an audit log entry', r.json.total === auditTotalBefore, `${auditTotalBefore} → ${r.json.total}`);

  // ---- Team: admins creating admins (same permissions) with step-up authentication ----
  r = await call('GET', '/admin/team', { cookie: session });
  ok('GET /admin/team lists admins, marks the current one, exposes no hashes', r.status === 200 && r.json.some((u) => u.isYou && u.username === USER) && !/hash|password/i.test(JSON.stringify(r.json).replace(/mustChangePassword/g, '')), JSON.stringify(r.json).slice(0, 200));
  const t1name = `sectest-a-${Date.now().toString(36)}`;
  const t2name = `sectest-b-${Date.now().toString(36)}`;
  r = await mut('POST', '/admin/team', session, { username: t1name, currentPassword: 'wrong-password' });
  ok('create admin with a WRONG current password → 400 (step-up auth)', r.status === 400 && r.json.code === 'WRONG_CURRENT_PASSWORD', JSON.stringify(r.json));
  r = await mut('POST', '/admin/team', session, { username: t1name });
  ok('create admin without the current password → 400', r.status === 400, r.status);
  for (const bad of ['a', 'ab', 'A B', '../etc', 'x'.repeat(40), '-start', 'name;drop', '<b>x</b>']) {
    r = await mut('POST', '/admin/team', session, { username: bad, currentPassword: PASS });
    ok(`invalid username rejected: ${bad.slice(0, 20)}`, r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  }
  r = await mut('POST', '/admin/team', session, { username: t1name, currentPassword: PASS, role: 'superadmin', mustChangePassword: false, passwordHash: 'x' });
  ok('mass assignment on admin creation (role/mustChangePassword/passwordHash) → 400', r.status === 400, JSON.stringify(r.json));
  r = await mut('POST', '/admin/team', session, { username: t1name.toUpperCase(), currentPassword: PASS });
  ok('create admin → 201 with a one-time temporary password', r.status === 201 && typeof r.json.temporaryPassword === 'string' && r.json.temporaryPassword.length >= 16 && r.json.user.username === t1name && !('passwordHash' in r.json.user), JSON.stringify(r.json).slice(0, 200));
  const T1 = r.json.user;
  const T1temp = r.json.temporaryPassword;
  r = await mut('POST', '/admin/team', session, { username: t1name, currentPassword: PASS });
  ok('duplicate username → 409 USERNAME_TAKEN', r.status === 409 && r.json.code === 'USERNAME_TAKEN', JSON.stringify(r.json));

  // the new admin goes through the forced first-login flow
  r = await login(t1name, T1temp);
  ok('new admin can log in with the temporary password (mustChangePassword)', r.status === 200 && r.json.mustChangePassword === true, JSON.stringify(r.json));
  let t1session = r.cookie;
  r = await call('GET', '/admin/team', { cookie: t1session });
  ok('new admin is blocked from admin routes until the password is changed → 403', r.status === 403 && r.json.code === 'PASSWORD_CHANGE_REQUIRED', JSON.stringify(r.json));
  const T1pass = 'Ne3wAdmin-Passw0rd!';
  r = await mut('POST', '/auth/change-password', t1session, { currentPassword: T1temp, newPassword: T1pass });
  ok('new admin sets a permanent password', r.status === 200, JSON.stringify(r.json));
  t1session = r.cookie;
  r = await call('GET', '/admin/products/stats', { cookie: t1session });
  ok('new admin then has the same permissions (products/stats → 200)', r.status === 200, r.status);
  r = await mut('POST', '/admin/team', t1session, { username: t2name, currentPassword: T1pass });
  ok('an admin created by an admin can create admins too (same permissions) → 201', r.status === 201, JSON.stringify(r.json).slice(0, 120));
  const T2 = r.json.user;
  r = await call('GET', '/admin/team', { cookie: session });
  ok('team list shows who created whom', r.json.find((u) => u.username === t2name)?.createdBy === t1name, JSON.stringify(r.json.map((u) => [u.username, u.createdBy])));

  // deleting
  r = await mut('POST', `/admin/team/${T1.id}/delete`, t1session, { currentPassword: T1pass });
  ok('an admin cannot delete their own account → 400 CANNOT_DELETE_SELF', r.status === 400 && r.json.code === 'CANNOT_DELETE_SELF', JSON.stringify(r.json));
  r = await mut('POST', `/admin/team/${T2.id}/delete`, session, { currentPassword: 'wrong-password' });
  ok('delete with a wrong current password → 400 and nothing is deleted', r.status === 400, r.status);
  r = await mut('POST', '/admin/team/clx0000000000000000000000/delete', session, { currentPassword: PASS });
  ok('delete unknown admin → 404', r.status === 404, r.status);
  r = await mut('POST', `/admin/team/${T2.id}/delete`, session, { currentPassword: PASS });
  ok('delete another admin with the right password → 204', r.status === 204, r.status);
  r = await login(t2name, 'anything');
  ok('the deleted admin can no longer log in', r.status === 401, r.status);

  // resetting passwords
  r = await mut('POST', `/admin/team/${T1.id}/reset-password`, session, { currentPassword: 'wrong-password' });
  ok('reset password with a wrong current password → 400', r.status === 400, r.status);
  r = await mut('POST', `/admin/team/${T1.id}/reset-password`, session, { currentPassword: PASS });
  ok('reset another admin password → 200 with a new temporary password', r.status === 200 && r.json.temporaryPassword?.length >= 16, JSON.stringify(r.json));
  const T1temp2 = r.json.temporaryPassword;
  r = await call('GET', '/admin/products/stats', { cookie: t1session });
  ok("the reset admin's existing session is revoked → 401", r.status === 401, r.status);
  r = await login(t1name, T1pass);
  ok('the old password stops working after a reset', r.status === 401, r.status);
  r = await login(t1name, T1temp2);
  ok('the new temporary password works and forces a password change again', r.status === 200 && r.json.mustChangePassword === true, JSON.stringify(r.json));
  const myId = (await call('GET', '/admin/team', { cookie: session })).json.find((u) => u.isYou).id;
  r = await mut('POST', `/admin/team/${myId}/reset-password`, session, { currentPassword: PASS });
  ok('resetting your own password through the team route is refused → 400', r.status === 400 && r.json.code === 'USE_CHANGE_PASSWORD', JSON.stringify(r.json));

  // cleanup
  r = await mut('POST', `/admin/team/${T1.id}/delete`, session, { currentPassword: PASS });
  ok('cleanup: delete test admin', r.status === 204, r.status);
  r = await call('GET', '/admin/team', { cookie: session });
  ok('cleanup: only real admins remain', !r.json.some((u) => u.username.startsWith('sectest-')), JSON.stringify(r.json.map((u) => u.username)));

  // ---- Sales, stock, customers, finance, WhatsApp clicks ----
  const tag = Date.now().toString(36);
  const pc = await mut('POST', '/admin/products', session, { name: `Sec Piece ${tag}`, description: 'd', category: 'SecSales', priceCents: 10000, saleMode: 'UNIT', stockQuantity: 3, costCents: 4000 });
  ok('create UNIT product with stock and cost', pc.status === 201 && pc.json.stockQuantity === 3 && pc.json.costCents === 4000 && pc.json.saleMode === 'UNIT', JSON.stringify(pc.json));
  const P1 = pc.json;
  const pw = await mut('POST', '/admin/products', session, { name: `Sec Kilo ${tag}`, description: 'd', category: 'SecSales', priceCents: 50000, saleMode: 'WEIGHT', stockGrams: 2000, costCents: 20000 });
  ok('create WEIGHT product (price per kg, stock in grams)', pw.status === 201 && pw.json.stockGrams === 2000 && pw.json.saleMode === 'WEIGHT', JSON.stringify(pw.json));
  const P2 = pw.json;
  const pn = await mut('POST', '/admin/products', session, { name: `Sec NoPrice ${tag}`, description: 'd', category: 'SecSales', stockQuantity: 5 });
  const P3 = pn.json;

  // the cost and the exact stock must never reach the public API
  r = await call('GET', `/products/${P1.slug}`);
  ok('PUBLIC product payload never exposes costCents', !('costCents' in r.json), JSON.stringify(r.json).slice(0, 300));
  ok('PUBLIC product payload never exposes the exact stock', !('stockQuantity' in r.json) && !('stockGrams' in r.json) && r.json.inStock === true && r.json.saleMode === 'UNIT', JSON.stringify(r.json).slice(0, 300));
  r = await call('GET', '/products?category=SecSales');
  ok('PUBLIC list never exposes cost or stock', r.json.items.every((p) => !('costCents' in p) && !('stockQuantity' in p) && !('stockGrams' in p)), JSON.stringify(r.json.items[0]).slice(0, 200));
  r = await call('GET', `/admin/products/${P1.id}`, { cookie: session });
  ok('admin payload includes cost and stock', r.json.costCents === 4000 && r.json.stockQuantity === 3);
  for (const [name, body] of [['negative stock', { stockQuantity: -1 }], ['bad saleMode', { saleMode: 'BOX' }], ['stock as string', { stockGrams: '10; DROP' }], ['huge cost', { costCents: 10 ** 12 }]]) {
    r = await mut('PATCH', `/admin/products/${P1.id}`, session, body);
    ok(`product validation: ${name} → 400`, r.status === 400, r.status);
  }

  // duplicate: a quick starting point for size/color variants of an existing crystal
  r = await mut('POST', `/admin/products/${P1.id}/duplicate`, session);
  ok('duplicate product → 201', r.status === 201 && r.json.id !== P1.id, JSON.stringify(r.json).slice(0, 200));
  const dup = r.json;
  ok('duplicate keeps catalog fields but is renamed, hidden and reset to zero stock', dup.name === `${P1.name} (cópia)` && dup.slug !== P1.slug && dup.status === 'HIDDEN' && dup.stockQuantity === 0 && dup.costCents === P1.costCents, JSON.stringify(dup).slice(0, 300));
  ok('duplicate does not copy images', Array.isArray(dup.images) && dup.images.length === 0, JSON.stringify(dup.images));
  r = await mut('POST', '/admin/products/clxxxxxxxxxxxxxxxxxxxxxxxx/duplicate', session);
  ok('duplicate unknown product → 404', r.status === 404, r.status);
  await mut('DELETE', `/admin/products/${dup.id}`, session);

  // slug race: two products created at the exact same instant with the identical name must never 500
  // (the slug-uniqueness check and the insert are two separate steps; the DB's unique constraint is the
  // real guard, and a P2002 on it must surface as a clean 409, not a raw server error)
  {
    const raceName = `Sec Race ${tag}`;
    const raceBody = { name: raceName, description: 'd', category: 'SecSales' };
    const [ra, rb] = await Promise.all([mut('POST', '/admin/products', session, raceBody), mut('POST', '/admin/products', session, raceBody)]);
    ok('creating two products with the identical name at once never 500s', ra.status !== 500 && rb.status !== 500, `${ra.status} ${rb.status}`);
    ok(
      'each outcome is either 201 (a free slug) or a clean 409 SLUG_TAKEN (the race), never anything else',
      [ra, rb].every((x) => x.status === 201 || (x.status === 409 && x.json.code === 'SLUG_TAKEN')),
      JSON.stringify([ra, rb].map((x) => ({ status: x.status, code: x.json?.code }))),
    );
    for (const x of [ra, rb]) if (x.status === 201) await mut('DELETE', `/admin/products/${x.json.id}`, session);
  }

  // customers
  r = await mut('POST', '/admin/customers', session, { name: `Cust ${tag}`, email: 'not-an-email' });
  ok('customer with an invalid e-mail → 400', r.status === 400, r.status);
  r = await mut('POST', '/admin/customers', session, { name: `Cust ${tag}`, country: 'USA' });
  ok('customer with a non ISO country → 400', r.status === 400, r.status);
  r = await mut('POST', '/admin/customers', session, { name: `Cust ${tag}`, id: 'x', createdAt: '2000-01-01' });
  ok('customer mass assignment (id/createdAt) → 400', r.status === 400, r.status);
  r = await mut('POST', '/admin/customers', session, { name: `Cust ${tag}`, email: 'buyer@example.com', phone: '+1 555 123 4567', addressLine1: '1 Main St', city: 'Austin', region: 'TX', postalCode: '78701', country: 'us' });
  ok('create customer (country normalized to ISO upper case)', r.status === 201 && r.json.country === 'US', JSON.stringify(r.json));
  const C1 = r.json;

  // a click that ends in a sale
  const ref = 'K7M2QX';
  r = await call('POST', '/track/click', { body: { ref, source: 'PRODUCT_PAGE', path: `/products/${P1.slug}`, productSlug: P1.slug, locale: 'es' }, headers: { origin: ORIGIN } });
  ok('public click tracking accepts a valid click (204, no login)', r.status === 204, `${r.status} ${JSON.stringify(r.json)}`);

  // registering a sale
  const goodSale = { customerId: C1.id, paymentMethod: 'PIX', shippingMethod: 'DHL Express', shippingCostCents: 3000, discountCents: 1000, clickRef: ref, items: [{ productId: P1.id, quantity: 2 }, { productId: P2.id, quantity: 500 }] };
  r = await mut('POST', '/admin/sales', session, { ...goodSale, totalCents: 1, subtotalCents: 1 });
  ok('client-supplied totals are refused (server computes the money) → 400', r.status === 400, JSON.stringify(r.json).slice(0, 150));
  r = await mut('POST', '/admin/sales', session, goodSale);
  ok('register a sale → 201', r.status === 201, JSON.stringify(r.json).slice(0, 300));
  const S1 = r.json;
  ok('sale money is computed on the server: 2×100,00 + 0,5 kg×500,00 − 10,00 discount + 30,00 shipping', S1.subtotalCents === 45000 && S1.totalCents === 47000, `${S1.subtotalCents} ${S1.totalCents}`);
  ok('sale keeps the customer name and the destination address as snapshots (worldwide: country US)', S1.customerName === `Cust ${tag}` && S1.shipTo?.country === 'US' && S1.shipTo?.city === 'Austin', JSON.stringify(S1.shipTo));
  ok('sale items keep name, mode and per-line totals', S1.items.length === 2 && S1.items.some((i) => i.mode === 'WEIGHT' && i.quantity === 500 && i.totalCents === 25000) && S1.items.some((i) => i.mode === 'UNIT' && i.totalCents === 20000));
  ok('sale has a human order number', Number.isInteger(S1.number) && S1.number > 0);
  ok('sales are stored in US dollars; paid in USD by default (no rate, received = total)', S1.currency === 'USD' && S1.paidCurrency === 'USD' && S1.fxRate === null && S1.paidAmountCents === S1.totalCents, JSON.stringify({ c: S1.currency, p: S1.paidCurrency, f: S1.fxRate, a: S1.paidAmountCents }));
  {
    // payment currency: BRL records the reais received and the rate in force; its own product so the stock checks above stay exact
    const fxProbe = await call('GET', '/fx/usd-brl');
    const fxOk = fxProbe.status === 200;
    const pr = await mut('POST', '/admin/products', session, { name: `Sec FX ${tag}`, description: 'd', category: 'SecTest', priceCents: 10000, stockQuantity: 5 });
    const PF = pr.json;
    const base = { customerId: C1.id, paymentMethod: 'PIX', items: [{ productId: PF.id, quantity: 1 }] };
    r = await mut('POST', '/admin/sales', session, { ...base, paidCurrency: 'EUR' });
    ok('an unsupported paid currency → 400', r.status === 400, r.status);
    r = await mut('POST', '/admin/sales', session, { ...base, paidAmountCents: 5000 });
    ok('a received amount without paidCurrency BRL → 400 PAID_AMOUNT_NEEDS_BRL', r.status === 400 && r.json.code === 'PAID_AMOUNT_NEEDS_BRL', JSON.stringify(r.json));
    if (!fxOk) {
      skip('sales paid in BRL', 'no exchange rate available (Banco Central and AwesomeAPI unreachable)');
    } else {
      r = await mut('POST', '/admin/sales', session, { ...base, paidCurrency: 'BRL' });
      const sb = r.json;
      ok('paid in BRL: the dollar total is kept and the reais equivalent uses the recorded rate', r.status === 201 && sb.currency === 'USD' && sb.totalCents === 10000 && sb.paidCurrency === 'BRL' && sb.fxRate > 1 && sb.paidAmountCents === Math.round(10000 * sb.fxRate), JSON.stringify(sb).slice(0, 260));
      r = await mut('POST', '/admin/sales', session, { ...base, paidCurrency: 'BRL', paidAmountCents: 50000 });
      ok('paid in BRL with a negotiated amount: that amount is kept (and the rate is still recorded)', r.status === 201 && r.json.paidAmountCents === 50000 && r.json.fxRate > 1 && r.json.totalCents === 10000, JSON.stringify(r.json).slice(0, 200));
    }
    await mut('DELETE', `/admin/products/${PF.id}`, session);
  }
  r = await call('GET', `/admin/products/${P1.id}`, { cookie: session });
  const afterP1 = r.json;
  r = await call('GET', `/admin/products/${P2.id}`, { cookie: session });
  ok('stock is taken out automatically (pieces and grams)', afterP1.stockQuantity === 1 && r.json.stockGrams === 1500, `${afterP1.stockQuantity} ${r.json.stockGrams}`);
  r = await mut('POST', '/admin/analytics/confirm', session, { ref });
  ok('a sale linked to a WhatsApp code confirms that conversation', r.status === 200 && r.json.alreadyConfirmed === true, JSON.stringify(r.json));

  // validation and business rules
  const base = { customerId: C1.id, paymentMethod: 'PIX', items: [{ productId: P1.id, quantity: 1 }] };
  for (const [name, body, status] of [
    ['no items', { ...base, items: [] }, 400],
    ['zero quantity', { ...base, items: [{ productId: P1.id, quantity: 0 }] }, 400],
    ['negative quantity', { ...base, items: [{ productId: P1.id, quantity: -3 }] }, 400],
    ['huge quantity', { ...base, items: [{ productId: P1.id, quantity: 10 ** 9 }] }, 400],
    ['negative negotiated price', { ...base, items: [{ productId: P1.id, quantity: 1, unitPriceCents: -1 }] }, 400],
    ['unknown product', { ...base, items: [{ productId: 'clx0000000000000000000000', quantity: 1 }] }, 404],
    ['unknown payment method', { ...base, paymentMethod: 'BITCOIN' }, 400],
    ['invalid WhatsApp reference', { ...base, clickRef: 'abc' }, 400],
    ['sale starting cancelled', { ...base, status: 'CANCELLED' }, 400],
    ['no customer at all', { paymentMethod: 'PIX', items: base.items }, 400],
    ['unknown customer', { ...base, customerId: 'clx0000000000000000000000' }, 404],
    ['discount above the subtotal', { ...base, discountCents: 999999 }, 400],
    ['product without price and no override', { ...base, items: [{ productId: P3.id, quantity: 1 }] }, 400],
    ['more than the stock', { ...base, items: [{ productId: P1.id, quantity: 5 }] }, 409],
    ['weight above the stock', { ...base, items: [{ productId: P2.id, quantity: 999999 }] }, 409],
    ['address with an invalid country', { ...base, shipTo: { line1: 'x', city: 'y', country: 'Brazil' } }, 400],
    ['XSS-looking tracking code is data, not code (accepted)', { ...base, trackingCode: '<script>alert(1)</script>' }, 201],
  ]) {
    r = await mut('POST', '/admin/sales', session, body);
    ok(`sale validation: ${name} → ${status}`, r.status === status, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  }
  // that last accepted sale consumed 1 unit of P1 (the last one): restore the numbers for the next checks
  r = await call('GET', `/admin/products/${P1.id}`, { cookie: session });
  ok('a product that runs out flips to SOLD_OUT automatically', r.json.stockQuantity === 0 && r.json.status === 'SOLD_OUT', `${r.json.stockQuantity} ${r.json.status}`);
  r = await call('GET', `/products/${P1.slug}`);
  ok('public API shows it as sold out (inStock=false)', r.json.inStock === false && r.json.status === 'SOLD_OUT', JSON.stringify(r.json).slice(0, 200));

  // no overselling under concurrency: 8 parallel sales for the 1500 g left → only the ones that fit succeed
  const race = await Promise.all(Array.from({ length: 8 }, () => mut('POST', '/admin/sales', session, { customerId: C1.id, paymentMethod: 'PIX', items: [{ productId: P2.id, quantity: 400 }] })));
  const okRaces = race.filter((x) => x.status === 201).length;
  r = await call('GET', `/admin/products/${P2.id}`, { cookie: session });
  ok('8 parallel sales of 400 g with 1500 g in stock → exactly 3 succeed (no overselling)', okRaces === 3 && r.json.stockGrams === 300, `ok=${okRaces} left=${r.json.stockGrams}`);
  ok('the losers get a clean 409 INSUFFICIENT_STOCK', race.filter((x) => x.status !== 201).every((x) => x.status === 409 && x.json.code === 'INSUFFICIENT_STOCK'), race.map((x) => x.status).join());

  // updating and cancelling
  r = await mut('PATCH', `/admin/sales/${S1.id}`, session, { trackingCode: 'EE123456789BR', status: 'SHIPPED', shippingMethod: 'FedEx' });
  ok('update tracking code, method and status', r.status === 200 && r.json.trackingCode === 'EE123456789BR' && r.json.status === 'SHIPPED', JSON.stringify(r.json).slice(0, 200));
  r = await mut('PATCH', `/admin/sales/${S1.id}`, session, { totalCents: 1, items: [], customerName: 'x' });
  ok('sale update mass assignment (totalCents/items/customerName) → 400', r.status === 400, r.status);
  r = await mut('PATCH', `/admin/sales/${S1.id}`, session, { status: 'CANCELLED' });
  ok('cancel a sale', r.status === 200 && r.json.status === 'CANCELLED', JSON.stringify(r.json).slice(0, 120));
  r = await call('GET', `/admin/products/${P1.id}`, { cookie: session });
  const cancelP1 = r.json;
  r = await call('GET', `/admin/products/${P2.id}`, { cookie: session });
  ok('cancelling gives the stock back (pieces + grams) and re-lists the product', cancelP1.stockQuantity === 2 && cancelP1.status === 'AVAILABLE' && r.json.stockGrams === 800, `${cancelP1.stockQuantity} ${cancelP1.status} ${r.json.stockGrams}`);
  r = await mut('PATCH', `/admin/sales/${S1.id}`, session, { status: 'CANCELLED' });
  r = await call('GET', `/admin/products/${P1.id}`, { cookie: session });
  ok('cancelling twice does NOT restock twice', r.json.stockQuantity === 2, r.json.stockQuantity);
  r = await mut('PATCH', `/admin/sales/${S1.id}`, session, { status: 'PAID' });
  ok('a cancelled sale cannot be reopened → 409', r.status === 409 && r.json.code === 'SALE_CANCELLED', JSON.stringify(r.json));
  r = await mut('PATCH', '/admin/sales/clx0000000000000000000000', session, { status: 'PAID' });
  ok('update unknown sale → 404', r.status === 404, r.status);

  // concurrent cancellation must give the stock back exactly once (double click / two admins)
  r = await call('GET', `/admin/products/${P2.id}`, { cookie: session });
  const gramsBefore = r.json.stockGrams;
  const SR = (await mut('POST', '/admin/sales', session, { customerId: C1.id, paymentMethod: 'PIX', items: [{ productId: P2.id, quantity: 100 }] })).json;
  const cancels = await Promise.all(Array.from({ length: 6 }, () => mut('PATCH', `/admin/sales/${SR.id}`, session, { status: 'CANCELLED' })));
  r = await call('GET', `/admin/products/${P2.id}`, { cookie: session });
  ok('6 parallel cancellations of one sale restock exactly once (no inventory inflation)', r.json.stockGrams === gramsBefore && cancels.every((x) => x.status === 200), `before=${gramsBefore} after=${r.json.stockGrams} ${cancels.map((x) => x.status).join()}`);

  // absurd dates must be a clean 400, never a 500
  for (const [name, body] of [
    ['year 0000', { soldAt: '0000-01-01T00:00:00Z' }],
    ['year 0001 with offset', { soldAt: '0001-01-01T00:00:00+14:00' }],
    ['year 9999', { soldAt: '9999-12-31T23:59:59Z' }],
    ['not a date', { soldAt: '2026-13-45' }],
  ]) {
    r = await mut('POST', '/admin/sales', session, { customerId: C1.id, paymentMethod: 'PIX', items: [{ productId: P3.id, quantity: 1, unitPriceCents: 100 }], ...body });
    ok(`sale date ${name} → never 500`, r.status < 500, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
    if (r.status === 201) await mut('PATCH', `/admin/sales/${r.json.id}`, session, { status: 'CANCELLED' });
  }
  for (const q of ['from=0000-01-01', 'to=9999-12-31', 'from=0001-01-01T00:00:00Z&to=0002-01-01T00:00:00Z']) {
    r = await call('GET', `/admin/sales?${q}`, { cookie: session });
    ok(`sales filter ${q.slice(0, 28)} → never 500`, r.status < 500, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  }

  // photos of a sale
  const S2 = (await mut('POST', '/admin/sales', session, { customerId: C1.id, paymentMethod: 'WISE', items: [{ productId: P1.id, quantity: 1, unitPriceCents: 9000 }] })).json;
  ok('negotiated unit price is honoured', S2.items?.[0]?.unitPriceCents === 9000 && S2.totalCents === 9000, JSON.stringify(S2).slice(0, 200));
  r = await mut('POST', `/admin/sales/${S2.id}/photos`, session, fileForm(Buffer.from('<?php system($_GET[0]); ?>........'), 'x.png', 'image/png'));
  ok('sale photo: fake image → 415', r.status === 415, r.status);
  r = await mut('POST', `/admin/sales/${S2.id}/photos`, session, fileForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'image/svg+xml'));
  ok('sale photo: SVG → 415', r.status === 415, r.status);
  r = await mut('POST', `/admin/sales/${S2.id}/photos`, session, png('../../evil.png'));
  ok('sale photo: valid PNG → 201', r.status === 201 && /^\/api\/admin\/sales\/photos\/[a-z0-9]+$/.test(r.json.url), JSON.stringify(r.json));
  const photo = r.json;
  r = await call('GET', `/admin/sales/photos/${photo.id}`, { cookie: session });
  ok('sale photo is served to the admin, private and sandboxed', r.status === 200 && r.headers.get('content-type') === 'image/png' && /no-store/.test(r.headers.get('cache-control') || '') && r.headers.get('x-content-type-options') === 'nosniff');
  r = await call('GET', `/admin/sales/photos/${photo.id}`);
  ok('sale photo is NOT reachable without a session → 401', r.status === 401, r.status);
  r = await call('GET', `/images/${photo.id}`);
  ok('sale photos are not exposed by the public image route → 404', r.status === 404, r.status);
  r = await mut('DELETE', `/admin/sales/${S1.id}/photos/${photo.id}`, session);
  ok("removing a photo through another sale → 404", r.status === 404, r.status);
  let extra = 0;
  for (let i = 0; i < 7; i++) if ((await mut('POST', `/admin/sales/${S2.id}/photos`, session, png())).status === 201) extra++;
  ok('at most 6 photos per sale', extra === 5, `extra=${extra}`);

  // finance
  r = await call('GET', '/admin/finance/summary?range=30', { cookie: session });
  ok('finance summary → 200 with the expected shape', r.status === 200 && ['revenueCents', 'orders', 'averageTicketCents', 'series', 'byCategory', 'topProducts', 'byCountry', 'funnel', 'costCoveragePct'].every((k) => k in r.json), JSON.stringify(Object.keys(r.json)));
  const rev0 = r.json.revenueCents;
  ok('cancelled sales do not count as revenue', typeof rev0 === 'number' && rev0 >= 9000, rev0);
  r = await mut('PATCH', `/admin/sales/${S2.id}`, session, { status: 'CANCELLED' });
  r = await call('GET', '/admin/finance/summary?range=30', { cookie: session });
  ok('cancelling a sale removes it from the revenue', r.json.revenueCents === rev0 - 9000, `${rev0} → ${r.json.revenueCents}`);
  r = await call('GET', '/admin/finance/summary?range=abc', { cookie: session });
  ok('finance summary rejects an invalid range → 400', r.status === 400, r.status);
  for (const range of ['7', '90', '365', 'all']) {
    r = await call('GET', `/admin/finance/summary?range=${range}`, { cookie: session });
    ok(`finance summary range=${range} works`, r.status === 200 && Array.isArray(r.json.series), r.status);
  }

  // Finance summary now aggregates in SQL (SUM/GROUP BY) instead of loading every sale+item and
  // reducing in JS; the money math (a discount spread proportionally over a sale's items) is the same
  // either way, so these probe the exact cases where SQL's ROUND(numeric) and JS's Math.round could in
  // principle disagree: a .5 tie split across items, and a WEIGHT-mode cost calc that lands on .5 too.
  {
    const rtag = `rnd-${tag}`;
    const before = await call('GET', '/admin/finance/summary?range=365', { cookie: session });

    // R1: two R$0,01 items sharing a R$0,01 discount — factor is exactly 0.5, so each item's
    // independently-rounded revenue (0.5 → 1) is a real half-up tie, same as the WEIGHT case below.
    const ra = await mut('POST', '/admin/products', session, { name: `${rtag} A`, description: 'd', category: rtag, priceCents: 1, costCents: 1, stockQuantity: 5 });
    const rb = await mut('POST', '/admin/products', session, { name: `${rtag} B`, description: 'd', category: rtag, priceCents: 1, costCents: 1, stockQuantity: 5 });
    const custR = await mut('POST', '/admin/customers', session, { name: `Cust ${rtag}`, addressLine1: 'Teststr. 1', city: 'Berlin', country: 'DE' });
    const saleR1 = await mut('POST', '/admin/sales', session, {
      customerId: custR.json.id,
      paymentMethod: 'PIX',
      discountCents: 1,
      items: [{ productId: ra.json.id, quantity: 1 }, { productId: rb.json.id, quantity: 1 }],
    });
    ok('rounding probe: tie sale registers → 201', saleR1.status === 201, JSON.stringify(saleR1.json).slice(0, 200));

    // R2: a single WEIGHT item whose cost (R$6,67/kg × 1,5 kg = R$10,005,00) is also an exact .5 tie.
    const rc = await mut('POST', '/admin/products', session, { name: `${rtag} C`, description: 'd', category: rtag, priceCents: 100, costCents: 667, saleMode: 'WEIGHT', stockGrams: 2000 });
    const saleR2 = await mut('POST', '/admin/sales', session, {
      customerId: custR.json.id,
      paymentMethod: 'PIX',
      items: [{ productId: rc.json.id, quantity: 1500 }],
    });
    ok('rounding probe: WEIGHT-cost tie sale registers → 201', saleR2.status === 201, JSON.stringify(saleR2.json).slice(0, 200));

    const after = await call('GET', '/admin/finance/summary?range=365', { cookie: session });
    const d = (k) => after.json[k] - before.json[k];
    // totals.revenueCents is sale-level exact math (subtotal − discount), not a sum of the per-item
    // rounded values — R1 contributes net=1 (2−1), R2 contributes its (undiscounted) line total 150.
    ok('rounding probe: revenueCents delta is exact sale-level net, not the sum of rounded item revenues', d('revenueCents') === 151, d('revenueCents'));
    // cost is quantity × cost-per-unit, never discounted: R1 = 1+1 = 2; R2 = ROUND(667×1500/1000) = 1001.
    ok('rounding probe: WEIGHT cost tie (1000.5 → 1001) rounds the same as Math.round', d('costCents') === 1003, d('costCents'));
    // revenueWithCostCents isn't exposed directly, but profitCents = revenueWithCostCents - costCents is:
    // R1 contributes ROUND(0.5)+ROUND(0.5) = 1+1 = 2 to revenueWithCostCents, R2 contributes 150, so
    // profitCents' delta is (2+150) - 1003 = -851 — the same two 0.5 → 1 ties, checked indirectly.
    ok('rounding probe: two independent 0.5 → 1 ties sum to 2, matching Math.round\'s half-up behavior', d('profitCents') === -851, d('profitCents'));
    ok('rounding probe: units/grams delta matches the two UNIT pieces + 1500 g', d('units') === 2 && d('grams') === 1500, `${d('units')} ${d('grams')}`);

    // byCountry/byPayment are grouped in SQL too (shipTo->>'country' via a JOIN-free raw query);
    // "DE" is unique to this probe, so it's a clean way to check the grouping itself, not just totals.
    const deRow = after.json.byCountry.find((c) => c.country === 'DE');
    ok('rounding probe: byCountry groups the JSON shipTo field correctly', deRow && deRow.revenueCents === 151, JSON.stringify(deRow));

    await mut('PATCH', `/admin/sales/${saleR1.json.id}`, session, { status: 'CANCELLED' });
    await mut('PATCH', `/admin/sales/${saleR2.json.id}`, session, { status: 'CANCELLED' });
    for (const p of [ra, rb, rc]) await mut('DELETE', `/admin/products/${p.json.id}`, session);
    await mut('POST', `/admin/customers/${custR.json.id}/erase`, session, { currentPassword: PASS });
  }

  // Product renamed between two sales: topProducts must show ONE combined entry under the product's
  // CURRENT name (the SQL query picks the most recent productName via array_agg ORDER BY soldAt DESC) —
  // a deliberate, documented difference from the old code's "whichever name the JS loop saw first".
  // Priced far above anything else in this suite so it's always inside the top-8 ranking.
  {
    const rtag = `rename-${tag}`;
    const custR = await mut('POST', '/admin/customers', session, { name: `Cust ${rtag}` });
    const prod = await mut('POST', '/admin/products', session, { name: `${rtag} Antigo`, description: 'd', category: rtag, priceCents: 99_999_900, stockQuantity: 2 });
    const sale1 = await mut('POST', '/admin/sales', session, { customerId: custR.json.id, paymentMethod: 'PIX', items: [{ productId: prod.json.id, quantity: 1 }] });
    ok('renamed product: sale 1 registers → 201', sale1.status === 201, JSON.stringify(sale1.json).slice(0, 200));
    const renamed = await mut('PATCH', `/admin/products/${prod.json.id}`, session, { name: `${rtag} Novo` });
    ok('renamed product: rename → 200', renamed.status === 200, JSON.stringify(renamed.json).slice(0, 200));
    const sale2 = await mut('POST', '/admin/sales', session, { customerId: custR.json.id, paymentMethod: 'PIX', items: [{ productId: prod.json.id, quantity: 1 }] });
    ok('renamed product: sale 2 registers → 201', sale2.status === 201, JSON.stringify(sale2.json).slice(0, 200));

    r = await call('GET', '/admin/finance/summary?range=365', { cookie: session });
    const entries = r.json.topProducts.filter((p) => p.name.includes(rtag));
    ok('renamed product: exactly one combined entry in topProducts (not split by name)', entries.length === 1, JSON.stringify(entries));
    ok('renamed product: shows the CURRENT name, not the one at the time of the first sale', entries[0]?.name === `${rtag} Novo`, JSON.stringify(entries[0]));
    ok('renamed product: revenue from both sales is combined', entries[0]?.revenueCents === 99_999_900 * 2 && entries[0]?.orders === 2, JSON.stringify(entries[0]));

    await mut('PATCH', `/admin/sales/${sale1.json.id}`, session, { status: 'CANCELLED' });
    await mut('PATCH', `/admin/sales/${sale2.json.id}`, session, { status: 'CANCELLED' });
    await mut('DELETE', `/admin/products/${prod.json.id}`, session);
    await mut('POST', `/admin/customers/${custR.json.id}/erase`, session, { currentPassword: PASS });
  }

  // WhatsApp click tracking: validation of the PUBLIC endpoint
  for (const [name, body] of [
    ['bad ref (ambiguous chars)', { ref: 'O0I1AB', source: 'MENU', path: '/', locale: 'en' }],
    ['bad source', { ref: 'AAAAAA', source: 'EVIL', path: '/', locale: 'en' }],
    ['path with a query string / script', { ref: 'AAAAAA', source: 'MENU', path: '/x?a=<script>', locale: 'en' }],
    ['path not starting with a slash', { ref: 'AAAAAA', source: 'MENU', path: 'http://evil.example', locale: 'en' }],
    ['bad locale', { ref: 'AAAAAA', source: 'MENU', path: '/', locale: 'xx' }],
    ['bad slug', { ref: 'AAAAAA', source: 'MENU', path: '/', locale: 'en', productSlug: '../../etc' }],
    ['extra fields (ip / userAgent / email)', { ref: 'AAAAAA', source: 'MENU', path: '/', locale: 'en', ip: '1.2.3.4', email: 'a@b.c' }],
  ]) {
    r = await call('POST', '/track/click', { body, headers: { origin: ORIGIN } });
    ok(`click tracking rejects: ${name} → 400`, r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  }
  r = await call('POST', '/track/click', { body: { ref: 'ZZZZ22', source: 'MENU', path: '/', locale: 'pt' }, headers: { origin: 'https://evil.example' } });
  ok('click tracking refuses a foreign Origin → 403', r.status === 403, r.status);
  r = await call('POST', '/track/click', { body: { ref: 'QRQRQR', source: 'QR_CODE', path: '/q/some-slug', locale: 'pt' }, headers: { origin: ORIGIN } });
  ok('click tracking accepts source QR_CODE (printed QR redirect)', r.status === 204, `${r.status} ${JSON.stringify(r.json)}`);
  const DUP_REF = Array.from({ length: 6 }, () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 32)]).join('');
  for (let i = 0; i < 2; i++) await call('POST', '/track/click', { body: { ref: DUP_REF, source: 'HERO', path: '/', locale: 'en' }, headers: { origin: ORIGIN } });
  r = await call('GET', '/admin/analytics/clicks?days=30', { cookie: session });
  ok('click summary → totals, by source, daily; duplicates count once', r.status === 200 && r.json.total >= 2 && Array.isArray(r.json.bySource) && Array.isArray(r.json.daily), JSON.stringify(r.json).slice(0, 200));
  ok('click summary exposes no personal data (no ip / user agent)', !/"ip"|userAgent|user-agent/i.test(JSON.stringify(r.json)));
  r = await mut('POST', '/admin/analytics/confirm', session, { ref: DUP_REF });
  ok('confirm a conversation by its reference code', r.status === 200 && r.json.alreadyConfirmed === false, JSON.stringify(r.json));
  r = await mut('POST', '/admin/analytics/confirm', session, { ref: DUP_REF });
  ok('confirming again is idempotent', r.status === 200 && r.json.alreadyConfirmed === true);
  r = await mut('POST', '/admin/analytics/confirm', session, { ref: 'NOPE22' });
  ok('confirm unknown code → 404', r.status === 404, r.status);
  r = await mut('POST', '/admin/analytics/confirm', session, { ref: '<script>' });
  ok('confirm malformed code → 400', r.status === 400, r.status);

  // customers: history and erasure of personal data
  r = await call('GET', '/admin/customers?q=' + encodeURIComponent(`Cust ${tag}`), { cookie: session });
  ok('customer list shows orders and total spent (cancelled excluded)', r.status === 200 && r.json.items[0]?.id === C1.id && typeof r.json.items[0].spentCents === 'number', JSON.stringify(r.json.items[0]).slice(0, 200));
  r = await call('GET', `/admin/customers/${C1.id}`, { cookie: session });
  ok('customer detail lists their sales', r.status === 200 && r.json.sales.length >= 2, JSON.stringify(r.json.sales?.length));
  r = await mut('PATCH', `/admin/customers/${C1.id}`, session, { city: 'Dallas' });
  ok('update a customer', r.status === 200 && r.json.city === 'Dallas', JSON.stringify(r.json).slice(0, 100));
  r = await mut('POST', `/admin/customers/${C1.id}/erase`, session, { currentPassword: 'wrong-password' });
  ok('erasing personal data needs the admin password → 400', r.status === 400 && r.json.code === 'WRONG_CURRENT_PASSWORD', JSON.stringify(r.json));
  r = await mut('POST', `/admin/customers/${C1.id}/erase`, session, { currentPassword: PASS });
  ok('erase the customer → 204', r.status === 204, r.status);
  r = await call('GET', `/admin/customers/${C1.id}`, { cookie: session });
  ok('the customer no longer exists → 404', r.status === 404, r.status);
  r = await call('GET', `/admin/sales/${S1.id}`, { cookie: session });
  ok('the sale history survives, anonymized (no name, no address)', r.status === 200 && r.json.customerName === '(personal data erased)' && r.json.shipTo === null && r.json.customerId === null && r.json.totalCents === 47000, JSON.stringify(r.json).slice(0, 200));
  ok('erasure also blanks the free-text notes and the tracking code of the erased customer sales', r.json.notes === null && r.json.trackingCode === null, `${r.json.notes} ${r.json.trackingCode}`);
  r = await call('GET', '/admin/audit-log?pageSize=100', { cookie: session });
  ok('erasure also removes the customer name from the activity log', r.status === 200 && !JSON.stringify(r.json.items).includes(`Cust ${tag}`), JSON.stringify(r.json.items.filter((e) => e.summary.includes(`Cust ${tag}`))).slice(0, 200));

  // cleanup: products (sales keep their snapshots)
  for (const p of [P1, P2, P3]) await mut('DELETE', `/admin/products/${p.id}`, session);
  r = await call('GET', `/admin/sales/${S1.id}`, { cookie: session });
  ok('deleting a product keeps the sale history readable', r.status === 200 && r.json.items.every((i) => i.productName.startsWith('Sec ')), JSON.stringify(r.json.items?.map((i) => i.productName)));

  // audit log: "quem mexeu em quê"
  r = await call('GET', '/admin/audit-log', { cookie: session });
  ok('audit log → 200 with a paginated shape', r.status === 200 && Array.isArray(r.json.items) && typeof r.json.total === 'number' && r.json.total >= r.json.items.length, JSON.stringify(r.json).slice(0, 200));
  ok('audit log is newest first', r.json.items.length < 2 || new Date(r.json.items[0].createdAt) >= new Date(r.json.items[1].createdAt), JSON.stringify(r.json.items.slice(0, 2)));
  r = await call('GET', '/admin/audit-log?entityType=Product&pageSize=100', { cookie: session });
  ok(
    'audit log recorded the product actions from this run',
    r.status === 200 &&
      r.json.items.every((e) => e.entityType === 'Product') &&
      r.json.items.some((e) => e.action === 'product.create' && e.summary.includes(P1.name)) &&
      r.json.items.some((e) => e.action === 'product.duplicate' && e.entityId === dup.id) &&
      r.json.items.some((e) => e.action === 'product.delete' && e.summary.includes(P1.name)),
    JSON.stringify(r.json.items.map((e) => e.action)),
  );
  ok('audit log entries name the acting admin', r.json.items.every((e) => e.actorUsername === USER), JSON.stringify(r.json.items.map((e) => e.actorUsername)));
  r = await call('GET', '/admin/audit-log?pageSize=1&page=1', { cookie: session });
  ok('audit log pagination honours pageSize', r.status === 200 && r.json.items.length === 1 && r.json.pageSize === 1, JSON.stringify(r.json).slice(0, 150));
  r = await call('GET', `/admin/audit-log?entityType=${'x'.repeat(41)}`, { cookie: session });
  ok('audit log rejects an oversized entityType filter → 400', r.status === 400, r.status);
  r = await call('GET', '/admin/audit-log?page=0', { cookie: session });
  ok('audit log rejects page=0 → 400', r.status === 400, r.status);

  // Logout revokes the token server-side (a stolen cookie stops working)
  r = await login(USER, PASS);
  const stolen = r.cookie;
  r = await call('GET', '/auth/me', { cookie: stolen });
  ok('second session works before logout', r.status === 200, r.status);
  r = await mut('POST', '/auth/logout', stolen);
  ok('logout → 204', r.status === 204, r.status);
  ok('logout clears the cookie', /abasse_admin=;|Expires=Thu, 01 Jan 1970/i.test(r.setCookie), r.setCookie);
  r = await call('GET', '/auth/me', { cookie: stolen });
  ok('token is REVOKED after logout (replaying the stolen cookie → 401)', r.status === 401, r.status);

  // "sign out of all devices": the lost-phone panic button revokes every session, not just the caller's
  const sessA = (await login(USER, PASS)).cookie;
  const sessB = (await login(USER, PASS)).cookie;
  r = await call('GET', '/auth/me', { cookie: sessB });
  ok('a second concurrent session works before sign-out-everywhere', r.status === 200, r.status);
  r = await mut('POST', '/auth/sign-out-everywhere', sessA);
  ok('sign out of all devices → 204', r.status === 204, r.status);
  ok('sign-out-everywhere clears the caller cookie too', /abasse_admin=;|Expires=Thu, 01 Jan 1970/i.test(r.setCookie), r.setCookie);
  r = await call('GET', '/auth/me', { cookie: sessA });
  ok('the calling session is revoked', r.status === 401, r.status);
  r = await call('GET', '/auth/me', { cookie: sessB });
  ok('a completely different session is ALSO revoked (every device signed out)', r.status === 401, r.status);
}

// ======================================================================
console.log('\n--- C. Brute-force protection');
if (!TOKEN) {
  skip('rate limiting and lockout', 'ADMIN_LOGIN_TOKEN not set');
} else {
  // wait out any throttle window left by the tests above
  await new Promise((res) => setTimeout(res, 61_000));
  const codes = [];
  for (let i = 0; i < 14; i++) codes.push((await login('no-such-user-zzz', `bad-${i}`, TOKEN, { retry: false })).status);
  ok('rate limit: rapid login attempts eventually → 429', codes.includes(429), codes.join(','));
  ok('rate limit: first attempts are normal 401s', codes.slice(0, 5).every((c) => c === 401), codes.join(','));

  if (process.env.TEST_LOCKOUT === '1') {
    await new Promise((res) => setTimeout(res, 61_000));
    for (let i = 0; i < 5; i++) await login(USER, `wrong-${i}`, TOKEN, { retry: false });
    r = await login(USER, PASS || 'x', TOKEN, { retry: false });
    ok('account lockout after 5 failures → 429 even with the correct password', r.status === 429, r.status);
    console.log('  (account is now locked for 15 minutes — run `npm run admin:reset -w apps/api` to unlock)');
  } else skip('account lockout', 'set TEST_LOCKOUT=1 (leaves the admin locked for 15 minutes)');
}

// ======================================================================
console.log('\n--- D. Site routing: the admin area stays a 404 without a session');
const WEB = (process.env.WEB_URL || '').replace(/\/$/, '');
if (!WEB) {
  skip('admin gate on the site', 'WEB_URL not set (e.g. WEB_URL=http://localhost:3000)');
} else {
  for (const path of ['/admin', '/pt/admin', '/pt/admin/products', '/pt/%61dmin', '/es/%61dmin/products', '/%61dmin', '/pt/ad%6din', '/pt/admin%2Fproducts']) {
    let status;
    try {
      status = (await fetch(WEB + path, { redirect: 'manual' })).status;
    } catch (e) {
      status = `unreachable: ${e.message}`;
    }
    ok(`site: ${path} without a session → 404`, status === 404, status);
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
process.exit(fail ? 1 : 0);
