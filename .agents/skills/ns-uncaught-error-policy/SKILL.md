---
name: ns-uncaught-error-policy
description: Use when a NativeScript app that used to crash on JS errors now silently keeps running (9.1 behavior change), when configuring uncaughtErrorPolicy in nativescript.config.ts, or when removing discardUncaughtJsExceptions — 'report' (the new default) logs and fires Application.uncaughtErrorEvent without crashing, 'throw' restores native crashes for crash reporters, and the key only works at the config's TOP level.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# uncaughtErrorPolicy: why 9.1 apps stopped crashing

NativeScript 9.1 changed the default handling of uncaught JS errors. The new `uncaughtErrorPolicy` config takes:

* `'report'` (**default**) — log the error, fire `Application.uncaughtErrorEvent`, keep the app running.
* `'throw'` — after reporting, rethrow natively: the app crashes like pre-9.1.

Requires runtime 9.1+ on both platforms; older runtimes ignore the key and crash as before.

```ts
// nativescript.config.ts
export default {
  id: 'org.example.app',
  uncaughtErrorPolicy: 'throw',   // TOP LEVEL ONLY — nested under ios/android it is silently ignored
  // ...
} as NativeScriptConfig;
```

## Which one do you want?

* **Shipping with a crash reporter (Sentry/Crashlytics/etc.): use `'throw'`.** Under `'report'` the app keeps running past errors and native crash reporters see nothing — your dashboards go quiet while users hit broken states.
* Under `'report'`, own the reporting yourself:

```ts
import { Application } from '@nativescript/core';

Application.on(Application.uncaughtErrorEvent, (args) => {
  reportToBackend(args.error);
});
```

* To handle individual promise rejections instead of the global policy: `globalThis.addEventListener('unhandledrejection', (e) => e.preventDefault())`.

## The traps

1. **Placement**: the key is read ONLY from the top level of `nativescript.config.ts`. A value nested under `ios: { }` or `android: { }` has no effect and no warning.
2. **A leftover `discardUncaughtJsExceptions: true` defeats `'throw'`**: it routes errors to `discardedErrorEvent`, skips the fatal log, and suppresses the rethrow — hiding errors from crash reporters even though you asked for `'throw'`. Remove the legacy key when adopting the policy. (`discardUncaughtJsExceptions: false` is ignored — it does not restore crash-on-uncaught by itself.)
3. **Diagnosis pattern**: "our app used to crash here, now it just logs and limps" after a 9.1 upgrade is this default change, not a fix in your code. Decide the policy deliberately.

Event wiring, for completeness: the runtimes call `global.__onUncaughtError` → `Application.uncaughtErrorEvent` and `global.__onDiscardedError` → `Application.discardedErrorEvent`.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: policy values, default, top-level-only placement and the discardUncaughtJsExceptions interaction read verbatim from packages/core/config/config.interface.ts and application/application-common.ts. Crash-reporter integration behavior under each policy untested from this repo — verify with your reporter.
