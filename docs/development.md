# Development

[Back to README](../README.md)

Built with React, TypeScript, Vite, and [Nitro's Vite integration](https://nitro.build/docs/vite). Nitro 3 beta is pinned in `package.json` and the pnpm lockfile. One dev server, one production build, one Docker container.

Use Node **22.14+ (22.x)** or **24.10+**; `.nvmrc`, Docker, and CI use Node 22. pnpm **11.25.0** is pinned in `packageManager`. The minimum Node version also covers semantic-release.

```sh
git clone git@github.com:SeanCassiere/partyfinder.git
cd partyfinder
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
# Set COPYPARTY_URL; use COOKIE_SECURE=false for local HTTP.
pnpm dev
```

Open `http://127.0.0.1:3925`. Nitro serves the API and Vite serves the React app with hot reload. A missing development session secret generates an ephemeral one; sessions then expire when the server restarts.

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm build
# Production reads process environment; unlike dev, it does not load .env itself:
node --env-file=.env .output/server/index.mjs
```

The standard test suite checks authentication, session tampering, CSRF, path boundaries, encoding, literal matching, streaming downloads, and limits. An additional integration test starts an isolated real Copyparty process with generated fixtures (never your live library):

```sh
git clone --depth 1 https://github.com/9001/copyparty.git work/copyparty
python3 -m venv work/venv
work/venv/bin/pip install jinja2
COPYPARTY_SOURCE="$PWD/work/copyparty" \
COPYPARTY_PYTHON="$PWD/work/venv/bin/python" pnpm test
```

### Run without a Copyparty server

`scripts/mock-upstream.mjs` is a dependency-free mock upstream (Node built-ins only) that speaks the same `?ls`, `?srch`, `?move` and `?delete` contract as Copyparty. It serves a fixture tree with nested folders, every file-type family, sizes from 0 B to multi-GiB, timestamps from 2016 to 2026, long UTF-8 names such as `Ölfilter — größe (2024) 日本語.mkv`, names with spaces and quotes, an empty folder, and a 323-entry folder that exercises "Show more". Renames and deletes mutate the in-memory tree, so the dialogs can be exercised end to end; restart the mock to reset it.

Two terminals:

```sh
pnpm dev:mock          # http://127.0.0.1:3931/ — set MOCK_PORT to change it
```

```sh
COPYPARTY_URL=http://127.0.0.1:3931/ \
SESSION_SECRET=local-development-secret-at-least-32-chars \
COOKIE_SECURE=false \
NODE_ENV=development \
ALLOW_FOLDER_DELETE=true \
pnpm dev
```

`server/runtime.ts` reads exactly five variables: **`COPYPARTY_URL`** is the only required one. `SESSION_SECRET` is required (32+ characters) unless `NODE_ENV=development`, where an ephemeral secret is generated per restart. `COOKIE_SECURE` must be `false` for local HTTP. `COPYPARTY_AUTH_HEADER` defaults to `PW` (the mock honours the same variable). `ALLOW_FOLDER_DELETE` defaults to `false`; set it to `true` only to exercise the folder-delete dialog.

Open `http://127.0.0.1:3925` and sign in with any password — the mock accepts anything and returns `read/write/move/delete`, so the rename and delete menu items are enabled. **Browse as guest** connects anonymously with read-only permissions, matching a real read-only volume.

### Build the Docker image locally

For development from a source checkout, layer the explicit build override over the deployment file:

```sh
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

This builds and runs `partyfinder:local` with the same environment and security settings. The override is not loaded by normal `docker compose` commands. To return to the published image, run `docker compose pull` followed by `docker compose up -d` without the override.

### Compiler, linting, and formatting

`react({ compiler: true })` enables [Vite's native React Compiler integration](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.1.0). The `oxc-transform-react` version is pinned to the plugin's compatible peer range. This integration is experimental; production and browser smoke tests should accompany compiler upgrades.

[Oxlint's React correctness rules](https://oxc.rs/blog/2026-08-18-react-compiler-support) are enabled, including the compiler validations, with unsupported syntax explicitly treated as an error. `pnpm lint` fails on warnings too; `pnpm lint:fix` applies safe fixes. Generated output, dependencies, and disposable fixtures are excluded. The only targeted rule exception permits the intentional security-validation regex that rejects control characters.

`pnpm format` runs Oxfmt; `pnpm format:check` checks without writing. `.oxfmtrc.json` enables [Tailwind class sorting](https://oxc.rs/docs/guide/usage/formatter/sorting.html#sort-tailwind-css-classes), including `clsx`, `cn`, and `cva` arguments. The existing UI still uses custom CSS; this setting does not add a Tailwind build or rewrite its styles. Prettier and the npm lockfile have been removed. Dependencies are installed from `pnpm-lock.yaml` with a one-day minimum package age and only the required esbuild install script permitted.

## API and research notes

The browser talks only to Partyfinder's `/api` routes. Nitro handles routing and assets; the Copyparty adapter uses standard `fetch` against a fixed upstream. No database or additional search index is needed.

| Operation               | Copyparty API                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Browse / verify account | `GET /folder/?ls` (`dirs`, `files`, `acct`, `perms`)                                         |
| Recursive search        | `POST /?srch`, `Content-Type: text/plain`, JSON `{ "q": "…", "n": 250 }`                     |
| Download                | `GET /path/file?dl`, preserving returned `k` file keys and Range headers                     |
| Authenticate            | `PW` request header (or configured replacement)                                              |
| Rename in place         | Empty-body `POST /source?move=<full destination virtual path>`; query value URL-encoded once |
| Delete                  | Empty-body `POST /source?delete`; re-list parent to verify disappearance                     |

Upstream search is global unless its query restricts `path`. Partyfinder builds an equality-or-descendant candidate filter, then verifies each decoded result's directory and literal filename locally. Search paths exclude the upstream reverse-proxy prefix. Returned URLs are checked against the configured origin/base; redirects are not followed with credentials.

Alternatives reviewed during the initial implementation (these notes describe that review, not their current status):

- [Copyparty UI V1.5, PR #1453](https://github.com/9001/copyparty/pull/1453): an unmerged redesign adds folder search, with an official beta image. Reviewed source uses a prefix that can include similarly named sibling folders and different multiword matching semantics.
- [Cool Copyparty Front](https://github.com/andrecrjr/cool-copyparty-front): its search filters the current directory listing in the browser; it does not provide recursive indexed search.

Primary API sources: [Copyparty HTTP API](https://github.com/9001/copyparty/blob/hovudstraum/docs/devnotes.md#http-api), [query parser](https://github.com/9001/copyparty/blob/hovudstraum/copyparty/u2idx.py), and [request handlers](https://github.com/9001/copyparty/blob/hovudstraum/copyparty/httpcli.py).
