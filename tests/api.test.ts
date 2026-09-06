import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../server/app.js';
import { Copyparty } from '../server/copyparty.js';
import { buildQuery, isInScope, literalMatch, normalizePath } from '../server/search.js';
import { Sessions } from '../server/session.js';

const secret = 'test-only-secret-at-least-32-characters';
const base = 'http://copyparty.test/';
const root = { dirs: [{ href: 'media/', sz: 0, ts: 0 }], files: [], acct: '*', perms: [] };

test('strict folder boundaries, direct children, root, and literal phrases', () => {
  assert.equal(isInScope({ parent: '/media/movies' }, '/media/movies', false), true);
  assert.equal(isInScope({ parent: '/media/movies/action' }, '/media/movies', false), false);
  assert.equal(isInScope({ parent: '/media/movies/action' }, '/media/movies', true), true);
  assert.equal(isInScope({ parent: '/media/movies-old' }, '/media/movies', true), false);
  assert.equal(isInScope({ parent: '/media' }, '/', true), true);
  assert.equal(literalMatch('My XYZ Report.pdf', 'xyz report'), true);
  assert.equal(literalMatch('foo something bar.pdf', 'foo bar'), false);
  assert.equal(literalMatch('100%_done.txt', '%_'), true);
  assert.equal(literalMatch('100XXdone.txt', '%_'), false);
  assert.equal(normalizePath('/media/movies/'), '/media/movies');
  assert.throws(() => normalizePath('/media/../secret'));
  assert.throws(() => normalizePath('bad\u0000path'));
});

test('query syntax cannot be injected by a phrase or a directory name', () => {
  const query = buildQuery('/media/a" or size > 0/b\\', '" or name like * %_\\', true);
  assert.equal(
    query,
    '( path like "media/a% or size > 0/b%" or path like "media/a% or size > 0/b%/*" ) and name like "*% or name like % %%%*"',
  );
  assert.equal(buildQuery('/', 'xyz', true), 'name like "*xyz*"');
});

test('session tokens encrypt credentials and reject tampering or other keys', () => {
  const sessions = new Sessions(secret);
  const token = sessions.seal('private-password');
  assert.equal(sessions.open(token), 'private-password');
  assert.equal(token.includes('private-password'), false);
  assert.equal(new Sessions('a different secret').open(token), null);
  assert.equal(sessions.open('changed' + token), null);
  assert.equal(sessions.open(undefined), null);
});

test('login rejects anonymous fallback, accepts guest deliberately, and protects APIs', async () => {
  const app = createApp({ upstream: base, secret, secureCookie: true }, async (_url, options) => {
    const pw = new Headers(options?.headers).get('PW');
    return Response.json({ ...root, acct: pw === 'good-password' ? 'tester' : '*' });
  });
  const login = (password: string) =>
    app(
      new Request('http://app.test/api/session', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    );
  assert.equal((await app(new Request('http://app.test/api/list'))).status, 401);
  const bad = await login('wrong-password');
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.has('set-cookie'), false);
  const good = await login('good-password');
  assert.equal(good.status, 200);
  assert.match(good.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax; Secure/);
  assert.equal(good.headers.get('set-cookie')!.includes('good-password'), false);
  const cookie = good.headers.get('set-cookie')!.split(';')[0];
  assert.equal(
    (await app(new Request('http://app.test/api/list', { headers: { Cookie: cookie } }))).status,
    200,
  );
  assert.equal((await login('')).status, 200);
  const crossSite = await app(
    new Request('http://app.test/api/session', {
      method: 'DELETE',
      headers: { Origin: 'https://evil.test' },
    }),
  );
  assert.equal(crossSite.status, 403);
  const oversized = await app(
    new Request('http://app.test/api/session', {
      method: 'POST',
      body: JSON.stringify({ password: 'x'.repeat(9000) }),
    }),
  );
  assert.equal(oversized.status, 413);
});

test('navigation decodes names once, preserves keys, and scopes current-folder search without indexing', async () => {
  const client = new Copyparty(base, 'PW', async (url, options) => {
    assert.equal(new URL(String(url)).pathname, '/media/');
    assert.equal(new Headers(options?.headers).get('PW'), 'credential');
    assert.equal(new URL(String(url)).searchParams.has('pw'), false);
    return Response.json({
      dirs: [{ href: 'XYZ%20Folder/' }],
      files: [{ href: 'XYZ%20100%25%20%23.pdf?k=abc', sz: 123, ts: 10 }, { href: 'other.txt' }],
      acct: 'tester',
    });
  });
  const listing = await client.list('/media', 'credential');
  assert.equal(listing.entries[1].name, 'XYZ 100% #.pdf');
  assert.equal(listing.entries[1].key, 'abc');
  const found = await client.search('/media', 'xyz', false, 250, 'credential');
  assert.deepEqual(
    found.entries.map((e) => e.kind),
    ['directory', 'file'],
  );
  assert.equal(found.entries[1].parent, '/media');
});

test('recursive search rechecks scope and literal wildcard matches; preserves proxy prefix and file keys', async () => {
  const client = new Copyparty('https://host.test/party/', 'PW', async (url, options) => {
    assert.equal(String(url), 'https://host.test/party/?srch=');
    assert.equal(options?.method, 'POST');
    const payload = JSON.parse(String(options?.body));
    assert.match(payload.q, /path like "media\/movies\/\*"/);
    return Response.json({
      hits: [
        { rp: '/party/media/movies/sub/100%25_done.txt?k=secret-key', sz: 8, ts: 1 },
        { rp: '/party/media/movies-old/100%25_done.txt' },
        { rp: '/party/media/movies/100XXdone.txt' },
      ],
      trunc: true,
    });
  });
  const result = await client.search('/media/movies', '%_', true, 250, 'credential');
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].path, '/media/movies/sub/100%_done.txt');
  assert.equal(
    result.entries[0].url,
    'https://host.test/party/media/movies/sub/100%25_done.txt?k=secret-key',
  );
  assert.equal(result.more, true);
});

test('API never forwards credentials to redirects or foreign listing hrefs', async () => {
  const redirected = new Copyparty(base, 'PW', async (_url, options) => {
    assert.equal(options?.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'http://evil.test/' } });
  });
  await assert.rejects(redirected.list('/', 'secret'), /redirected/);
  const foreign = new Copyparty(base, 'PW', async () =>
    Response.json({ ...root, files: [{ href: 'https://evil.test/file' }] }),
  );
  await assert.rejects(foreign.list('/', ''), /outside/);
});

test('authenticated downloads forward ranges and force attachment without exposing upstream auth', async () => {
  const app = createApp({ upstream: base, secret, secureCookie: false }, async (url, options) => {
    assert.equal(new URL(String(url)).pathname, '/media/a.html');
    assert.equal(new URL(String(url)).searchParams.get('k'), 'filekey');
    assert.equal(new Headers(options?.headers).get('PW'), 'credential');
    assert.equal(new Headers(options?.headers).get('range'), 'bytes=0-3');
    return new Response('text', {
      status: 206,
      headers: {
        'Content-Length': '4',
        'Content-Range': 'bytes 0-3/10',
        'Content-Type': 'text/html',
        'Set-Cookie': 'cppws=secret',
      },
    });
  });
  const cookie = new Sessions(secret).seal('credential');
  const response = await app(
    new Request('http://app.test/api/file?path=%2Fmedia%2Fa.html&key=filekey', {
      headers: { Cookie: 'partyfinder_session=' + cookie, Range: 'bytes=0-3' },
    }),
  );
  assert.equal(response.status, 206);
  assert.equal(await response.text(), 'text');
  assert.equal(response.headers.get('Content-Type'), 'application/octet-stream');
  assert.match(response.headers.get('Content-Disposition')!, /^attachment/);
  assert.equal(response.headers.has('Set-Cookie'), false);
});

test('search handles an encoded proxy prefix and signals the app candidate ceiling', async () => {
  const client = new Copyparty('https://host.test/party%20files/', 'PW', async () =>
    Response.json({
      hits: [{ rp: 'party files/media/xyz.txt' }],
      trunc: true,
    }),
  );
  const result = await client.search('/media', 'xyz', true, 8000, '');
  assert.equal(result.entries[0].path, '/media/xyz.txt');
  assert.equal(result.entries[0].url, 'https://host.test/party%20files/media/xyz.txt');
  assert.equal(result.more, false);
  assert.equal(result.capped, true);
});
