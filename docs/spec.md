# Ethos on web: spec

Agreed 2026-09-25 in a grilling session. Source app: `pembasmikuman/Ethos` (Expo, sideloaded IPA), which stays as is.

## Why

Sideloading through SideStore means re-signing every 7 days. A home-screen web app installs from a URL, updates itself, and can reach other devices later.

## Target

- iPhone Safari, installed to the home screen. iOS 17 or newer.
- Other devices are a bonus: not tested, but nothing should be iPhone-only on purpose.
- Anyone can install it. No accounts. Every device keeps its own data.

## Stack

- Vite + React + TypeScript + Zustand. `bun` for dev, build, test.
- vite-plugin-pwa for the manifest and the service worker (offline precache).
- Plain CSS with custom properties for dark and light. CSS transitions instead of Reanimated. Pointer events for swipe and drag. No gesture library, no router library.
- Storage: official SQLite WASM (`@sqlite.org/sqlite-wasm`), opfs-sahpool VFS, in a Web Worker. The existing SQL, migrations and queries carry over. Call `navigator.storage.persist()`.

## Scope (v1)

Everything the native app does, 1:1 look (dot-matrix, Doto + JetBrains Mono self-hosted), except:

- No exercise GIF animations. Library names and step text stay.
- No session photos. Photos inside an imported backup are stored untouched so a re-export loses nothing.
- No haptics.

## Rest timer

- Foreground: the screen is kept awake (Wake Lock) during a session. When rest ends, a synthesized boxing bell rings "ding-ding-ding" (Web Audio, no sound file).
- Unlocked but in another app: a Cloudflare Worker + Durable Object alarm sends a Web Push at the end of rest.
- Accepted limits: push needs signal when rest starts; the push uses the iOS default sound, not the bell; the push banner shows even while Ethos is open.
- Push server guards: only real push-service endpoints (Apple, Google, Mozilla, Microsoft), delay capped at 10 minutes, one pending alarm per device, rate limit per IP. VAPID keys in Worker secrets and `.env`.
- Notification permission is asked the first time rest starts. Settings shows the alert status.

## Data

- JSON backup format unchanged (`app: 'ethos', version: 1`), including `photo_files`. It is the migration path from the native app.
- The in-progress workout is saved to SQLite on every change. A reload lands on the same set with the same rest countdown.

## Hosting

- `ethos.pembasmikuman.my` (Cloudflare DNS already holds the zone). One Worker serves the static app and `/api/*`.
- Deploy: GitHub Action on push to `main`, `bunx wrangler deploy` for manual deploys.
- Updates apply silently on the next cold launch, never mid-workout.
- Repo: `pembasmikuman/Ethos-on-web`, public.

## Tests

- Port the native logic tests to `bun test`.
- One Playwright WebKit test: import a real backup, export, compare.
