# Partyfinder

A familiar file explorer for a Copyparty server. Browse to a folder, enter a filename phrase, and choose whether to include subfolders. The folder you're viewing is always the search scope.

Built with React, TypeScript, Vite, and [Nitro's Vite integration](https://nitro.build/docs/vite). One dev server, one production build, one Docker container. Nitro's Vite integration currently uses Nitro 3 beta; its version is pinned in `package.json` and the lockfile.

## What it does

- Browse volumes, folders, and files with breadcrumbs, parent navigation, browser back/forward, and recent folders.
- Search just the current directory, or include all its descendants (the default).
- Match a literal phrase anywhere in a filename. No query syntax or quoting required. `foo bar` means those adjacent words; `%`, `_`, quotes, and stars are treated literally.
- Keep strict directory boundaries: `/movies` never includes `/movies-old`.
- Switch list/grid views, sort by name/size/date, filter files/folders, and load more results.
- Choose System, Light, or Dark appearance; System follows OS changes automatically. The preference persists in this browser and also applies to sign-in.
- Right-click a file or folder (or use its **…** button) for permission-aware rename and delete actions. Folder deletion requires operator opt-in; see below.
- Open the current folder or individual files in Copyparty, or download through the authenticated proxy, including HTTP Range support.
- Sign in with a Copyparty password or browse anonymously when allowed. No uploads, cross-directory moves, rescans, or administrative operations are exposed.

## Deploy with Docker Compose

```sh
git clone git@github.com:SeanCassiere/partyfinder.git
cd partyfinder
cp .env.example .env
openssl rand -hex 32
```

Edit `.env`: set `COPYPARTY_URL` to your existing instance, paste the generated value into `SESSION_SECRET`, and set `COOKIE_SECURE` for your deployment.

```dotenv
COPYPARTY_URL=https://copyparty.example.com/
SESSION_SECRET=your-generated-random-secret
COOKIE_SECURE=true
PORT=3925
```

Then start it:

```sh
docker compose up -d --build
docker compose ps
```

Point your HTTPS reverse proxy at port **3925**, preserving the original `Host` header. Partyfinder is served at the root of its own hostname. For a direct local HTTP connection at `http://localhost:3925`, use `COOKIE_SECURE=false`; otherwise the browser will not send the login cookie over HTTP. `true` is appropriate for HTTPS, even when the proxy-to-container connection is HTTP.

The container connects to Copyparty over HTTP(S); it needs no media volume mounts or database. `COPYPARTY_URL` must be reachable from inside the container. `localhost` inside Docker means that container, not your existing Copyparty container: use the Copyparty service name on a shared Docker network, a LAN address, or its public hostname.

Production runs as the unprivileged `node` user with a read-only filesystem, and `/healthz` provides a container health check. The image contains Node and Nitro's `.output` bundle, not source code or build tools. The supplied Compose file builds the image locally; no registry login or prepublished image is required after cloning.

## Deploy behind NGINX Proxy Manager

Use a dedicated hostname such as `partyfinder.homelab.example.com`, not a `/partyfinder` subpath. Keep `COOKIE_SECURE=true`; NPM terminates HTTPS and forwards HTTP to Partyfinder. Configure DNS to resolve this hostname to your NPM server. For a LAN-only deployment, local DNS and a DNS-challenge certificate avoid opening the app to the internet.

### Choose how NPM reaches Partyfinder

**Same Docker host (recommended):** attach both services to a shared external network. This follows [NPM's Docker-network guidance](https://nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network).

```sh
docker network create proxy
```

Skip creation if that network already exists. Add this to Partyfinder's `compose.yaml` (merge into existing keys, do not create duplicate `services` sections):

```yaml
services:
  partyfinder:
    # Keep the existing build/environment/security settings.
    networks:
      - proxy
    # Remove the existing ports: block; NPM connects directly to port 3925.

networks:
  proxy:
    external: true
    name: proxy
```

In NPM's own Compose file, add `proxy` to the NPM service's networks and declare the same external network. Keep its existing networks (especially the network connecting its database). Recreate both stacks with `docker compose up -d` in their respective directories. Use the unique service name **partyfinder** as NPM's upstream hostname.

**Different hosts:** keep Partyfinder's published port and use its Docker host's LAN IP plus the host `PORT` (default `3925`). Restrict that port to NPM using your network/firewall configuration. Do not use `localhost` in NPM: it refers to NPM's own container.

### Create the Proxy Host

In NPM, choose **Hosts → Proxy Hosts → Add Proxy Host**:

| Field                 | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Domain Names          | `partyfinder.homelab.example.com`                                       |
| Scheme                | `http`                                                                  |
| Forward Hostname / IP | `partyfinder` on the shared network, otherwise the Docker host's LAN IP |
| Forward Port          | `3925` on the shared network; otherwise the published host port         |
| Cache Assets          | Off; do not cache authenticated API responses                           |
| Websockets Support    | Not required for the production app                                     |

On the **SSL** tab, select/request a valid certificate and enable **Force SSL**. NPM supports Let's Encrypt or your own certificate; see its [setup guide](https://nginxproxymanager.com/guide/). For internal-only domains, use a supported DNS challenge or a certificate trusted by your devices. Keep NPM's normal original-Host forwarding; do not override `Host` with `partyfinder` or change the request `Origin` header. No Custom Location or custom `proxy_pass` is needed.

Open `https://partyfinder.homelab.example.com/healthz` and expect `{"status":"ok"}`, then test sign-in, folder navigation, a recursive search, and a download. This health check confirms Partyfinder, not upstream Copyparty connectivity. The “Open in Copyparty” link uses `COPYPARTY_URL`, so configure a URL reachable by **both** the container and your browser. Signing into Partyfinder does not sign you into the separate Copyparty browser tab.

Troubleshooting:

- **502 from NPM:** verify the service/network or LAN IP, internal vs published port, and `docker compose ps` / `docker compose logs --tail=100 partyfinder`.
- **Login loops:** use HTTPS and `COOKIE_SECURE=true`; avoid mixing hostnames or HTTP bookmarks.
- **“Cross-site requests” error:** verify NPM preserves the public Host header; avoid embedding the app on another origin.
- **Long-search timeout:** Copyparty requests time out after 55 seconds. Keep the proxy read timeout at least 60 seconds; narrowing the search can help. Raising only NPM's timeout does not extend Partyfinder's upstream timeout.

## Configuration

| Variable                | Purpose                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `COPYPARTY_URL`         | Required fixed upstream base URL, including any reverse-proxy prefix, e.g. `https://files.example.com/party/`. Never supplied by browser users. |
| `SESSION_SECRET`        | Required in production; random value of at least 32 characters. Changing it invalidates sessions.                                               |
| `COOKIE_SECURE`         | `true` for HTTPS; `false` for local HTTP. Compose defaults to `true`.                                                                           |
| `PORT`                  | Published host port in Compose, default `3925`. Container listens on `3925`.                                                                    |
| `COPYPARTY_AUTH_HEADER` | Password header, default `PW`. Change only if your Copyparty instance renamed `--pw-hdr`.                                                       |
| `ALLOW_FOLDER_DELETE`   | `false` by default. Set `true` to expose recursive folder deletion; read the safety notes below first.                                          |

Credentials are encrypted with AES-256-GCM in a 12-hour HttpOnly, SameSite cookie. They are forwarded only to the configured Copyparty server, in its password header, never in URLs or browser storage. The app verifies the resolved Copyparty account rather than assuming HTTP 200 means a password is valid. If your server requires `username:password`, enter that whole value into the password field. Password-header authentication must be enabled upstream; third-party SSO gateways are not currently supported.

The browser stores only display preferences and recent folder paths locally. Copyparty's permissions still govern all access. The app is intended for a trusted homelab, not an anonymous multi-tenant public service.

## Rename and delete

Right-click a row/card, use its **…** button (including on mobile), or focus an item and press **Shift+F10**. Arrow keys navigate the menu; Escape dismisses it. Permissions are checked for the selected item's actual location, including recursive-search results, then rechecked server-side before each operation. Copyparty remains the final authority and can deny actions through its configuration or hooks.

Rename stays in the same directory and requires read/move permissions plus write permission on the destination. Existing names are rejected, including case-only renames. Names cannot contain slashes, backslashes, control characters, or exceed 255 UTF-8 bytes. Root and top-level locations are protected. Copyparty also rejects moving mountpoints and folders containing mounted volumes. Directory renames are **not transactional**: another client can change the destination after the preflight check; upstream failure can leave partial changes. Refresh and inspect before retrying.

File deletion requires read/delete permissions and an explicit confirmation. **Deletion is permanent; Partyfinder has no undo or recycle bin.** The app re-lists the parent to verify disappearance rather than treating every HTTP 200 as a completed deletion. Verification errors or upstream failures can follow partial changes; inspect the directory before retrying.

Folder deletion is off by default because Copyparty can recursively delete hidden files and traverse nested mounted volumes, and its listing API does not reliably identify every mountpoint. To accept that behavior, set `ALLOW_FOLDER_DELETE=true` in `.env` and recreate the container (`docker compose up -d`). The confirmation requires typing the exact folder name and warns about hidden contents and nested volumes. Top-level locations remain blocked; do not treat this as complete nested-volume protection. Keep backups and restrict Copyparty delete permissions accordingly.

## How search behaves

**Include subfolders off:** fetch the current directory's complete listing and match immediate files **and folders**. This works without an index.

**Include subfolders on:** query Copyparty's existing index for matching **files** in the current directory and descendants. Standalone folder matches, empty folders, unindexed files, and document contents are not indexed file-search results. Enable `e2dsa` in Copyparty and keep its index up to date. Dotfiles follow Copyparty's listing/search policies.

Matching ignores ASCII letter case, consistently with Copyparty's default search. Non-ASCII characters are matched literally; Partyfinder does not promise broader Unicode case folding even if the server enables it.

Copyparty has no offset-based search pagination. “Load more results” reruns the query with a larger candidate limit, starting at 250 and stopping at 8,000. The server also has its own limit (`--srch-hits`, normally 7,999), which may be lower. Its API can report `trunc: false` when that hard limit is reached, so counts are **results returned**, never a guaranteed total. Narrow the phrase or enter a deeper directory if necessary. Queries containing SQL wildcard characters retrieve broader candidates and are filtered literally afterward, so their candidate limits may be reached sooner.

Search URLs preserve the directory, phrase, and recursion choice. Opening a result's parent folder exits search; browser Back restores the search. `/` focuses search, Escape clears it, and Alt+Up opens the parent folder.

## Development

Node **22.12+** is required; Node 22 LTS is used in Docker and CI.

```sh
npm ci
cp .env.example .env
# Set COPYPARTY_URL; use COOKIE_SECURE=false for local HTTP.
npm run dev
```

Open `http://127.0.0.1:3925`. Nitro serves the API and Vite serves the React app with hot reload. A missing development session secret generates an ephemeral one; sessions then expire when the server restarts.

```sh
npm test
npm run build
# Production reads process environment; unlike dev, it does not load .env itself:
node --env-file=.env .output/server/index.mjs
```

The standard test suite checks authentication, session tampering, CSRF, path boundaries, encoding, literal matching, streaming downloads, and limits. An additional integration test starts an isolated real Copyparty process with generated fixtures (never your live library):

```sh
git clone --depth 1 https://github.com/9001/copyparty.git work/copyparty
python3 -m venv work/venv
work/venv/bin/pip install jinja2
COPYPARTY_SOURCE="$PWD/work/copyparty" \
COPYPARTY_PYTHON="$PWD/work/venv/bin/python" npm test
```

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

Existing alternatives were checked before building:

- [Copyparty UI V1.5, PR #1453](https://github.com/9001/copyparty/pull/1453): an unmerged redesign adds folder search, with an official beta image. Reviewed source uses a prefix that can include similarly named sibling folders and different multiword matching semantics.
- [Cool Copyparty Front](https://github.com/andrecrjr/cool-copyparty-front): its search filters the current directory listing in the browser; it does not provide recursive indexed search.

Primary API sources: [Copyparty HTTP API](https://github.com/9001/copyparty/blob/hovudstraum/docs/devnotes.md#http-api), [query parser](https://github.com/9001/copyparty/blob/hovudstraum/copyparty/u2idx.py), and [request handlers](https://github.com/9001/copyparty/blob/hovudstraum/copyparty/httpcli.py).
