---
name: ns-tabview-lazy-loading
description: Use when initializing per-tab work in a TabView (data fetches or loaded/unloaded handlers on tab content) behaves differently per platform, or a heavy neighbouring tab slows first paint — Android preloads one off-screen tab by default (its content fires loaded for tabs the user never opened) while iOS cannot preload; androidOffscreenTabLimit = 0 normalizes both.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# TabView lazy loading: the platform split

**Android preloads 1 tab to each side of the selected tab by default; iOS cannot preload at all.** The framework's own tests assert the divergence: after navigating away from and back to a page hosting a two-tab TabView, the *unselected* tab's content has fired `loaded` twice and `unloaded` once on Android — and **zero times** on iOS.

Consequences of leaving the default:

* "Fetch on tab `loaded`" fetches for tabs the user never opened — on Android only.
* A heavy neighbouring tab (map, webview, long list) is built during first paint of the selected tab — on Android only.
* Your loaded/unloaded counts differ per platform, so lifecycle-coupled logic drifts.

## The normalizer

```ts
import { TabView } from '@nativescript/core';

tabView.androidOffscreenTabLimit = 0; // both platforms now load only the selected tab
```

```xml
<TabView androidTabsPosition="bottom" androidOffscreenTabLimit="0">
```

With the limit at 0, creating the TabView raises events for the selected tab only — the other tabs' frames stay cold until first selection. (Trade-off: first switch to a tab now pays its build cost at switch time; keep tab roots light or show a skeleton.)

## Idempotent per-tab init

Even normalized, `loaded` fires again every time content re-enters the visual tree (tab re-selected after being far away, page re-navigated). Guard one-time work:

```ts
const initialized = new Set<string>();

export function onTabContentLoaded(args: EventData) {
  const key = (<View>args.object).id;
  if (initialized.has(key)) return;
  initialized.add(key);
  loadDataForTab(key);
}
```

## Related facts

* `Frame.topmost()` follows the **selected tab's frame** once tabs contain frames — switching `selectedIndex` flips which frame is "topmost". Don't cache it across tab switches (see `ns-page-navigation-lifecycle`).
* Every `TabViewItem` must have a non-null `view` when `items` is assigned, or the assignment throws.
* `selectedIndex` defaults to `-1` before items are set; assigning a non-empty `items` auto-selects index 0 (your `selectedIndexChanged` handler's first event reports `oldIndex: 0`).

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the preload asymmetry ([2,0]/[1,0] iOS vs [2,2]/[1,1] Android loaded/unloaded counts), the limit-0 event trace, and Frame.topmost() behavior are asserted in apps/automated/src/ui/tab-view/tab-view-navigation-tests.ts and tab-view-root-tests.ts; not re-run standalone.
