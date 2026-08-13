# Deploying Hill Express

Only the **admin PWA** goes on Vercel. It is a static Vite bundle, so it cannot
talk to a database on its own — the API has to be live first, or the admin panel
loads and then fails every request.

| Surface | Where it goes | Why |
|---|---|---|
| `apps/admin-web` | **Vercel** | Static React/Vite bundle + service worker |
| `apps/api` | **Render** | Long-running NestJS process, writes files to disk |
| `apps/customer-app` | **Vercel** (demo) / **EAS** (real) | Expo static web export for a shareable link; APK via EAS for the actual product — see §4 |
| `apps/driver-app`, `pos-app` | **EAS Build** | Expo/React Native — ship as APKs, Vercel cannot host them |

Order matters: **Render first**, because Vercel needs the API's URL.

---

## How the two halves connect

`apps/admin-web/src/lib/api.ts` calls **relative** paths — `fetch('/v1/orders')`,
never an absolute URL. Its own comment says *"same-origin behind Caddy in prod"*.
There is no Caddy on Vercel, so `vercel.json` reproduces it with rewrites:

```
browser → https://your-app.vercel.app/v1/orders
          → (Vercel rewrite) → https://hill-express-api.onrender.com/v1/orders
```

This was chosen over a `VITE_API_URL` build variable on purpose: banner artwork
is stored **in the database** as a relative `/uploads/...` path and rendered
straight into `<img src={b.imageUrl}>` ([Banners.tsx:60](../apps/admin-web/src/pages/Banners.tsx#L60)).
A base-URL variable would leave every one of those images broken. Same-origin
rewrites also mean no CORS and no preflight on any request.

---

## 1 · API on Render

1. **Render → New → Blueprint**, pick the `tech976/hill-express` repo. It reads
   [`render.yaml`](../render.yaml) and proposes a `hill-express-api` web service.
2. Fill in the four secrets it prompts for (all marked `sync: false`):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string — keep `sslmode=require`, strip `channel_binding` |
   | `DIRECT_URL` | Neon **direct** (non-pooler) string — `prisma migrate` needs session mode |
   | `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `JWT_REFRESH_SECRET` | run the same command again — **a different value** |

   Both JWT secrets must be ≥ 32 characters or the API exits at boot; the zod
   schema in `src/config/env.ts` rejects anything shorter.
3. Deploy. The build runs `prisma migrate deploy`, so a bad migration fails the
   deploy instead of taking the running instance down.
4. Confirm `https://<your-service>.onrender.com/v1/health` responds.

**Do not set `SERVICE_ALL_PINCODES`.** It makes every pincode serviceable — in
production that lets anyone in the country place an order. It is deliberately
absent from `render.yaml`.

### Seeding

Render's free plan has no shell. Seed from your machine, pointed at the prod DB:

```powershell
cd apps/api
$env:DATABASE_URL="<neon-pooled-url>"; pnpm seed
```

The seed is idempotent — safe to re-run.

---

## 2 · Point Vercel at that URL

Render names the service `https://hill-express-api.onrender.com` if that
hostname is free, and appends a suffix if it isn't. Check the real one, then —
if it differs — edit both `destination` fields in [`vercel.json`](../vercel.json)
and commit:

```jsonc
"destination": "https://YOUR-ACTUAL-URL.onrender.com/v1/:path*"
"destination": "https://YOUR-ACTUAL-URL.onrender.com/uploads/:path*"
```

Vercel does not expand environment variables inside `vercel.json` rewrites, so
this genuinely has to be the literal hostname.

---

## 3 · Admin panel on Vercel

1. **Vercel → Add New → Project**, import `tech976/hill-express`.
2. Leave **Root Directory** as the repo root — *do not* set it to
   `apps/admin-web`. The build is a pnpm workspace and needs the root lockfile.
3. Framework preset: **Other**. Every build setting comes from `vercel.json`;
   leave the dashboard fields blank so they don't override it.
4. No environment variables are needed — the admin panel has none.
5. Deploy.

### What `vercel.json` is doing

- **installCommand** — two overrides, both load-bearing:
  - `--filter @hillexpress/admin-web...` restricts the install to the admin
    panel and its workspace dependencies — 2 of 8 projects, 420 packages
    instead of 1150. Without it pnpm installs Expo and React Native for all
    three mobile apps to build a Vite bundle that uses none of them. The
    trailing `...` is pnpm syntax for "and its dependencies"; it is what pulls
    in `@hillexpress/shared`, so do not drop it.
  - `--config.virtual-store-dir=node_modules/.pnpm` undoes the repo `.npmrc`,
    which pins the store to `C:\pnpm\hill-express` to keep pnpm out of
    OneDrive. That path is meaningless on Vercel's Linux builders. Leave the
    `.npmrc` alone — local dev still needs it.
- **buildCommand** — builds `@hillexpress/shared` first. `admin-web`'s build
  starts with `tsc --noEmit`, which resolves `@hillexpress/shared` through its
  compiled `dist/index.d.ts`; without that step the typecheck fails.
- **SPA catch-all** — react-router owns `/orders`, `/dispatch`, `/login`.
  Without the `/(.*)` → `/index.html` rewrite, refreshing on any of them 404s.
  Vercel checks the filesystem before applying rewrites, so real assets and
  `sw.js` still resolve normally.
- **`sw.js` no-cache header** — the PWA registers with `autoUpdate`. A cached
  service worker would pin users to a stale build.

---

## 4 · Customer app

### As a web link (client demos)

`apps/customer-app/vercel.json` drives this — a **second Vercel project**, with
Root Directory set to `apps/customer-app`. Two projects cannot share the root
`vercel.json`, which is why this one carries its own and reaches back up with
`cd ../..` for the install. That requires *"Include source files outside of the
Root Directory"*, which Vercel enables by default for monorepos.

Set one environment variable: **`EXPO_PUBLIC_API_URL`** = the Render URL.
[api.ts](../apps/customer-app/src/lib/api.ts) reads it directly and `assetUrl()`
builds absolute image URLs from it, so this app needs no proxy rewrites — unlike
the admin panel. It is inlined at build time, so changing it means redeploying.

The rewrites exist because `expo export` emits dynamic routes as literal
`[id].html` files. Vercel will not map `/product/123` onto those by itself.

Caveat: the export is a 2.7 MB JS bundle. Acceptable for a demo over wifi, not
what you want to serve customers on a hill-town mobile network.

### As an APK (the real product)

```powershell
npm i -g eas-cli
eas login
cd apps/customer-app
eas build:configure
eas build -p android --profile preview   # preview = APK; production = AAB
```

EAS returns a download link. This sidesteps the Expo Go SDK mismatch entirely —
the client installs a real app. `EXPO_PUBLIC_API_URL` goes in `eas.json` for the
profile and is compiled in, so the API must be live before you build.

### OTP will block any demo unless you change one thing

There is no real SMS provider — [auth.module.ts](../apps/api/src/auth/auth.module.ts)
wires `ConsoleSmsProvider` and the Msg91 swap is commented out. And
[auth.service.ts](../apps/api/src/auth/auth.service.ts) only returns `devOtp` in
the response when `NODE_ENV === 'development'`.

So under `NODE_ENV=production` no SMS is sent **and** the code is not returned:
nobody can sign in. For a demo, set `NODE_ENV=development` on the Render service
and treat the URL as private — that flag turns the deployment into a free pass
into any account. The admin panel is unaffected; it uses email/password.

## Known gaps

- **Cold starts.** Render's free plan sleeps a service after 15 minutes idle.
  The next request takes roughly 50 seconds while it wakes, and the admin login
  will look frozen. A paid instance removes this.
- **Uploaded images do not survive a redeploy.** The API writes banner artwork
  and invoice PDFs to local disk (`UPLOAD_DIR`), and Render's free plan has an
  ephemeral filesystem. Fixing it properly means either a Render persistent disk
  (paid — mount at `/var/data` and set `UPLOAD_DIR=/var/data/uploads`) or moving
  uploads to object storage. Until then, treat uploaded banners as disposable.
- **PWA icons 404.** `vite.config.ts` declares `/pwa-192.png` and `/pwa-512.png`
  in the manifest, but `apps/admin-web` has no `public/` directory, so neither
  file exists. The app installs, with a blank icon. Drop the two PNGs into
  `apps/admin-web/public/` to fix.
- **Invoice PDFs are served through the API**, not the static `/uploads` mount —
  `/uploads/invoices` is deliberately 404'd and ownership is checked on
  `GET /v1/invoices/:id/document`. The rewrites preserve this; don't "fix" it.
