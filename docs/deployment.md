# Deployment reference

[Back to quickstart](../README.md#deploy-with-portainer)

The README covers terminal-free Portainer deployment. This guide covers CLI deployment, NGINX Proxy Manager, and all configuration options.

## Deploy with Docker Compose

Use the published [Docker Hub image](https://hub.docker.com/r/seancassiere/partyfinder). It supports **AMD64 and ARM64**; Docker selects the correct architecture automatically. You only need Docker Engine with the Compose plugin—no source checkout, Node.js, pnpm, database, or media mounts.

Create a deployment directory:

```sh
mkdir -p partyfinder
cd partyfinder
```

Save this as **`docker-compose.yml`** (the repository includes the same file):

```yaml
services:
  partyfinder:
    image: seancassiere/partyfinder:${PARTYFINDER_VERSION:-1.0.0}
    restart: unless-stopped
    ports:
      - '${PORT:-3925}:3925'
    environment:
      COPYPARTY_URL: ${COPYPARTY_URL:?Set COPYPARTY_URL in stack environment or .env}
      SESSION_SECRET: ${SESSION_SECRET:?Set SESSION_SECRET in stack environment or .env}
      COOKIE_SECURE: ${COOKIE_SECURE:-true}
      COPYPARTY_AUTH_HEADER: ${COPYPARTY_AUTH_HEADER:-PW}
      ALLOW_FOLDER_DELETE: ${ALLOW_FOLDER_DELETE:-false}
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

Generate a session secret with your password manager or the [browser generator instructions](../README.md#1-generate-a-session-secret), or use:

```sh
openssl rand -hex 32
```

Create **`.env`** alongside `docker-compose.yml`. Set your Copyparty URL, paste the generated secret, and choose the cookie setting for your deployment. If you already cloned the repository, copy `.env.example` to `.env` instead; do not overwrite an existing configured `.env`.

```dotenv
PARTYFINDER_VERSION=1.0.0
COPYPARTY_URL=https://copyparty.example.com/
SESSION_SECRET=replace-with-the-generated-64-character-secret
COOKIE_SECURE=true
PORT=3925
COPYPARTY_AUTH_HEADER=PW
ALLOW_FOLDER_DELETE=false
```

Use `COOKIE_SECURE=true` behind HTTPS (including NGINX Proxy Manager). For a direct HTTP test at `http://localhost:3925`, change it to `false` **before starting**. Keep the secret private and stable across restarts; replacing it signs everyone out.

Validate, pull, and start:

```sh
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
```

The service should become **healthy**. Open your configured HTTPS hostname, or `http://localhost:3925` for the HTTP test. Sign in with your Copyparty password or choose guest access if your server allows it. No Docker Hub login is needed to pull the public image; publishing credentials are only for maintainers.

Point your HTTPS reverse proxy at port **3925**, preserving the original `Host` header. Partyfinder is served at the root of its own hostname. `COOKIE_SECURE=true` is appropriate for HTTPS even when the proxy-to-container connection is HTTP. See [NGINX Proxy Manager setup](#deploy-behind-nginx-proxy-manager) below.

The container connects to Copyparty over HTTP(S). Set `COPYPARTY_URL` to an address reachable from **both the container and your browser**, since “Open in Copyparty” links use it too. `localhost` inside Docker means that container, not your existing Copyparty container. Use a suitable LAN or public hostname, including any upstream proxy prefix.

Production runs as the unprivileged `node` user with a read-only filesystem, and `/healthz` provides a container health check. The image contains Node and Nitro's `.output` bundle, not source code or build tools. Keep `.env` backed up; there is no Partyfinder data volume to migrate.

### Updates and rollback

The default is pinned to `1.0.0` for a predictable deployment. Change `PARTYFINDER_VERSION` in `.env` to a published version from [Docker Hub tags](https://hub.docker.com/r/seancassiere/partyfinder/tags), then run:

```sh
docker compose pull
docker compose up -d
docker compose ps
```

Alternatively, set `PARTYFINDER_VERSION=latest` and use the same commands to fetch the newest published release. `latest` does not update a running container automatically. To roll back, restore the previous version in `.env` and run these commands again, keeping the existing `SESSION_SECRET`.

Use `docker compose logs --tail=100 partyfinder` for troubleshooting. `docker compose down` stops and removes the deployment's containers/network, but does not delete `.env` or any files on Copyparty.

**Migrating from the old local-build setup:** the tracked `compose.yaml` has been replaced by `docker-compose.yml`. Existing `.env` files still work, defaulting to image version `1.0.0`. If you copied the old file into a standalone installation, keep only one default Compose file or explicitly use `docker compose -f docker-compose.yml …`; Docker prefers `compose.yaml` when both exist. Do not keep `build: .` or `image: partyfinder:local` in the published-image deployment. For intentional local builds, use the [development override](development.md#build-the-docker-image-locally).

## Deploy behind NGINX Proxy Manager

Use a dedicated hostname such as `partyfinder.homelab.example.com`, not a `/partyfinder` subpath. Keep `COOKIE_SECURE=true`; NPM terminates HTTPS and forwards HTTP to Partyfinder. Configure DNS to resolve this hostname to your NPM server. For a LAN-only deployment, local DNS and a DNS-challenge certificate avoid opening the app to the internet.

### Choose how NPM reaches Partyfinder

**Same Docker host (recommended):** attach both services to a shared external network. This follows [NPM's Docker-network guidance](https://nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network).

In Portainer, open **Networks → Add network**, name it `proxy`, choose the **bridge** driver, and create it. Alternatively, with the CLI:

```sh
docker network create proxy
```

Skip creation if that network already exists. Add this to Partyfinder's `docker-compose.yml` (merge into existing keys, do not create duplicate `services` sections):

```yaml
services:
  partyfinder:
    # Keep the existing image/environment/security settings.
    networks:
      - proxy
    # Remove the existing ports: block; NPM connects directly to port 3925.

networks:
  proxy:
    external: true
    name: proxy
```

In NPM's own Compose file, add `proxy` to the NPM service's networks and declare the same external network. Keep its existing networks (especially the network connecting its database). In Portainer, save these changes in each stack's **Editor** and use **Update the stack**. With the CLI, run `docker compose up -d` in each stack's directory. Use the unique service name **partyfinder** as NPM's upstream hostname.

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

In Portainer, inspect the container's health and **Logs** from the stack's container list; no CLI is required.

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
| `PARTYFINDER_VERSION`   | Docker Hub image tag used by Compose, default `1.0.0`. Set to a published version or `latest`. Not an application environment variable.         |
| `COPYPARTY_AUTH_HEADER` | Password header, default `PW`. Change only if your Copyparty instance renamed `--pw-hdr`.                                                       |
| `ALLOW_FOLDER_DELETE`   | `false` by default. Set `true` to expose recursive folder deletion; read the [deletion safety notes](usage.md#rename-and-delete) first.         |

Credentials are encrypted with AES-256-GCM in a 12-hour HttpOnly, SameSite cookie. They are forwarded only to the configured Copyparty server, in its password header, never in URLs or browser storage. The app verifies the resolved Copyparty account rather than assuming HTTP 200 means a password is valid. If your server requires `username:password`, enter that whole value into the password field. Password-header authentication must be enabled upstream; third-party SSO gateways are not currently supported.

The browser stores only display preferences and recent folder paths locally. Copyparty's permissions still govern all access. The app is intended for a trusted homelab, not an anonymous multi-tenant public service.

## Secrets and backups

`SESSION_SECRET` encrypts Partyfinder's session cookies; it is not your Copyparty password. Generate it once, keep it in a password manager, and retain it when updating or rolling back. Replacing it signs everyone out. Never use the example placeholder or paste existing secrets into websites, support tickets, or source control.

Stack environment variables are not a dedicated secrets vault: Portainer/Docker administrators can inspect them. Restrict access to those tools and protect stack exports and backups. For CLI deployment, protect `.env` (for example, `chmod 600 .env`) and exclude it from source control. There is no Partyfinder data volume to back up; your files remain on Copyparty.
