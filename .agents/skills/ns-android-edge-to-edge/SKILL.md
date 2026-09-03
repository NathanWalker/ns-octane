---
name: ns-android-edge-to-edge
description: Use when an Android bottom tab bar shows a hard color edge above the gesture-nav strip, bottom-docked UI (composer, action bar) hides behind the gesture pill, content collides with the status bar after touching androidOverflowEdge, or Utils.android.setNavigationBarColor / setStatusBarColor appears to do nothing — how @nativescript/core 9.1+ edge-to-edge insets actually work on API 35+, with recipes for seamless bottom bars and docked bottom UI.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Android edge-to-edge insets (API 35+)

Core 9.1+ **auto-enables edge-to-edge** on every Activity (`enableEdgeToEdge(activity)` runs in `onActivityCreated` — you never call it yourself). The window spans the full screen; insets decide who pads. Three facts that are easy to get backwards:

1. **`androidOverflowEdge` lists the edges a view OVERFLOWS — i.e. SKIPS padding for.** `"bottom"` means "do NOT pad the bottom; extend under the bar there", not "apply bottom". Consequently `"all-but-bottom"` pads *only* the bottom — set that on your root and your header dives under the status bar. `none` and `ignore` are effectively no-ops (native flag 0), not "apply everything".
2. **Only the app's root view applies insets by default.** Inner GridLayouts/StackLayouts do not auto-pad, and (as of core 9.1.0-alpha.11) the `androidOverflowInset` event never fires on page-level layouts even with `dont-apply` set — the dispatch doesn't reach that deep. Don't build a plan that depends on it; read the window insets directly (Recipe B).
3. **Material widgets' own inset handling never runs under core.** `BottomNavigationView` ships an inset listener that would pad its content above the gesture strip — but core consumes window insets at the app root, so they never dispatch down and that listener never fires. Any inset the bar needs must be read and applied manually. The strip can still *look* seamless whenever the bar's row touches the screen bottom — don't let that fool you into thinking the widget handled it.

Valid `androidOverflowEdge` tokens (comma-separable bitmask): `none`, `ignore`, `left`, `top`, `right`, `bottom`, `<edge>-dont-consume`, `all-but-<edge>`, `dont-apply`. For the full inset model (and the fullscreen-modal trap, which is its own window), see `ns-android-window-insets`.

## Recipe A — seamless bottom tab bar (the strip matches the bar)

Tell the **root view** (and any wrapper between it and the tab view) to skip the bottom inset so it reaches the Material bar; the bar's background then fills the gesture strip because its row touches the screen bottom:

```xml
<!-- app root -->
<RootLayout class="app-background" androidOverflowEdge="bottom">
  <Frame defaultPage="views/shell/shell-page" />
</RootLayout>

<!-- shell page wrapping the TabView -->
<GridLayout rows="*" androidOverflowEdge="bottom">
  <TabView androidTabsPosition="bottom" id="tabs" />
</GridLayout>
```

Top/side insets still apply at the root (only `bottom` is listed), so headers stay clear of the status bar. Verify in light AND dark — the bar's `tab-background-color` is what fills the strip.

**Size the bar as content + inset, and pad its bottom by the inset — manually** (fact 3: nothing pads the bar's content automatically; a bare 80dp bar lays icons/labels across the gesture strip). Two coupled changes: reserve `80dp + navInset` for the bar's row/height, and `bar.setPadding(l, t, r, navInset)` so content lays out in the top 80dp.

Read the inset with **`WindowMetrics` (API 30+), which is synchronous and needs no attached window**:

```ts
const activity = Utils.android.getCurrentActivity();
const navInset = activity
  .getWindowManager()
  .getCurrentWindowMetrics()
  .getWindowInsets()
  .getInsets(android.view.WindowInsets.Type.navigationBars()).bottom; // device px
```

Do NOT rely on `decorView.getRootWindowInsets()` at view-creation time (null before window attach → silent 0 on cold start), and do NOT wait for an `OnApplyWindowInsetsListener` anywhere below the root — it never fires (insets are consumed at the root). Re-sync from an `addOnLayoutChangeListener` on the bar to catch nav-mode/rotation changes.

## Recipe B — full-bleed page with docked bottom UI (composer, action bar)

Once the root skips the bottom inset, pages outside the tab shell no longer inherit bottom padding — anything docked at their bottom slides under the gesture pill. Read the inset off the window on load and pad the page root yourself:

```xml
<GridLayout rows="*, auto" androidOverflowEdge="dont-apply" loaded="loadedRoot">
```

```ts
import { Utils } from '@nativescript/core';

export function loadedRoot(args) {
  if (!__ANDROID__) return;
  const grid = args.object;
  const insets = Utils.android.getCurrentActivity()?.getWindow()?.getDecorView()?.getRootWindowInsets();
  if (!insets) return;
  const bottom =
    android.os.Build.VERSION.SDK_INT >= 30
      ? insets.getInsets(android.view.WindowInsets.Type.navigationBars()).bottom
      : insets.getSystemWindowInsetBottom();
  grid.style.paddingBottom = Utils.layout.toDeviceIndependentPixels(bottom);
}
```

Only pad the stable navigation inset — the IME inset belongs to whatever keyboard-docking mechanism the page uses (see `ns-keyboard-input`). `dont-apply` guards against a future core version auto-applying on top of your manual padding. Pages inside the tab shell need nothing: they sit above the bar, which owns the bottom edge.

## Dead ends

* **Painting a view's background to color the strip** — the padding usually lives on the *root* view, and a view's background can't reach into its parent's padding area; you'll chase the wrong view.
* **Coloring the system nav-bar scrim** (`Window.setNavigationBarColor`) — deprecated no-op when targeting SDK 35+. There is no window-level way to color the gesture strip on Android 15; the color must come from app content extending under it (Recipe A).
* **`Utils.android.setNavigationBarColor` / `setStatusBarColor` / `setDarkModeHandler` in core ≤ 9.1.0-alpha.11 are additionally broken in JS** — they merge state as `stored ?? (stored = incoming)` against non-null defaults, so the incoming value can never land, and they key state on `getCurrentActivity()` instead of the passed activity (`packages/core/utils/native-helper-for-android.ts`). If these calls "do nothing", check the installed core version before blaming your code.
* **Chaining `-dont-consume` down the view tree** — every layer that sees the un-consumed inset applies it; padding stacks per level and the whole UI climbs up the screen.
* **`all-but-bottom` on the root** to "keep everything but pass bottom" — inverted semantics: it pads ONLY bottom and throws your header under the status bar.

## Debugging

1. Pixel probes beat eyeballing: `adb exec-out screencap -p > s.png`, then compare exact pixels above/below the suspected edge — `#FFFFFF` vs `#F5F5F7` are indistinguishable by eye but unambiguous as numbers.
2. Who owns the padding? `adb shell uiautomator dump` and find the first child whose bounds stop short of the screen height: its *parent* holds the inset padding (uiautomator reports outer bounds — padding shows in the children, not the view itself).
3. After each change verify all four: the target screen, the top edge, every page with docked bottom UI, and dark mode.
4. 3-button navigation devices have a much taller opaque nav bar — same code paths, bigger inset; check both nav modes.
5. Activity recreation (theme change, split-screen) re-runs `enableEdgeToEdge(activity)` with defaults; per-page inset padding survives, but window-level tweaks must be re-applied on `activityCreated`.

Verified 2026-08: Android 15 emulator (API 35), @nativescript/core 9.1.0-alpha.11, in a production app (pixel-probe and uiautomator-verified). 3-button navigation checked on emulator only.
