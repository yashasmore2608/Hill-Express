# Hill Express API.
#
# A Dockerfile rather than a buildpack: this is a pnpm workspace, and the
# builders guess wrong about which of the seven packages to start. Here the
# install is scoped to the API and its workspace deps, so no Expo or React
# Native dependency is ever fetched onto the server.

FROM node:22-bookworm-slim

# Prisma's query engine links against OpenSSL; the slim image omits it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# The lockfile governs, so copy the manifests first — this layer only rebuilds
# when a dependency actually changes, not on every source edit.
#
# EVERY workspace manifest has to be here, including the three Expo apps we
# never build: --frozen-lockfile validates the lockfile against the whole
# workspace, and a missing package.json fails the install outright. Only their
# manifests are copied, never their source, and --filter keeps their
# dependencies from being fetched.
# tsconfig.base.json is not optional: every package extends it, and without it
# tsc silently falls back to ES5 defaults rather than erroring, which surfaces
# as a wall of "change your target library" errors from inside node_modules.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/admin-web/package.json apps/admin-web/
COPY apps/customer-app/package.json apps/customer-app/
COPY apps/driver-app/package.json apps/driver-app/
COPY apps/pos-app/package.json apps/pos-app/

# .npmrc pins pnpm's store to a Windows path for the OneDrive machines; override
# it here or the store lands in a directory literally named C:\pnpm\...
RUN pnpm install --frozen-lockfile --filter @hillexpress/api... \
  --config.virtual-store-dir=node_modules/.pnpm

COPY packages/ packages/
COPY apps/api/ apps/api/

RUN pnpm --filter @hillexpress/shared build \
  && pnpm --filter @hillexpress/api exec prisma generate \
  && pnpm --filter @hillexpress/api build

ENV NODE_ENV=production

# Migrations run at START, not at build: the database URL is a runtime variable,
# and migrate deploy is idempotent, so a redeploy with no new migrations is a
# no-op rather than a failure.
WORKDIR /app/apps/api
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
