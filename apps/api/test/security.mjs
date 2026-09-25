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

const login = (username, password, token = TOKEN) =>
  call('POST', '/auth/login', {
    body: { username, password },
    headers: { 'x-admin-login-token': token, origin: ORIGIN },
  });
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
  r = await login('no-such-user-zzz', 'whatever-password');
  ok('correct token + unknown user → 401 INVALID_CREDENTIALS', r.status === 401 && r.json.code === 'INVALID_CREDENTIALS', JSON.stringify(r.json));
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
  ['GET', '/admin/products/abc'],
  ['POST', '/admin/products'],
  ['PATCH', '/admin/products/abc'],
  ['DELETE', '/admin/products/abc'],
  ['POST', '/admin/products/abc/images'],
  ['PUT', '/admin/products/abc/images/order'],
  ['DELETE', '/admin/products/abc/images/def'],
  ['GET', '/auth/me'],
  ['POST', '/auth/change-password'],
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
    for (const [m, p] of [['GET', '/admin/products'], ['POST', '/admin/products'], ['GET', '/admin/products/categories'], ['GET', '/admin/products/stats'], ['GET', '/admin/team'], ['POST', '/admin/team'], ['PUT', '/admin/settings']]) {
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
  ok('stats payload is small (no image bytes)', JSON.stringify(r.json).length < 20000, JSON.stringify(r.json).length);

  // Mass assignment / validation
  r = await mut('POST', '/admin/products', session, { name: 'Sec Test Piece', description: 'd', category: 'SecTest', priceCents: 1000 });
  ok('create product → 201', r.status === 201, JSON.stringify(r.json));
  const A = r.json;
  r = await mut('PATCH', `/admin/products/${A.id}`, session, { slug: 'hijack', id: 'x', createdAt: '2000-01-01' });
  ok('mass assignment (slug/id/createdAt) rejected → 400', r.status === 400, JSON.stringify(r.json));
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

  // ---- Site settings (WhatsApp) ----
  r = await call('GET', '/settings/public');
  ok('GET /settings/public is open and exposes only the whatsapp number', r.status === 200 && Object.keys(r.json).join() === 'whatsapp', JSON.stringify(r.json));
  r = await call('GET', '/admin/settings', { cookie: session });
  const originalWa = r.json.whatsapp;
  ok('GET /admin/settings → 200', r.status === 200 && typeof originalWa === 'string', JSON.stringify(r.json));
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
  r = await mut('PUT', '/admin/settings', session, { whatsapp: '5511999999999', evil: 1 });
  ok('unknown settings field rejected (mass assignment) → 400', r.status === 400, r.status);
  r = await call('GET', '/settings/public');
  ok('rejected inputs did not change the saved number', r.json.whatsapp === '5511966665555', JSON.stringify(r.json));
  await mut('PUT', '/admin/settings', session, { whatsapp: originalWa });

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
}

// ======================================================================
console.log('\n--- C. Brute-force protection');
if (!TOKEN) {
  skip('rate limiting and lockout', 'ADMIN_LOGIN_TOKEN not set');
} else {
  // wait out any throttle window left by the tests above
  await new Promise((res) => setTimeout(res, 61_000));
  const codes = [];
  for (let i = 0; i < 14; i++) codes.push((await login('no-such-user-zzz', `bad-${i}`)).status);
  ok('rate limit: rapid login attempts eventually → 429', codes.includes(429), codes.join(','));
  ok('rate limit: first attempts are normal 401s', codes.slice(0, 5).every((c) => c === 401), codes.join(','));

  if (process.env.TEST_LOCKOUT === '1') {
    await new Promise((res) => setTimeout(res, 61_000));
    for (let i = 0; i < 5; i++) await login(USER, `wrong-${i}`);
    r = await login(USER, PASS || 'x');
    ok('account lockout after 5 failures → 429 even with the correct password', r.status === 429, r.status);
    console.log('  (account is now locked for 15 minutes — run `npm run admin:reset -w apps/api` to unlock)');
  } else skip('account lockout', 'set TEST_LOCKOUT=1 (leaves the admin locked for 15 minutes)');
}

console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
process.exit(fail ? 1 : 0);
