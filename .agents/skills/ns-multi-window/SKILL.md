---
name: ns-multi-window
description: Use when adopting the NativeScript 9.1 multi-window/NativeWindow model — Application.primaryWindow/activeWindow/getWindows, setWindowContentResolver, openWindow for iPad multi-scene or Android multi-activity, migrating off the deprecated launch event, or per-window orientation()/systemAppearance() — including the Android launchMode manifest requirement openWindow logs about.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Multi-window (9.1): windows, resolvers, and the launch-event migration

Core 9.1 models every UI surface as a `NativeWindow` with a role (`'application' | 'embedded' | 'carplay' | 'externalDisplay'`) and state (`'attached' | 'detached' | 'closed'`). Even a single-window app runs through this model.

## Reaching windows

```ts
import { Application } from '@nativescript/core';

Application.primaryWindow;          // the main app window
Application.activeWindow;           // the one currently focused (differs on iPad side-by-side)
Application.getWindows('all');      // every live window, filterable by role
Application.getWindowById(id);
```

Per-window environment replaces the deprecated app-level getters: `Application.orientation()`, `Application.systemAppearance()` and `Application.layoutDirection()` are deprecated in favor of `Application.primaryWindow?.orientation()` etc. — on multi-window iPad the *window's* values are the truthful ones (a side-by-side window can be compact while the device is landscape).

## Providing content: `setWindowContentResolver`

The `launch` event is deprecated: it fires only before the **first** window's content and never for additional windows. The 9.1 shape is a resolver that runs for every window:

```ts
Application.setWindowContentResolver((request) => {
  // request: { window, isPrimary, data?, ios?.connectionOptions, android?.intent }
  if (!request.isPrimary) {
    return { moduleName: 'views/aux/aux-root' };   // NavigationEntry, View, or module string
  }
  return 'app-root';
});
Application.run();
```

Use the `ready` event for one-time app init. Event ordering per window: Application `ready` → `windowOpen` → the raw platform connect/create event → content resolution → `contentLoaded` → `activate` and `displayed`.

## Opening a second window

```ts
Application.openWindow({ data: { docId: '42' } }); // data crosses as NSUserActivity.userInfo / intent extras
```

* **iOS**: requires multi-scene support — gated on `UIApplication.sharedApplication.supportsMultipleScenes` (iPad; logs `Cannot create a new scene - not supported on this device.` on iPhone).
* **Android**: experimental, and the start activity **must not** use `launchMode="singleTask"` (the app-template default!) or `"singleInstance"` in `AndroidManifest.xml` — Android hands the launch intent to the existing activity instead of opening a second one. Use `"singleInstancePerTask"` (API 31+) or `"standard"`. The runtime logs exactly this warning; if `openWindow` "does nothing" on Android, check the manifest first.
* On unsupported platforms the base implementation throws `openWindow() is not supported on this platform.`

## Lifecycle caveat

Listeners registered **on a window** are dropped immediately after it closes — nothing registered on a window outlives it. Keep cross-window state and subscriptions at the Application level, treat each window's listeners as scoped to its lifetime.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: types, documented event ordering, deprecations and the exact iOS/Android gating messages read from packages/core/native-window/*, application/application-common.ts, application.ios.ts and application.android.ts. Multi-window flows not exercised on-device from this repo — treat runtime specifics as untested and verify on your target OS versions.
