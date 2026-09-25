# Ethos on web

<img src="public/icon-512.png" alt="Ethos app icon" width="120">

Personal workout tracker for iPhone, as a home-screen web app. Dot-matrix readout, one orange accent, nothing else.

The same app as [Ethos](https://github.com/pembasmikuman/Ethos), rebuilt so it installs from Safari instead of being sideloaded. Logs sets fast, suggests the next weight, rings a boxing bell when rest is over. Works offline, keeps everything on the phone, no account.

Live at **https://ethos.pembasmikuman.my**.

## What it does

- **Routines** are plans (UL, PPL). Each holds days (Day A, Day B). Days hold exercises with target sets.
- **Preview then start.** Reorder, swap, add, remove exercises before or during a session.
- **Logging.** Custom numpad, kg → reps → RIR in one flow, previous session inline, swipe a set left to remove it, swipe up for the next exercise.
- **Progression rule per exercise.** Double progression (default), linear, or Greyskull LP. Every pre-filled weight says why. Bodyweight moves progress in reps, timed moves log seconds, per-side moves show the split.
- **Rest timer** with a boxing bell ("ding-ding-ding") when it hits zero, and a notification if you're in another app. The screen stays on during a session.
- **Moves** grouped by movement, variants per equipment and machine brand. Each variant keeps its own history and est. 1RM trend.
- **Library** of 1,200+ exercises with step instructions. Search it from the picker or the new-exercise form. See [docs/NOTICE.md](docs/NOTICE.md).
- **Home** carousel: weekly hard sets per muscle against the 10–20 band, training days grid, front and back muscle map shaded by this week's work.
- **History** with edit and delete. Finishing a session lands on its review, where you can still add sets and exercises.
- **Backup** to JSON via the share sheet, restore from Files. Same file format as the native app.
- A workout in progress survives the app being closed, down to the rest countdown.
- Dark and light.

Not carried over from the native app: exercise animations, session photos, haptics. Photos inside an imported backup are kept, so exporting again gives them back.

## Install on iPhone

Needs iOS 17 or newer.

1. Open **ethos.pembasmikuman.my** in Safari.
2. Share → **Add to Home Screen**.
3. Open it from the Home Screen icon, not from Safari. Only the installed app gets rest alerts, and the data belongs to the installed app.

Updates download in the background and apply the next time you open the app from scratch, never in the middle of a workout.

## Rest alerts: what works and what doesn't

- **Ethos open:** the bell rings when rest ends.
- **Phone unlocked, you're in another app** (Spotify, messages): a "Rest done" banner shows up. The first time you rest, iOS asks if Ethos can send notifications. Say yes.
- **Phone locked:** not covered.

The limits, in plain words:

- The banner is sent from a small server, so the phone needs signal at the moment you start the rest. No signal then, no banner.
- The banner uses the iPhone's normal notification sound, not the bell.
- The banner also shows while Ethos is open. iOS doesn't let a web app hide it.
- With the silent switch on, iOS may mute the bell.

Settings → **Rest alerts** tells you whether they are on, off, blocked, or not available (for example in plain Safari).

## Moving your data from the native app

1. In the old app: Settings → **Export**, save the file to Files (or AirDrop it to yourself).
2. In Ethos on web: on the first screen tap **Restore from a backup file**, or later Settings → **Restore**. Pick the file.

Restore replaces everything in the new app. History, routines, custom exercises and notes come across.

## Stack

Vite, React, TypeScript, Zustand, plain CSS. Data lives in SQLite (WASM) stored on the phone (OPFS), inside a web worker. vite-plugin-pwa caches the whole app for offline use. A Cloudflare Worker serves the app and, with a Durable Object alarm, sends the rest-done push. `bun` only.

## Run

```
bun install
bun scripts/vapid-keys.ts > .env   # once: the push keys. Never commit .env
bun run dev
```

```
bun run check    # types, app and worker
bun run test     # logic, database and push tests via bun:sqlite
bun run e2e      # WebKit backup round trip, runs in Playwright's container (needs podman)
```

`bun run e2e` can also check a real backup: `ETHOS_BACKUP=/path/to/backup.json bun run e2e`. Keep that file out of git.

## Deploy

Pushing to `main` runs the Deploy action: check, test, build, then `wrangler deploy` to Cloudflare. It needs:

- repo variable `VAPID_PUBLIC_KEY` (the `VITE_VAPID_PUBLIC_KEY` value from `.env`)
- repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- the worker secret, set once: `bunx wrangler secret put VAPID_PRIVATE_JWK` (paste the value from `.env`)

## Design

Doto for numbers and titles, JetBrains Mono for labels, warm off-black and off-white, dot graphics carry the data. A 1:1 port of the native app's look.
