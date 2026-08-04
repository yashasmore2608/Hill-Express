# Running Hill Express

Everything below runs from the repo root unless said otherwise.

## 0 · One-time setup (already done on this machine)

```powershell
npm i -g pnpm          # package manager
pnpm install           # all workspace deps
```

`apps/api/.env` holds the Neon DATABASE_URL + JWT secrets (never committed).
New machine? Copy `.env.example` → `.env`, fill it, then:

```powershell
cd apps/api
npx prisma migrate deploy   # apply all migrations
pnpm seed                   # demo store + 24 products
```

## 1 · Start the backend

```powershell
pnpm dev:api
```

- Health:  http://localhost:3000/v1/health
- Swagger: http://localhost:3000/docs — every endpoint, try them in the browser

Keep this terminal open. OTPs are printed here in dev.

## 2 · Run the customer app on your phone

> ⚠️ **The store versions of Expo Go do not work yet.** This project is on
> **SDK 57**; the App Store / Play Store builds of Expo Go still ship SDK 54,
> so they show *"Project is incompatible with this version of Expo Go"*.
>
> - **Android** — install the SDK 57 build directly (Expo publishes it):
>   https://expo.dev/go?sdkVersion=57&platform=android&device=true
>   Uninstall the Play Store Expo Go first, then allow "install unknown apps".
> - **iOS** — no workaround; sideloading needs a paid Apple developer account.
>   Use the browser preview (§2b) or an Android emulator until Expo's SDK 57
>   build clears App Store review.

1. Install **Expo Go** (see the note above — use the SDK 57 build).
2. Phone and PC on the **same wifi**.
3. In a second terminal:

```powershell
pnpm dev:customer
```

4. Scan the QR code with Expo Go (Android: scanner inside Expo Go; iPhone: camera app).
5. Sign in with **any valid mobile number** — the OTP shows as an amber hint
   on the OTP screen and in the API terminal (dev only, never in production).

If the phone can't reach the API: the app derives your PC's LAN IP from
Metro automatically, but Windows Firewall may block port 3000 — allow
Node.js on private networks when prompted, or once:
`netsh advfirewall firewall add rule name="HillExpress API" dir=in action=allow protocol=TCP localport=3000`

Wifi blocked entirely (hostel/college networks)? Use `npx expo start --tunnel`.

## 2b · Preview in a browser (no phone needed)

```powershell
pnpm dev:customer -- --web    # or: cd apps/customer-app; npx expo start --web
```

Opens at http://localhost:8081. Useful for fast UI iteration when no device
is handy. Caveats: haptics and GPS are no-ops, and tokens fall back to
`localStorage` instead of the hardware keystore (see `lib/secure-storage.ts`).
**Always confirm real behaviour on Android** — the back button, ripples, and
elevation only exist there.

## 3 · The other surfaces

```powershell
pnpm dev:driver     # driver app — sign in with +91 99999 00002 (dark-first)
pnpm dev:pos        # store app  — sign in with +91 99999 00001
pnpm dev:admin      # admin PWA  — http://localhost:5173
```

Each Expo app gets its own QR — only run the ones you need.

## 4 · Useful commands

```powershell
pnpm -r typecheck                    # typecheck all 7 packages
pnpm --filter @hillexpress/api build # compile the API
cd apps/api; npx prisma studio       # browse the database in a GUI
cd apps/api; pnpm seed               # re-seed (idempotent, safe to re-run)
```

## 5 · What works right now (through M4)

| Flow | Where |
|---|---|
| OTP sign-in / session restore | all three apps |
| Store home, categories, product grid | customer |
| Search with typo tolerance ("aata" finds Atta) | customer |
| Cart with optimistic sync + live bill + free-delivery bar | customer |
| Addresses (max 2) with serviceability check | customer |
| Checkout | **M8 — button visible but disabled** |
