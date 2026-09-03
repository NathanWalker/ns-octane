---
name: ns-unit-testing
description: Use when setting up or running unit tests in a NativeScript app (ns test init, ns test ios/android, vitest.config.mts), migrating off Karma, or hitting runner errors like "No test entrypoint (test.ts or test.js) found", "NativeScript test ... was not bundled", or "NativeScript Vitest worker 0 did not connect" — @nativescript/unit-test-runner v5 runs Vitest 4 specs inside the real iOS/Android runtimes over a WebSocket bridge.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Unit testing with Vitest on real NativeScript runtimes

`@nativescript/unit-test-runner` v5 (2026) is **not Karma anymore** — it's a Vitest 4 custom-pool plugin. Vitest runs on the host (CLI, reporters, coverage, editor integrations); a plugin bridges Vitest's worker protocol over a WebSocket to your app running in the real iOS/Android runtime, where specs execute on the app's main thread (default) or in NativeScript `Worker` runtimes (opt-in). Karma/karma.conf.js/jasmine-mocha-qunit selection is the deprecated v4-and-below world.

## Setup

```bash
ns test init --framework vitest
ns test ios        # or: ns test android
```

`ns test init` scaffolds: `vitest.config.mts`, `app/test.ts` (the on-device entry: coordinator + spec registry + host page), `app/tests/example.spec.ts`, and `tsconfig.spec.json` (TS projects). It installs `vitest`, `@vitest/runner`, `@nativescript/unit-test-runner@^5` as devDependencies plus `@valor/nativescript-websockets` as a **regular** dependency — that one ships native code, and the CLI only wires native code for regular deps; don't "clean it up" into devDependencies.

```ts
// vitest.config.mts — ns test sets NS_PLATFORM for you
import { defineConfig } from 'vitest/config';
import { nativeScript } from '@nativescript/unit-test-runner';

export default defineConfig({
  plugins: [
    nativeScript({
      platform: process.env.NS_PLATFORM || 'ios', // 'android' | 'ios' | 'visionos'
      device: process.env.NS_DEVICE || undefined,
      // workers: 2, mainThread: false, port: 17878, launch: false
    }),
  ],
});
```

Specs are plain Vitest — `import { describe, it, expect } from 'vitest'`. Default include globs: `app/**/*.spec.{ts,js}` and `src/**/*.spec.{ts,js}`. Jasmine-style suites mostly run unchanged (Vitest's `expect` implements the Jest matcher API, Chai-style also works); QUnit must be rewritten.

## Running

```bash
ns test ios                          # one-shot; exit code reflects pass/fail
NS_PLATFORM=ios npx vitest run       # equivalent — what editor extensions/CI use
NS_PLATFORM=ios npx vitest run --coverage   # or: ns test ios --env.codeCoverage
```

Under the hood the plugin spawns `npx ns run <platform> --no-hmr --env.unitTesting --env.testRunnerPort=<port>`. Any Vitest reporter works (`--reporter=junit` for CI). Coverage **must use the istanbul provider** (device runtimes expose no V8 coverage):

```ts
test: { coverage: { provider: 'istanbul', reporter: ['text', 'lcov'] } }
```

Support matrix: `describe`/`it`/hooks/`expect`, reporters/`vitest --ui`/JUnit, istanbul coverage, and main-thread UI testing all work. **Not supported:** `vi.mock` (webpack static bundle — prefer dependency injection), and — as of 5.0.0 — watch mode (one-shot only), `vi.fn`/fake timers, snapshots (planned).

## Spec discovery: two lists that must agree

On-device, specs load from the webpack bundle via a registry wrapping `require.context` in `app/test.ts` — they are not re-discovered by glob on device. If you keep specs somewhere non-default, align BOTH the Vitest `include` pattern and the `require.context` filter, or you'll see:

* `NativeScript test <filepath> was not bundled` — the spec matched Vitest's include but not the `require.context` filter.
* `NativeScript test <filepath> matched more than one bundled module: ...` — ambiguous suffix match; make paths distinct.
* `No test entrypoint (test.ts or test.js) found in the app source directory. Run \`ns test init\` to scaffold one.` — missing `app/test.ts`.

Non-test builds strip specs via an IgnorePlugin matching `/(^\.\/test|\.spec)\.(ts|js)$/`, so `ns run` never bundles them. Angular projects force JIT compilation for test builds (AOT strips the metadata `TestBed` needs).

## Connectivity

The host WebSocket server binds `127.0.0.1` (default port `17878`):

| Target | Transport |
|---|---|
| iOS / visionOS simulator | host loopback directly |
| Android emulator | device connects to `10.0.2.2` → host loopback |
| Physical Android | USB via automatic `adb reverse tcp:<port> tcp:<port>` |
| Physical iOS | pass a LAN-reachable `url` explicitly to the coordinator in `app/test.ts` (no auto-discovery) |

The runner no longer patches manifests, so add these yourself for test builds: Android may need a scoped cleartext-traffic exception for `10.0.2.2`/`127.0.0.1`; iOS/visionOS need `NSAllowsLocalNetworking`. `NativeScript Vitest worker 0 did not connect within 120000ms` means the app never reached the host: check those exceptions, the port, and that the app actually launched (`launch: false` means you launch it yourself).

## Migrating from Karma

Remove `karma karma-jasmine karma-mocha karma-chai karma-qunit karma-coverage karma-nativescript-launcher karma-webpack @jsdevtools/coverage-istanbul-loader nyc` and delete `karma.conf.js`; then `ns test init --framework vitest`. Karma support in the CLI is deprecated and will be removed one release cycle after v5.

Don't fight the plugin's forced Vitest config: it sets `pool`, `poolRunner`, `maxWorkers` (= device slot count) and `isolate: false` — the device owns a fixed set of long-lived runtimes (main thread + Workers), and reusing pool runners keeps host lifecycles aligned with device slots.

Verified 2026-08: @nativescript/unit-test-runner 5.0.0 source and docs (engines node >=20, vitest ~4.1, @nativescript/core >=8; cross-checked against README, migrating-from-karma.md, src/node/options.ts, src/node/session.ts, src/runtime/coordinator.ts). Physical-iOS LAN flow untested.
