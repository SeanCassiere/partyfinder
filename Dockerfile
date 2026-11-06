# check=skip=InvalidDefaultArgInFrom
# The Node version comes from .nvmrc; pass it with --build-arg NODE_VERSION="$(cat .nvmrc)".
ARG NODE_VERSION

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY .nvmrc ./
RUN [ "$(node -p 'process.versions.node.split(".")[0]')" = "$(cut -d. -f1 .nvmrc)" ] \
  || { echo "NODE_VERSION build arg must match .nvmrc ($(cat .nvmrc))" >&2; exit 1; }
# Node 25+ no longer bundles Corepack; it installs the pnpm pinned in packageManager.
RUN npm install -g corepack@0.36.0 && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3925
ARG APP_VERSION=dev
ARG COMMIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/SeanCassiere/partyfinder" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$COMMIT_SHA
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3925
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3925/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
