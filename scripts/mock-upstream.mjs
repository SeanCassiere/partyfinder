// Mock Copyparty upstream for local Partyfinder development. Node built-ins only.
//
//   node scripts/mock-upstream.mjs           # http://127.0.0.1:3931/
//   MOCK_PORT=4000 node scripts/mock-upstream.mjs
//
// Implements the subset of Copyparty's HTTP API that server/copyparty.ts uses:
//   GET  <folder>/?ls            -> { dirs, files, acct, perms }
//   POST /?srch                  -> { hits, trunc }
//   POST <path>?move=<dest>      -> rename (in-memory)
//   POST <path>?delete           -> delete (in-memory)
//   GET  <path>?dl               -> synthetic file bytes
//
// Authentication mirrors Copyparty: the password arrives in a header (PW by
// default, see COPYPARTY_AUTH_HEADER). Any non-empty password is accepted and
// gets a full-permission account; no password is the anonymous read-only guest.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 3931);
const HOST = process.env.MOCK_HOST ?? '127.0.0.1';
const AUTH_HEADER = (process.env.COPYPARTY_AUTH_HEADER ?? 'PW').toLowerCase();
const ACCOUNT = process.env.MOCK_ACCOUNT ?? 'tester';
const MEMBER_PERMS = ['read', 'write', 'move', 'delete'];
const GUEST_PERMS = ['read'];

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
const KiB = 1024;

/** Seconds since the epoch, so fixtures keep the same dates on every run. */
function at(year, month, day, hour = 12, minute = 0) {
  return Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 1000);
}

const makeDir = () => ({ kind: 'directory', children: new Map() });
const makeFile = (size, modified) => ({ kind: 'file', size, modified });

const root = makeDir();

/** Insert `/a/b/c` into the tree; a trailing entry with a size becomes a file. */
function put(path, size, modified) {
  const parts = path.split('/').filter(Boolean);
  let node = root;
  parts.forEach((name, index) => {
    const last = index === parts.length - 1;
    let child = node.children.get(name);
    if (!child) {
      child = last && size !== undefined ? makeFile(size, modified) : makeDir();
      node.children.set(name, child);
    }
    node = child;
  });
  return node;
}

const mkdir = (path) => put(path);

// --- Fixture tree -----------------------------------------------------------
// Nested folders, every icon family in src/, sizes from 0 B to multi-GiB,
// timestamps spanning 2016-2026, long UTF-8 names, spaces, quotes and an
// apostrophe, one empty folder, and one folder with 300+ entries.

mkdir('/media');
put('/media/readme.txt', 1240, at(2021, 3, 14, 9, 5));
put('/media/cover art.jpg', 482_113, at(2022, 7, 1, 18, 42));
put('/media/placeholder.dat', 0, at(2016, 1, 4, 6, 30));

mkdir('/media/Movies');
put('/media/Movies/Ölfilter — größe (2024) 日本語.mkv', 12_884_901_888, at(2024, 11, 2, 21, 15));
put(
  '/media/Movies/A very long movie title that will definitely truncate in the name column.mkv',
  4_913_221_004,
  at(2023, 5, 19, 20, 0),
);
put('/media/Movies/He said "hello" (director\'s cut).mp4', 1_610_612_736, at(2020, 9, 8, 22, 10));
put('/media/Movies/clip.mp4', 12 * MiB, at(2025, 2, 27, 11, 45));
put('/media/Movies/subtitles.srt', 38 * KiB, at(2025, 2, 27, 11, 46));

mkdir('/media/Movies/2024');
put('/media/Movies/2024/notes.md', 900, at(2024, 1, 1, 0, 5));
put('/media/Movies/2024/trailer.webm', 88 * MiB, at(2024, 6, 30, 15, 0));
mkdir('/media/Movies/2024/raw footage');
put('/media/Movies/2024/raw footage/take 01.mov', 3 * GiB + 512 * MiB, at(2024, 6, 12, 8, 20));
put('/media/Movies/2024/raw footage/take 02.mov', 2 * GiB, at(2024, 6, 12, 9, 40));

mkdir('/media/Music');
put('/media/Music/track01 — Åre.flac', 33_100_200, at(2019, 12, 24, 19, 30));
put('/media/Music/track02.mp3', 5_120_000, at(2019, 12, 24, 19, 31));
put('/media/Music/track03 (live).ogg', 7_340_032, at(2018, 4, 3, 20, 15));
put('/media/Music/cover.png', 921_600, at(2018, 4, 3, 20, 16));

mkdir('/media/Photos');
put('/media/Photos/IMG_0001.HEIC', 4_200_000, at(2023, 8, 11, 13, 22));
put('/media/Photos/panorama 360°.jpg', 18 * MiB, at(2023, 8, 11, 13, 25));
put('/media/Photos/scan.tiff', 132 * MiB, at(2017, 10, 5, 7, 0));

mkdir('/documents');
put('/documents/tax 2023.pdf', 220_500, at(2024, 2, 14, 10, 0));
put('/documents/notes.md', 6_400, at(2026, 1, 9, 8, 15));
put('/documents/spreadsheet.xlsx', 84_992, at(2022, 11, 30, 16, 45));
put('/documents/"quoted title".docx', 51_200, at(2021, 6, 6, 6, 6));
put('/documents/no-extension', 1_024, at(2016, 5, 20, 14, 0));

mkdir('/documents/Empty folder');

mkdir('/documents/Projects');
put('/documents/Projects/script.ts', 4_200, at(2026, 3, 2, 17, 30));
put('/documents/Projects/style.css', 12_800, at(2026, 3, 2, 17, 31));
put('/documents/Projects/index.html', 2_048, at(2026, 3, 2, 17, 32));
put('/documents/Projects/server.py', 9_600, at(2025, 7, 18, 12, 0));
put('/documents/Projects/data.json', 512, at(2025, 7, 18, 12, 1));

mkdir('/backups');
put('/backups/archive.zip', 88_000_000, at(2020, 1, 31, 3, 0));
put('/backups/nightly.tar.gz', 6 * GiB + 128 * MiB, at(2026, 8, 30, 2, 0));
put('/backups/vm-image.iso', 9 * GiB, at(2022, 3, 17, 4, 30));
put('/backups/empty.log', 0, at(2026, 9, 1, 0, 0));

// 320 files plus 3 subfolders: exercises the listing's "Show more" pagination.
mkdir('/backups/Daily snapshots');
const kinds = ['tar.gz', 'zip', 'log', 'sql', 'json'];
for (let index = 0; index < 320; index += 1) {
  const day = (index % 28) + 1;
  const month = (index % 12) + 1;
  const year = 2020 + (index % 6);
  const kind = kinds[index % kinds.length];
  const size = index === 0 ? 0 : (index % 7) * 137 * MiB + index * 4099;
  const label = String(index + 1).padStart(3, '0');
  put(
    `/backups/Daily snapshots/snapshot ${label} — ${year}-${month}.${kind}`,
    size,
    at(year, month, day, 1, index % 60),
  );
}
mkdir('/backups/Daily snapshots/2020');
mkdir('/backups/Daily snapshots/2021');
mkdir('/backups/Daily snapshots/älteste Sicherung');
put('/backups/Daily snapshots/älteste Sicherung/readme.txt', 220, at(2016, 2, 29, 23, 59));

// --- Tree helpers -----------------------------------------------------------

/** Resolve a decoded, rooted path to a node, or undefined. */
function resolve(path) {
  let node = root;
  for (const name of path.split('/').filter(Boolean)) {
    if (node.kind !== 'directory') return undefined;
    node = node.children.get(name);
    if (!node) return undefined;
  }
  return node;
}

function parentOf(path) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  return { parent: resolve('/' + parts.join('/')), name };
}

/** Every file in the tree, as { dir, name, node } with dir relative to root. */
function* walk(node = root, dir = '') {
  for (const [name, child] of node.children) {
    if (child.kind === 'directory') yield* walk(child, dir ? `${dir}/${name}` : name);
    else yield { dir, name, node: child };
  }
}

const encodeSegments = (value) => value.split('/').map(encodeURIComponent).join('/');

// --- Copyparty query language ----------------------------------------------

/** Translate a Copyparty/SQL LIKE pattern (`*` and `%` wildcards) to a RegExp. */
function likePattern(value) {
  const source = value
    .split(/[*%]/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('.*')
    .replace(/_/gu, '.');
  return new RegExp(`^${source}$`, 'iu');
}

/** Pull `name like "…"` / `path like "…"` clauses out of a search query. */
function parseQuery(query) {
  const names = [];
  const paths = [];
  const clause = /(\w+)\s+like\s+(?:"([^"]*)"|'([^']*)')/giu;
  let match = clause.exec(query);
  while (match) {
    const value = match[2] ?? match[3] ?? '';
    if (match[1].toLowerCase() === 'name') names.push(likePattern(value));
    else if (match[1].toLowerCase() === 'path') paths.push(likePattern(value));
    match = clause.exec(query);
  }
  return { names, paths };
}

// --- HTTP -------------------------------------------------------------------

function identify(req) {
  const password = req.headers[AUTH_HEADER];
  const value = Array.isArray(password) ? password[0] : password;
  return value ? { account: ACCOUNT, perms: MEMBER_PERMS } : { account: '*', perms: GUEST_PERMS };
}

function readBody(req) {
  return new Promise((resolve_, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve_(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, body, status = 200) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
  });
  res.end(payload);
}

function listing(node, identity) {
  const dirs = [];
  const files = [];
  for (const [name, child] of node.children) {
    if (child.kind === 'directory')
      dirs.push({ href: `${encodeURIComponent(name)}/`, sz: 0, ts: 0 });
    else files.push({ href: encodeURIComponent(name), sz: child.size, ts: child.modified });
  }
  return { dirs, files, acct: identity.account, perms: identity.perms };
}

function search(rawBody, identity) {
  let parsed = {};
  try {
    parsed = JSON.parse(rawBody || '{}');
  } catch {
    return { status: 400, body: { hits: [], trunc: false } };
  }
  const limit = Number.isInteger(parsed.n) && parsed.n > 0 ? parsed.n : 250;
  const { names, paths } = parseQuery(String(parsed.q ?? ''));
  const hits = [];
  let truncated = false;
  for (const { dir, name, node } of walk()) {
    if (!names.every((pattern) => pattern.test(name))) continue;
    if (paths.length > 0 && !paths.some((pattern) => pattern.test(dir))) continue;
    if (hits.length >= limit) {
      truncated = true;
      break;
    }
    hits.push({
      rp: encodeSegments(dir ? `${dir}/${name}` : name),
      sz: node.size,
      ts: node.modified,
    });
  }
  if (!identity.perms.includes('read')) return { status: 403, body: { hits: [], trunc: false } };
  return { status: 200, body: { hits, trunc: truncated } };
}

const server = createServer((req, res) => {
  void handle(req, res).catch(() => sendJson(res, { error: 'mock failure' }, 500));
});

async function handle(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const identity = identify(req);
  let path;
  try {
    path = '/' + decodeURIComponent(url.pathname).split('/').filter(Boolean).join('/');
  } catch {
    return sendJson(res, { error: 'bad path' }, 400);
  }

  if (url.searchParams.has('srch')) {
    const { status, body } = search(await readBody(req), identity);
    return sendJson(res, body, status);
  }

  const node = resolve(path);

  if (url.searchParams.has('ls')) {
    if (!node || node.kind !== 'directory') return sendJson(res, { error: 'not found' }, 404);
    return sendJson(res, listing(node, identity));
  }

  if (url.searchParams.has('move')) {
    if (!identity.perms.includes('move') || !identity.perms.includes('write'))
      return sendJson(res, { error: 'denied' }, 403);
    if (!node) return sendJson(res, { error: 'not found' }, 404);
    const destination = url.searchParams.get('move') || '';
    const from = parentOf(path);
    const to = parentOf('/' + destination.split('/').filter(Boolean).join('/'));
    if (!to.parent || to.parent.kind !== 'directory' || !to.name)
      return sendJson(res, { error: 'bad destination' }, 400);
    if (to.parent.children.has(to.name)) return sendJson(res, { error: 'exists' }, 409);
    from.parent.children.delete(from.name);
    to.parent.children.set(to.name, node);
    return sendJson(res, { ok: true });
  }

  if (url.searchParams.has('delete')) {
    if (!identity.perms.includes('delete')) return sendJson(res, { error: 'denied' }, 403);
    if (!node) return sendJson(res, { error: 'not found' }, 404);
    const { parent, name } = parentOf(path);
    parent.children.delete(name);
    return sendJson(res, { ok: true });
  }

  if (!node) return sendJson(res, { error: 'not found' }, 404);
  if (node.kind === 'directory') return sendJson(res, listing(node, identity));

  // Synthetic download: real bytes, capped so multi-GiB fixtures stay cheap.
  const body = Buffer.from(
    `mock-upstream: ${path}\nsize on record: ${node.size} bytes\n`.repeat(8),
    'utf8',
  );
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': body.length,
    'accept-ranges': 'none',
  });
  return res.end(body);
}

server.listen(PORT, HOST, () => {
  const files = [...walk()].length;
  console.log(`mock copyparty on http://${HOST}:${PORT}/ (${files} files)`);
  console.log(`auth header: ${AUTH_HEADER.toUpperCase()} — any password signs in as "${ACCOUNT}"`);
});
