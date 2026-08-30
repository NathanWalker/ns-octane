---
name: ns-android-window-insets
description: Use when showing a fullscreen native modal on Android (view.showModal with fullscreen true) or wiring androidOverflowEdge / androidOverflowInset anywhere — how window insets (status bar / nav bar / IME) flow through @nativescript/core's edge-to-edge system, and the fullscreen-modal trap where unconsumed insets pad every Label (~50dp-inflated text boxes, phantom gaps, invisible emoji, content under the status bar — iOS unaffected).
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Android window insets: the model, and the fullscreen-modal trap

On an edge-to-edge Android window the system dispatches window insets (status bar, nav/gesture bar, display cutout, IME) down the view tree. Core 9.1+ surfaces this via two per-view APIs:

* **`androidOverflowEdge`** (property) — how a view treats insets that reach it: `none` (apply insets as own padding — consume), `ignore` (pass through untouched), `dont-apply` (don't pad self; pair with an inset handler), or a comma list of edges: `top`, `bottom`, `left`, `right`, `all-but-top`, `top-dont-consume`, and so on (`dont-apply` in a list overrides everything else).
* **`androidOverflowInset`** (event, layout views only) — fires with `args.inset` when insets reach the view, letting code mutate or consume them before they propagate further.

`args.inset` is a DataView-backed struct shared with native. Fields: `left/top/right/bottom` (**device pixels**, not dip — convert with `Utils.layout.toDeviceIndependentPixels`), `imeBottom`, per-edge consumed flags `topConsumed/bottomConsumed/leftConsumed/rightConsumed/imeBottomConsumed`, and `cutout*`. Zero an edge AND set its consumed flag to fully swallow it.

**The key default:** a plain view (Label, Image, …) that receives insets applies them as its **own padding**. That is desirable exactly once — at whatever single view is designated the consumer. If insets reach leaf views, every one of them pads itself.

## Main window: one consumer, high up

Give the app's root view an explicit consumer role; individual screens opt into full bleed while active and restore on leave. For main-window edge-to-edge recipes (seamless tab bars, docked bottom UI) see `ns-android-edge-to-edge`.

```xml
<!-- app root: absorb insets as padding; nothing below ever sees them -->
<RootLayout androidOverflowEdge="none"> </RootLayout>
```

## Fullscreen modals: the trap

A native modal is **its own window** — the main window's consumer is not in its tree and cannot help it. Core's Android `DialogFragment` calls `Utils.android.enableEdgeToEdge(...)` on the dialog window whenever the modal is opened with `fullscreen: true`. So the dialog window is edge-to-edge and **nothing in it consumes insets**: they propagate to every view, and every Label pads itself by statusbar+navbar (~52dp on a typical phone).

Symptom signature (all from this one cause):

* every text line box inflated ~50dp while glyphs stay normal size; explicit CSS width/height on labels seemingly ignored
* big phantom gaps between stacked labels (the gap IS the padding)
* emoji/font-icon glyphs invisible inside small clipped containers (padding pushes the glyph out of the clip)
* content taller than the screen → collides with the status bar, clipped at the bottom
* **iOS unaffected**, and the identical markup fine in the main window

### Fix — mandatory for every `fullscreen: true` modal

Register an inset handler on the **modal root**. The view you author isn't always the modal root (Angular, for instance, presents a wrapper ContentView), so from your template root's `loaded` event walk up to the view that owns the dialog fragment and configure that:

```ts
import { EventData } from '@nativescript/core';

export function modalInsetListener(args: EventData, insetHandler: (args: any) => void) {
  if (!__ANDROID__ || !args?.object) {
    return;
  }
  // find the modal root: the view holding the dialog/bottom-sheet fragment
  let modalView = args.object as any;
  while (modalView && !modalView._dialogFragment && !modalView._bottomSheetFragment) {
    modalView = modalView.parent;
  }
  if (!modalView) {
    return;
  }
  modalView.androidOverflowEdge = 'dont-apply';
  modalView.androidOverflowInset = insetHandler;
}
```

Also set the attributes on your template root directly — harmless redundancy that covers frameworks where the template root IS the modal root:

```xml
<GridLayout androidOverflowEdge="dont-apply" loaded="onRootLoaded" androidOverflowInset="onOverflowInset">
```

Two handler variants:

```ts
// A. consume everything — self-contained sheets whose layout keeps content clear of screen edges
onOverflowInset = (args: any): void => {
  args.inset.top = 0;
  args.inset.bottom = 0;
  args.inset.topConsumed = true;
  args.inset.bottomConsumed = true;
};
```

```ts
// B. capture, then pad manually — edge-anchored content (real-top header, docked footer)
onOverflowInset = (args: any): void => {
  this.insetTopDip = Utils.layout.toDeviceIndependentPixels(args.inset.top);
  this.insetBottomDip = Utils.layout.toDeviceIndependentPixels(args.inset.bottom);
  args.inset.top = 0;
  args.inset.bottom = 0;
  args.inset.topConsumed = true;
  args.inset.bottomConsumed = true;
};
// then bind e.g. marginTop to insetTopDip on Android only
```

### When it is NOT needed

* Non-fullscreen modals (default centered dialog, iOS PageSheet) — core only enables edge-to-edge on the dialog window for `fullscreen: true`.
* Overlays hosted in the main window (`RootLayout.open(...)` sheets, toasts) — they sit under the main window's consumer.
* iOS anything — safe areas there are the separate `iosOverflowSafeArea` system (see `ns-ios-scroll-under-bars`).

## IME (keyboard) note

`args.inset.imeBottom` carries the keyboard inset with its own `imeBottomConsumed` flag — same struct, same rules. Use the named accessors, not raw DataView offsets.

## Verifying on a device

Don't eyeball a screenshot — measure: `adb shell uiautomator dump /sdcard/wd.xml && adb pull /sdcard/wd.xml .`, divide bounds by density for dp. The trap's fingerprint: every TextView height ≈ its text height **plus ~50dp**, uniformly. A single-line fontSize-12 label reporting 60+dp tall is this bug, full stop. Review checks: every `fullscreen: true` show-modal site wires a modal inset handler; inset math converts device px → dip before use as margin/padding.

Verified 2026-08: Android 15 emulator (API 35), @nativescript/core 9.1.0-alpha.11, in a production Angular app (uiautomator-verified before/after). API docs: https://docs.nativescript.org/api/classes/View (append `.md` for a fetchable markdown version).
