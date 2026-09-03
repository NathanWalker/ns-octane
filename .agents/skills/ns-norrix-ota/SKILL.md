---
name: ns-norrix-ota
description: Use when integrating @norrix/client-sdk OTA (over-the-air) updates in a NativeScript app, when an OTA apply shows a black screen after reload, or when npm install of the SDK fails on peer deps — install, a norrix.ts util, explicit sync from a Settings page, and an apply-now flow with a RootLayout progress overlay that must be torn down before the runtime reload.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Norrix OTA updates in NativeScript

Docs: https://docs.norrix.net/sdk/installation/ and `/sdk/configuration/`

## Install

```bash
npm install @norrix/client-sdk --legacy-peer-deps
```

The SDK ships its native modules and registers `after-prepare`
hooks itself — no manual native config.

## The wrapper util (`norrix.ts`)

One module owns the SDK; components never call `initNorrix` directly.

- **Disabled in dev**: gate everything on `!__DEV__` — OTA against local
  bundles is meaningless and the SDK skips under HMR anyway. For local UX
  work, put the toast → confirm → progress flow behind a dev-only flag
  (e.g. `--env.DEBUG_OTA_UI`) or a dev-build helper like
  `global.showOtaToast('1.2.3 (45)')` so the whole flow can be rehearsed on
  demand with the reload skipped.
- **Deferred init**: call the init function from the app component's
  post-launch stage, and wrap `initNorrix(...)` in a further `setTimeout`
  (~4 s) — network work must stay off the boot path.
- Options that matter: `updateUrl: 'https://norrix.net'`, `orgId` (from the
  Norrix dashboard — app-specific), `checkForUpdatesOnLaunch: true`,
  `installUpdatesAutomatically: true`, `promptToRestartAfterInstall: false`
  when you present your own apply UI, `useRestartPage: true`.
- **Status → one reactive source**: the `statusCallback` feeds a single
  signal/subject (e.g. `otaStatus`) that all UI reads. Route
  `data.requiresStoreUpdate` to an "open the store" state — never apply
  those.
- **Running code version**: after an OTA activates, the binary version is
  stale. Read `ApplicationSettings` keys `Norrix_OTA_Version` /
  `Norrix_OTA_BuildNumber`, falling back to the binary info from a device
  util (https://snippets.nativescript.org/coral-cipher-48r8).
- **Manual "check now"**: call `norrix.sync()`, not `checkForUpdates()` —
  `sync()` runs the full check → download → install flow when
  `installUpdatesAutomatically` is on.

## Applying an update immediately

`instance.applyUpdate({ mode, fallbackToProcessRestart: true, prompt: false })`
where `mode` is `'soft-reboot'` when the runtime supports it, else
`'process-restart'`. Detect support by probing for
`NativeScriptRuntime.reloadApplication` (iOS global) /
`com.tns.NativeScriptRuntime.reloadApplication` (Android) — present on the
@nativescript 9.1.0+ runtimes. Last-ditch fallback: open
`https://norrix.net/restart?target=<bundleId>&orgId=<orgId>` and `exit(0)`
so the OTA activates on next cold launch.

## The apply-now UX and its one hard rule

Show a RootLayout bottom-sheet overlay ("Applying Update", the incoming
version label, a 0→100% simulated progress bar — the OTA is already
installed; the bar is a feedback moment). None of it needs a plugin: a
code-built RootLayout toast for the "update ready" nudge, core
`Dialogs.confirm` for the confirm step, then the progress overlay.

**The rule: await full overlay teardown BEFORE applying.** The iOS soft
reboot only swaps the JS isolate and re-runs main — it never removes native
views. Any overlay (and its shade cover) still on the RootLayout at reload
time lingers on the window and renders as a black screen over the re-built
app. The sequence is always:

```ts
await showUpdateProgress(versionLabel); // fills to 100%, brief success state
await closeUpdateProgress();            // resolves when views LEAVE the RootLayout
await applyNorrixUpdateNow();           // only now reload
```

Overlay views are built in code, not templates — Tailwind classes that only
appear in TypeScript get purged from the release CSS, so style them with
inline palette colors and branch on `Application.systemAppearance()` for
dark mode.

## CLI side (builds/releases, separate from the client SDK)

Publishing OTAs uses the `norrix` CLI (`norrix build ios release appstore -c
prod`, `norrix update ios -c prod`) plus a root `norrix.config.ts` typed
against `@norrix/cli` (iOS `teamId`, `distributionType`). Don't create the
config file without `@norrix/cli` installed; it won't type-check.

## Verify

- Dev build: OTA code paths are inert (no init, manual check rejects with a
  clear message).
- Release build with an update staged: status surfaces through the signal;
  Apply Now shows the overlay with the incoming version, reaches 100%,
  overlay fully leaves the screen, app reloads with no black screen, and the
  version footer now shows the OTA version alongside the binary version.
- An update with `requiresStoreUpdate` routes to the store (on iOS check the
  sandbox receipt to send TestFlight users to `itms-beta://` instead).
