import { Copyparty } from './copyparty.js';
import { Sessions } from './session.js';
import { AppError, normalizePath, parseSearch } from './search.js';

export interface Config {
  upstream: string;
  secret: string;
  secureCookie: boolean;
  authHeader?: string;
  allowFolderDelete?: boolean;
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.body) throw new AppError(400, 'A JSON request body is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) {
      await reader.cancel();
      throw new AppError(413, 'Request body is too large.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError(400, 'Invalid JSON request.');
  }
}

export function createApp(config: Config, upstreamFetch?: typeof fetch) {
  const copyparty = new Copyparty(config.upstream, config.authHeader, upstreamFetch);
  const sessions = new Sessions(config.secret);
  const cookieName = 'partyfinder_session';
  const cookieOptions = `Path=/; HttpOnly; SameSite=Lax${config.secureCookie ? '; Secure' : ''}`;
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  };
  const json = (value: unknown, status = 200, extra: Record<string, string> = {}) =>
    Response.json(value, { status, headers: { ...headers, ...extra } });
  const passwordFor = (req: Request) => {
    const token = req.headers
      .get('cookie')
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);
    return sessions.open(token);
  };
  const attempts = new Map<string, { count: number; expires: number }>();

  return async function handle(req: Request, clientAddress = 'unknown'): Promise<Response> {
    try {
      const url = new URL(req.url);
      const route = `${req.method} ${url.pathname}`;
      const origin = req.headers.get('origin');
      if (req.headers.get('sec-fetch-site') === 'cross-site')
        throw new AppError(403, 'Cross-site requests are not allowed.');
      if (origin) {
        try {
          if (new URL(origin).host !== url.host) throw new Error();
        } catch {
          throw new AppError(403, 'Cross-site requests are not allowed.');
        }
      }
      if (route === 'GET /healthz') return json({ status: 'ok' });
      if (route === 'GET /api/config')
        return json({ server: copyparty.base.host, url: copyparty.base.href });
      if (route === 'GET /api/session') return json({ signedIn: passwordFor(req) !== null });
      if (route === 'POST /api/session') {
        const now = Date.now();
        for (const [ip, value] of attempts) if (value.expires < now) attempts.delete(ip);
        const attempt = attempts.get(clientAddress) ?? { count: 0, expires: now + 60_000 };
        if (++attempt.count > 15)
          throw new AppError(429, 'Too many sign-in attempts. Try again in a minute.');
        attempts.set(clientAddress, attempt);
        const body = (await readJson(req)) as { password?: unknown };
        const password = body?.password;
        if (typeof password !== 'string' || password.length > 1024 || /[\r\n]/.test(password))
          throw new AppError(400, 'Invalid password.');
        const listing = await copyparty.list('/', password);
        if (password && listing.account === '*')
          throw new AppError(401, 'Copyparty did not recognize that password.');
        return json({ account: listing.account }, 200, {
          'Set-Cookie': `${cookieName}=${sessions.seal(password)}; Max-Age=43200; ${cookieOptions}`,
        });
      }
      if (route === 'DELETE /api/session')
        return json({ ok: true }, 200, {
          'Set-Cookie': `${cookieName}=; Max-Age=0; ${cookieOptions}`,
        });
      const password = passwordFor(req);
      if (password === null)
        throw new AppError(401, 'Connect to your Copyparty server to continue.');
      if (route === 'GET /api/list')
        return json(
          await copyparty.list(normalizePath(url.searchParams.get('path') ?? '/'), password),
        );
      if (route === 'POST /api/search') {
        const { path, q, recursive, limit } = parseSearch(await readJson(req));
        return json(await copyparty.search(path, q, recursive, limit, password));
      }
      if (route === 'GET /api/actions')
        return json(
          await copyparty.actions(
            normalizePath(url.searchParams.get('path')),
            password,
            config.allowFolderDelete,
          ),
        );
      if (route === 'POST /api/rename' || route === 'POST /api/delete') {
        const body = (await readJson(req)) as {
          path?: unknown;
          name?: unknown;
          confirmation?: unknown;
        } | null;
        const path = normalizePath(body?.path);
        if (route === 'POST /api/rename')
          return json(await copyparty.rename(path, body?.name, password));
        if (body?.confirmation !== path.split('/').at(-1))
          throw new AppError(400, 'Confirm deletion with the exact item name.');
        return json(await copyparty.delete(path, password, config.allowFolderDelete));
      }
      if (route === 'GET /api/file') {
        const path = normalizePath(url.searchParams.get('path'));
        const file = copyparty.url(path);
        const key = url.searchParams.get('key');
        if (key) file.searchParams.set('k', key);
        file.searchParams.set('dl', '');
        const upstream = await copyparty.fetch(file, password, {
          headers: req.headers.has('range') ? { Range: req.headers.get('range')! } : {},
          signal: req.signal,
        });
        const out = new Headers(headers);
        for (const header of ['content-length', 'content-range', 'accept-ranges']) {
          const value = upstream.headers.get(header);
          if (value) out.set(header, value);
        }
        out.set('Content-Type', 'application/octet-stream');
        out.set('Content-Security-Policy', "sandbox; default-src 'none'");
        out.set(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(path.split('/').at(-1)!).replace(/'/g, '%27')}`,
        );
        return new Response(upstream.body, { status: upstream.status, headers: out });
      }
      throw new AppError(404, 'Unknown API endpoint.');
    } catch (error) {
      return json(
        {
          error: error instanceof AppError ? error.message : 'The request could not be completed.',
        },
        error instanceof AppError ? error.status : 500,
      );
    }
  };
}
