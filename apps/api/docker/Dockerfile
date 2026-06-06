# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22
ARG PNPM_VERSION=11.0.8

# ─────────────────────────────────────────────────────────────────────
# Stage 1 — deps : full install (avec devDeps) + prisma generate via postinstall
# ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
ARG PNPM_VERSION
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml .pnpmfile.cjs package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/api-contracts/package.json ./packages/api-contracts/
COPY packages/tsconfig/ ./packages/tsconfig/
COPY scripts ./scripts
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────
# Stage 2 — build : @fluch/api-contracts puis @fluch/api
# ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build
ARG PNPM_VERSION
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=deps /repo /repo
COPY . .

RUN pnpm --filter @fluch/api-contracts build \
 && pnpm --filter @fluch/api build

# ─────────────────────────────────────────────────────────────────────
# Stage 3 — deploy : pnpm deploy --prod → bundle /deploy autonome
# Pattern officiel pnpm pour image Docker prod minimale (cf. https://pnpm.io/cli/deploy).
# Requiert `injectWorkspacePackages: true` dans pnpm-workspace.yaml.
# `--ignore-scripts` : skip postinstall `prisma generate` (client déjà compilé).
#
# Cascade peer-optional (prisma CLI, react-dom, kysely…) déjà coupée via
# `.pnpmfile.cjs` à la racine (workaround bug pnpm#11155). Aucun cleanup post-deploy
# nécessaire ici.
# ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deploy
ARG PNPM_VERSION
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=build /repo /repo

RUN pnpm --filter @fluch/api deploy --prod --ignore-scripts /deploy

# @prisma/client@7 embarque les WASM compilers de TOUTES les DBs (cockroachdb,
# mysql, sqlite, sqlserver) en plus de postgresql. On n'utilise que postgresql
# via @prisma/adapter-pg → suppression des WASMs inutiles (~60 MB).
RUN for db in cockroachdb mysql sqlite sqlserver; do \
      find /deploy/node_modules/.pnpm -path '*/@prisma/client/runtime/*' \
        -name "query_compiler*.${db}.*" -delete 2>/dev/null || true; \
    done

# ─────────────────────────────────────────────────────────────────────
# Stage 4 — migrate : node:22-alpine + prisma CLI + schema (target=migrate)
# Image dédiée aux jobs pre-deploy : `docker run --rm migrate` applique les
# migrations puis exit. Réutilise le stage deps (cache mutualisé).
# ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS migrate
ARG PNPM_VERSION
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=deps /repo /repo

WORKDIR /repo/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ─────────────────────────────────────────────────────────────────────
# Stage 5 — runtime : distroless nonroot (target par défaut)
# ─────────────────────────────────────────────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production

# pnpm deploy → /deploy contient déjà : node_modules autonome, dist/, package.json,
# prisma/, prisma.config.ts. Un seul COPY suffit.
COPY --from=deploy --chown=nonroot:nonroot /deploy ./

USER nonroot:nonroot
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["dist/main.js"]
