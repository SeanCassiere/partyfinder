import {
  AppError,
  buildQuery,
  encodePath,
  hasControlCharacters,
  isInScope,
  literalMatch,
  normalizePath,
  parentPath,
} from './search.js';
import type { Entry, Listing, SearchResults } from '../shared/types.js';

interface UpstreamEntry {
  href: string;
  sz?: number;
  ts?: number;
  perms?: string[];
}
interface UpstreamListing {
  dirs: UpstreamEntry[];
  files: UpstreamEntry[];
  acct?: string;
  perms?: string[];
}
interface Hit {
  rp: string;
  sz?: number;
  ts?: number;
}

export class Copyparty {
  readonly base: URL;
  constructor(
    base: string,
    private authHeader = 'PW',
    private request: typeof fetch = fetch,
  ) {
    this.base = new URL(base.endsWith('/') ? base : base + '/');
    if (
      !['http:', 'https:'].includes(this.base.protocol) ||
      this.base.username ||
      this.base.password ||
      this.base.search ||
      this.base.hash
    ) {
      throw new Error(
        'COPYPARTY_URL must be an HTTP(S) URL without credentials, query, or fragment.',
      );
    }
  }

  url(path: string, directory = false): URL {
    return new URL(
      this.base.href +
        encodePath(normalizePath(path)).slice(1) +
        (directory && path !== '/' ? '/' : ''),
    );
  }

  async fetch(url: URL, password: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (password) headers.set(this.authHeader, password);
    let response: Response;
    try {
      response = await this.request(url, {
        ...init,
        headers,
        redirect: 'manual',
        signal: init.signal ?? AbortSignal.timeout(55_000),
      });
    } catch {
      throw new AppError(
        502,
        'Could not reach Copyparty. Check the server URL, network, and TLS configuration.',
      );
    }
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new AppError(
        502,
        'Copyparty redirected the request. Configure its final URL, including any proxy path.',
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      const messages: Record<number, string> = {
        401: 'Sign in with your Copyparty password to continue.',
        403: 'Copyparty denied access. Check your password and folder permissions.',
        404: 'This folder or file no longer exists, or is not accessible.',
        429: 'Copyparty is busy with another search. Wait a moment and try again.',
        500: 'Copyparty could not complete the request. Check its logs, permissions, and indexing configuration.',
      };
      throw new AppError(
        response.status >= 500 ? 502 : response.status,
        messages[response.status] ?? `Copyparty returned HTTP ${response.status}.`,
      );
    }
    return response;
  }

  async json<T>(url: URL, password: string, init?: RequestInit): Promise<T> {
    const response = await this.fetch(url, password, init);
    try {
      return (await response.json()) as T;
    } catch {
      throw new AppError(
        502,
        'Expected JSON from Copyparty. Check that the configured URL points to Copyparty, not a login gateway.',
      );
    }
  }

  private entry(href: string, relative: URL, kind: Entry['kind'], size = 0, modified = 0): Entry {
    const url = new URL(href, relative);
    if (url.origin !== this.base.origin || !url.pathname.startsWith(this.base.pathname)) {
      throw new AppError(502, 'Copyparty returned a file outside the configured server path.');
    }
    let path: string;
    try {
      path = normalizePath('/' + decodeURIComponent(url.pathname.slice(this.base.pathname.length)));
    } catch {
      throw new AppError(502, 'Copyparty returned an unsupported file path.');
    }
    const safeUrl = this.url(path, kind === 'directory');
    const key = url.searchParams.get('k') ?? undefined;
    if (key) safeUrl.searchParams.set('k', key);
    return {
      name: path.split('/').at(-1) || '/',
      path,
      parent: parentPath(path),
      kind,
      size,
      modified,
      key,
      url: safeUrl.href,
    };
  }

  async list(path: string, password: string): Promise<Listing> {
    const url = this.url(path, true);
    url.searchParams.set('ls', '');
    const data = await this.json<UpstreamListing>(url, password);
    if (!Array.isArray(data.dirs) || !Array.isArray(data.files))
      throw new AppError(502, 'Unrecognized Copyparty directory response.');
    return {
      path,
      account: data.acct ?? '*',
      permissions: data.perms ?? [],
      entries: [
        ...data.dirs.map((e) => this.entry(e.href, url, 'directory', e.sz, e.ts)),
        ...data.files.map((e) => this.entry(e.href, url, 'file', e.sz, e.ts)),
      ],
    };
  }

  private async target(path: string, password: string) {
    if (path === '/' || parentPath(path) === '/')
      throw new AppError(403, 'Server roots and top-level locations cannot be changed here.');
    const listing = await this.list(parentPath(path), password);
    const entry = listing.entries.find((e) => e.path === path);
    if (!entry)
      throw new AppError(404, 'This item no longer exists or is not visible. Refresh the folder.');
    return { listing, entry };
  }

  async actions(path: string, password: string, allowFolderDelete = false) {
    if (path === '/' || parentPath(path) === '/')
      return {
        rename: false,
        delete: false,
        reason: 'Server roots and top-level locations are protected.',
      };
    const { listing, entry } = await this.target(path, password);
    const perms =
      entry.kind === 'directory'
        ? (await this.list(path, password)).permissions
        : listing.permissions;
    const read = perms.includes('read');
    return {
      rename: read && perms.includes('move') && listing.permissions.includes('write'),
      delete: read && perms.includes('delete') && (entry.kind === 'file' || allowFolderDelete),
      reason:
        entry.kind === 'directory' && !allowFolderDelete
          ? 'Folder deletion is disabled by the app operator. Rename still follows Copyparty permissions.'
          : 'Actions follow your Copyparty permissions.',
    };
  }

  async rename(path: string, name: unknown, password: string) {
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name === '.' ||
      name === '..' ||
      /[/\\]/.test(name) ||
      hasControlCharacters(name) ||
      Buffer.byteLength(name) > 255
    )
      throw new AppError(
        400,
        'Use a name of 1–255 bytes without slashes, backslashes, or control characters.',
      );
    if (!(await this.actions(path, password)).rename)
      throw new AppError(403, 'Rename requires read, move, and destination write permissions.');
    const { listing } = await this.target(path, password);
    if (listing.entries.some((e) => e.name.toLowerCase() === name.toLowerCase()))
      throw new AppError(409, 'An item with this name already exists. Choose a different name.');
    const destination = normalizePath(parentPath(path) + '/' + name);
    const url = this.url(path);
    url.searchParams.set('move', decodeURIComponent(this.url(destination).pathname));
    const response = await this.fetch(url, password, { method: 'POST' });
    await response.body?.cancel();
    const after = await this.list(parentPath(path), password);
    if (
      after.entries.some((e) => e.path === path) ||
      !after.entries.some((e) => e.path === destination)
    )
      throw new AppError(
        409,
        'The rename could not be fully verified. Refresh the folder before retrying; it may have partially completed.',
      );
    return { ok: true, path: destination };
  }

  async delete(path: string, password: string, allowFolderDelete = false) {
    if (!(await this.actions(path, password, allowFolderDelete)).delete)
      throw new AppError(
        403,
        'Delete is unavailable for this item. Check permissions and the folder-deletion setting.',
      );
    const url = this.url(path);
    url.searchParams.set('delete', '');
    const response = await this.fetch(url, password, { method: 'POST' });
    await response.body?.cancel();
    const after = await this.list(parentPath(path), password);
    if (after.entries.some((e) => e.path === path))
      throw new AppError(
        409,
        'The item still exists. Copyparty may have blocked or partially completed deletion. Refresh before retrying.',
      );
    return { ok: true };
  }

  async search(
    path: string,
    phrase: string,
    recursive: boolean,
    limit: number,
    password: string,
  ): Promise<SearchResults> {
    // Immediate-folder search uses its complete listing: includes directories and
    // works without an index. Recursive searches use Copyparty's existing index.
    if (!recursive) {
      const listing = await this.list(path, password);
      const entries = listing.entries.filter((e) => literalMatch(e.name, phrase));
      return {
        entries,
        path,
        recursive,
        scanned: listing.entries.length,
        requested: limit,
        more: false,
        capped: false,
        query: '',
      };
    }
    const query = buildQuery(path, phrase, true);
    const url = new URL(this.base);
    url.searchParams.set('srch', '');
    const data = await this.json<{ hits: Hit[]; trunc: boolean }>(url, password, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ q: query, n: limit }),
    });
    if (!Array.isArray(data.hits))
      throw new AppError(502, 'Unrecognized Copyparty search response.');
    const entries = data.hits
      .map((hit) => {
        // With a reverse-proxy prefix, rp may already contain that prefix.
        const rooted = new URL('/' + hit.rp.replace(/^\/+/, ''), this.base.origin);
        const href =
          this.base.pathname !== '/' && rooted.pathname.startsWith(this.base.pathname)
            ? rooted.href
            : hit.rp;
        return this.entry(href, this.base, 'file', hit.sz, hit.ts);
      })
      .filter((e) => isInScope(e, path, true) && literalMatch(e.name, phrase));
    return {
      entries,
      path,
      recursive,
      scanned: data.hits.length,
      requested: limit,
      more: Boolean(data.trunc) && limit < 8000,
      // Copyparty clears trunc at its hard cap. Never imply completeness there.
      capped:
        (Boolean(data.trunc) && limit >= 8000) ||
        (!data.trunc && data.hits.length >= Math.min(limit, 7999)),
      query,
    };
  }
}
