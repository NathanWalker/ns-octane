---
name: ns-root-layout-overlays
description: 'Use when building in-app overlays, toasts, popups, or bottom sheets without a native modal — getRootLayout().open with shadeCover and enter/exit animations, close/closeAll/bringToFront, and the traps — getRootLayout() returns the FIRST registered RootLayout (not the topmost), every method rejects its promise on misuse ("View ... has already been added to the root layout"), and open() zeroes the view opacity before animating.'
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# RootLayout overlays: open/close in the main window

Make the app root a `RootLayout` (it extends GridLayout) and any code can float views over the current page — no modal window, no navigation:

```xml
<!-- app-root.xml -->
<RootLayout>
  <Frame defaultPage="main-page" />
</RootLayout>
```

```ts
import { Color, CoreTypes, getRootLayout, Label } from '@nativescript/core';

export async function showToast(message: string) {
  const toast = new Label();
  toast.text = message;
  toast.verticalAlignment = CoreTypes.VerticalAlignment.bottom;
  toast.marginBottom = 48;

  const root = getRootLayout();
  await root.open(toast, {
    shadeCover: { color: '#000000', opacity: 0.3, tapToClose: true },
    animation: {
      enterFrom: { translateY: 80, opacity: 0, duration: 250, curve: CoreTypes.AnimationCurve.easeOut },
      exitTo: { translateY: 80, opacity: 0, duration: 200 },
    },
  });
  setTimeout(() => root.close(toast).catch(() => {}), 2500);
}
```

Defaults: animation `duration: 300`, curve easeIn; shade cover `opacity: 0.5`, `color: '#000000'`, `tapToClose: true`. The opened view receives `'opened'` and `'closed'` events. The full surface: `open`, `close(view, exitTo?)`, `closeAll()`, `topmost()`, `bringToFront(view, animated?)`, `getShadeCover()`, `openShadeCover(options)`, `closeShadeCover()`.

## Traps

* **`getRootLayout()` returns the FIRST registered RootLayout, not the topmost.** With nested RootLayouts (e.g. one inside a modal) you'll grab the wrong one — give roots ids and use `getRootLayoutById('modal-root')`.
* **Every method returns a promise that can reject**, with exact reasons worth recognizing in logs: `Invalid open view`, `View ... has already been added to the root layout`, `Unable to close popup. View ... not found`, `View ... is not a child of the root layout`, `View ... is already the topmost view in the rootlayout`. Always attach a `.catch` — unhandled rejections here are silent in release.
* **`open()` sets the view's `opacity` to 0 before inserting** and animates it in one tick later (deferred so safe-area measurement lands first). Don't run your own opacity animation on the same view at open time — they race.
* **There is exactly one shade cover** no matter how many views are open — closing the top view restores the shade for the one below (`ignoreShadeRestore` opts out per close).
* Re-opening a view that's already open rejects — guard with your own state or `closeAll()` first.

## When NOT to use it

* Anything needing OS modality (blocking system back, sheet detents, its own navigation stack) → `showModal` / native sheets.
* On Android, content that must cover the status/nav areas fully behaves differently in the main window vs a dialog window — see `ns-android-window-insets`.
* Styling views you build in code for these overlays: see `ns-code-built-view-styling` (Tailwind purging + dark mode).

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: API surface, defaults, rejection strings, opacity-zeroing and single-shade behavior read from packages/core/ui/layouts/root-layout (index.d.ts, root-layout-common.ts); not re-run standalone.
