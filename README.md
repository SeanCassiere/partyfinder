# Partyfinder

A familiar file explorer for [Copyparty](https://github.com/9001/copyparty). Browse to a folder, search a literal filename phrase, and choose whether to include subfolders. No search syntax required.

Includes list/grid views, System/Light/Dark themes, right-click rename/delete, downloads, and “Open in Copyparty.” Recursive search uses Copyparty's file index; current-folder search also matches folders. [Usage and limitations →](docs/usage.md)

## Deploy with Portainer

Use the public [Docker Hub image](https://hub.docker.com/r/seancassiere/partyfinder) on AMD64 or ARM64. No source checkout, database, media mounts, or Docker Hub login required. These instructions target **Docker Standalone**, not Swarm.

### 1. Generate a session secret

Use your password manager or [Bitwarden's free browser generator](https://bitwarden.com/password-generator/): select **Password**, set **64 characters**, enable **A–Z, a–z, 0–9**, and disable **symbols** to avoid Compose escaping issues. Bitwarden states that generation happens locally on your device; no account is required.

Save this new value in your password manager. It is **not your Copyparty password**. Keep it private and reuse it across updates; changing it signs everyone out.

### 2. Paste the stack

In Portainer, select your Docker environment, then **Stacks → Add stack → Web editor**. Name it `partyfinder` and paste this [docker-compose.yml](docker-compose.yml):

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

### 3. Set variables and deploy

Below the editor, add these in **Environment variables**. Leave the `${…}` placeholders in the YAML intact; Portainer substitutes the values. You do **not** need an `.env` file. See [Portainer's stack guide](https://docs.portainer.io/2.33-lts/user/docker/stacks/add).

| Name             | Value                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `COPYPARTY_URL`  | Your Copyparty URL, e.g. `https://files.example.com/`. Must be reachable from both the container and your browser. |
| `SESSION_SECRET` | The random 64-character value generated above.                                                                     |
| `COOKIE_SECURE`  | `true` behind HTTPS; `false` for a direct HTTP test.                                                               |

Click **Deploy the stack**, wait for the container to become **healthy**, then open your HTTPS hostname or `http://YOUR-DOCKER-HOST:3925` for HTTP testing. Sign in with your Copyparty password or use guest access when allowed.

For **NGINX Proxy Manager**, keep `COOKIE_SECURE=true` and use a dedicated hostname pointing to Partyfinder on port **3925**. Follow the [NPM setup guide](docs/deployment.md#deploy-behind-nginx-proxy-manager) for networking and SSL.

Optional variables: `PORT` (default `3925`), `PARTYFINDER_VERSION` (default `1.0.0`), and `COPYPARTY_AUTH_HEADER` (default `PW`). Folder deletion is disabled by default. **Deletes are permanent**; read the [safety notes](docs/usage.md#rename-and-delete) before enabling `ALLOW_FOLDER_DELETE`.

### Updates

Open the stack's **Editor**, set `PARTYFINDER_VERSION` to a published [image tag](https://hub.docker.com/r/seancassiere/partyfinder/tags), and **Update the stack**, enabling the image re-pull option when prompted. Keep your existing `SESSION_SECRET`. To roll back, repeat with the previous version. `latest` is also supported, but does not update a running container automatically.

## More documentation

- [Deployment reference](docs/deployment.md): Docker Compose CLI, NGINX Proxy Manager, configuration, backups, and troubleshooting.
- [Usage](docs/usage.md): search behavior, permissions, and rename/delete safety.
- [Development](docs/development.md): local builds, tests, tooling, and Copyparty API notes.
- [Publishing](docs/publishing.md): maintainer-only Docker Hub release pipeline.
