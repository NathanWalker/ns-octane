---
name: ns-page-navigation-lifecycle
description: Use when ordering work across Page events (navigatingTo, loaded, navigatedTo, navigatingFrom, unloaded, navigatedFrom), passing context between pages, or controlling the backstack (clearHistory, backstackVisible, canGoBack) — the exact event order, what Frame.topmost().currentPage is at each step, and the backstack rules the framework's own tests assert.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Page navigation lifecycle and the backstack

For one forward navigation followed by back, a page fires exactly this sequence:

```
navigatingTo → loaded → navigatedTo   ...   navigatingFrom → unloaded → navigatedFrom
```

What is true at each step:

* **`navigatingTo`** — earliest hook; `args.context` (the `NavigationEntry.context`) is available. Set `bindingContext` here.
* **`loaded`** — the view tree exists and native views are attached, **but `Frame.topmost().currentPage` is NOT this page yet**. Don't read "the current page" here expecting yourself.
* **`navigatedTo`** — navigation committed; `currentPage` is now this page. Start animations, timers, subscriptions here.
* **`navigatingFrom` / `unloaded` / `navigatedFrom`** — note **`unloaded` fires BEFORE `navigatedFrom`**. Teardown that needs the native view must happen by `unloaded`; `navigatedFrom` is last and runs on an already-unloaded page.
* After a back-pop the page is fully torn down: `parent`, `frame` and the native context are null, `isLoaded` is false. Never cache a popped Page for reuse.
* `page.navigationContext` is **cleared on back navigation** — read what you need from it before leaving, or copy it onto your view model.

```ts
import { EventData, NavigatedData, Page } from '@nativescript/core';

export function navigatingTo(args: NavigatedData) {
  const page = <Page>args.object;
  if (args.isBackNavigation) return;         // returning — state already built
  page.bindingContext = createViewModel(args.context);
}
```

## Navigating with context

```ts
Frame.topmost().navigate({
  moduleName: 'views/detail/detail-page',
  context: { id: item.id },                  // arrives as args.context / page.navigationContext
  backstackVisible: true,                    // default; false = skipped on back
  clearHistory: false,
});
```

* `clearHistory: true` empties the backstack; the outgoing page fires only `navigatingFrom`/`navigatedFrom` (no unload pair queued behind a back button that no longer exists) and `frame.backStack.length` becomes 0.
* `backstackVisible: false` entries still construct and navigate normally — the page factory runs — they are only *skipped* when going back.
* `frame.goBack()` when `canGoBack()` is false is a **safe no-op**. After N forward navigations where the last was `backstackVisible: false`, you get N−1 successful `goBack()`s.
* Jump multiple screens back with `frame.goBack(frame.backStack[0])` (pass the target entry).
* `isBackNavigation` on intermediate skipped pages is still `forward`-shaped on the from-events — don't branch teardown on it; branch **setup** on it in `navigatingTo` (the classic guard above).

## Frames

* `Frame.topmost()` follows whichever frame navigated **most recently** — inside a TabView it's the selected tab's frame, not the app root (see `ns-tabview-lazy-loading`).
* The Frame itself re-emits only `navigatingTo`/`navigatedTo` — never the From pair. Listen on the Page for those.

## Where work belongs

| Work | Event |
|---|---|
| Build/bind view model from context | `navigatingTo` (guard `isBackNavigation`) |
| Measure views, access nativeView | `loaded` |
| Start timers/subscriptions/analytics | `navigatedTo` |
| Stop timers, detach native listeners | `unloaded` |
| Final bookkeeping (no native access) | `navigatedFrom` |

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: event order, currentPage timing, context clearing, teardown state and canGoBack behavior are asserted in apps/automated/src/ui/page/page-tests-common.ts, ui/frame/frame-tests-common.ts and navigation/navigation-tests.ts; not re-run standalone.
