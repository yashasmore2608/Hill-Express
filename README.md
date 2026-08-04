# Hill Express

Hyperlocal grocery delivery for hill towns — groceries, uphill, in thirty minutes.

## Surfaces

| Package | What | Stack |
|---|---|---|
| `apps/customer-app` | Customer Android app | Expo SDK 57 · RN 0.86 · Expo Router · NativeWind |
| `apps/driver-app` | Driver Android app (dark-first, 56dp targets) | same |
| `apps/pos-app` | Store/POS Android app (tablet-friendly) | same |
| `apps/admin-web` | Admin panel — installable PWA | React 19 · Vite · Tailwind |
| `apps/api` | Backend | NestJS 11 · Prisma 6 · PostgreSQL · Redis |
| `packages/shared` | Design tokens, domain rules, zod contracts | TypeScript |
| `packages/ui` | RN primitives (AppText, Price, Button, StatusPill, Skeleton) | TypeScript |

One language (TypeScript), one token file (`packages/shared/theme.json`) driving
all four surfaces, one order state machine every surface must agree with.

## First run

```powershell
pnpm install

# API (boots without a database; /v1/health reports what's configured)
pnpm dev:api          # → http://localhost:3000/docs

# Admin PWA
pnpm dev:admin        # → http://localhost:5173

# Mobile (install Expo Go on a phone, scan the QR)
pnpm dev:customer
pnpm dev:driver
pnpm dev:pos
```

## Database

Copy `apps/api/.env.example` → `apps/api/.env`, set `DATABASE_URL`:

- **Docker**: `docker compose up -d` → `postgresql://hillexpress:hillexpress@localhost:5432/hillexpress`
- **Neon**: paste the connection string.

Then: `pnpm prisma:generate && pnpm prisma:migrate`

## Repo conventions (enforced, not aspirational)

- **Money is integer paise** via the branded `Paise` type. Render only through
  `<Price/>` / `formatINR` — Indian 2,2,3 grouping, tabular figures.
- **Order status lives on two axes** (fulfillment × assignment). All transitions
  go through `canTransitionFulfillment/Assignment` in `packages/shared`.
- **Ledgers are append-only** (stock, COD, status history). Balances are SUMs,
  never mutable counters.
- **Cursor pagination only.** `OFFSET` is banned.
- **Skeletons, never spinners.** Every async screen reserves its final layout.
- **Type tokens only** — ten of them. Anything not on the scale doesn't get built.
- **i18n from commit one**: every user-facing string goes through `t()` (wired M1).

## Windows/OneDrive notes

- pnpm's virtual store lives OUTSIDE OneDrive at `C:\pnpm\hill-express`
  (`.npmrc`) — project `node_modules` is just symlinks, so sync stays light.
- Windows long paths are enabled (registry) + `git config core.longpaths true`.
- If Metro ever misbehaves with symlinked deps: switch `.npmrc` to
  `node-linker=hoisted`, delete `node_modules`, reinstall.
