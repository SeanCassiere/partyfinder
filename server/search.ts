import type { Entry } from '../shared/types.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Application paths are decoded, rooted, and do not end in a slash. */
export function normalizePath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192 || hasControlCharacters(value)) {
    throw new AppError(400, 'Invalid folder path.');
  }
  const parts = value.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..'))
    throw new AppError(400, 'Relative path segments are not supported.');
  return '/' + parts.join('/');
}

export function hasControlCharacters(value: string): boolean {
  // oxlint-disable-next-line no-control-regex -- Reject unsafe controls in user-provided paths, names and queries.
  return /[\u0000-\u001f\u007f]/u.test(value);
}

export function parentPath(path: string): string {
  return path.slice(0, path.lastIndexOf('/')) || '/';
}
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function isInScope(
  entry: Pick<Entry, 'parent'>,
  folder: string,
  recursive: boolean,
): boolean {
  return (
    entry.parent === folder ||
    (recursive && (folder === '/' || entry.parent.startsWith(folder + '/')))
  );
}

// Copyparty exposes SQL LIKE without ESCAPE. Broaden problematic characters for
// candidate retrieval, then enforce literal matching and scope on decoded results.
// This also avoids its nonstandard handling of quotes preceded by backslashes.
function candidate(value: string): string {
  return value.replace(/["\\*%_]/gu, '%');
}
function asciiFold(value: string): string {
  return value.replace(/[A-Z]/g, (ch) => ch.toLowerCase());
}
export function literalMatch(name: string, phrase: string): boolean {
  return asciiFold(name).includes(asciiFold(phrase));
}

export function buildQuery(folder: string, phrase: string, recursive: boolean): string {
  const path = candidate(folder.slice(1));
  const scope =
    folder === '/'
      ? recursive
        ? ''
        : 'path like ""'
      : recursive
        ? `( path like "${path}" or path like "${path}/*" )`
        : `path like "${path}"`;
  const name = `name like "*${candidate(phrase)}*"`;
  return scope ? `${scope} and ${name}` : name;
}

export function parseSearch(body: unknown) {
  const value = body as Record<string, unknown> | null;
  if (!value || typeof value.q !== 'string' || !value.q.trim() || value.q.length > 300) {
    throw new AppError(400, 'Enter a search phrase between 1 and 300 characters.');
  }
  if (hasControlCharacters(value.q))
    throw new AppError(400, 'Search phrases cannot contain control characters.');
  if (typeof value.recursive !== 'boolean') throw new AppError(400, 'Choose a search scope.');
  const limit = value.limit === undefined ? 250 : Number(value.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 8000)
    throw new AppError(400, 'Invalid result limit.');
  return { path: normalizePath(value.path), q: value.q, recursive: value.recursive, limit };
}
