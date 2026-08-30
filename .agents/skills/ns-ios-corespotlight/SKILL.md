---
name: ns-ios-corespotlight
description: Use when adding CoreSpotlight/system-search indexing to a NativeScript iOS app, when an app freezes or becomes unresponsive shortly after launch/data load, or when a hang report shows the main thread stuck in v8::Locker::Initialize — indexSearchableItems enumerates JS-array adapters on dispatch_apply worker threads and deadlocks the V8 isolate unless you materialize real NSArrays and hop completion handlers back to the main thread.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# CoreSpotlight without deadlocking V8

CoreSpotlight works great from NativeScript — but the obvious way to call it contains a **guaranteed, permanent, main-thread deadlock** that ships silently: the app launches fine, then freezes forever ~1–2 s after the data feed loads (typically noticed as "scrolling freezes the app on first install, and it's frozen right after relaunch too").

## 1. The deadlock: JS arrays are live adapters, not copies

When you pass a JS array where native expects `NSArray`, the runtime does **not** copy it. It wraps it in an `ArrayAdapter` — an NSArray facade backed by the live V8 array. Every `count`/`objectAtIndex:` on that adapter re-enters V8 and needs the isolate lock on whatever thread makes the call.

CoreSpotlight's `indexSearchableItems:` standardizes the items array with `dispatch_apply` — **parallel enumeration across worker threads**. Combine the two and you get a three-way deadlock:

1. The thread calling `indexSearchableItems` holds the V8 lock for the duration of the synchronous native call, and inside CoreSpotlight blocks waiting for its `dispatch_apply` workers.
2. Each worker calls `-[ArrayAdapter count]` → `v8::Locker::Initialize` → waits forever on the lock held by thread 1.
3. The main thread blocks on the same lock at its next JS callback (the display link fires every frame, so this is instant) → UI frozen, never recovers, eventually a watchdog kill.

Signature in a hang report / `sample` output — one thread in `ArrayAdapter`/native enumeration waiting on workers; workers and main thread all parked here:

```
v8::Locker::Initialize(v8::Isolate*) + 100
_pthread_mutex_firstfit_lock_wait
__psynch_mutexwait
```

A second aggravator: CoreSpotlight invokes completion handlers **on its own background queue**. A JS completion handler therefore runs JS (and takes the V8 lock) on that queue — making that thread the lock-holder in step 1 if you chain the next native call from inside it (the classic delete-then-index nesting).

## 2. The two rules

**Rule 1 — materialize every collection you hand to CoreSpotlight.** Build a real `NSMutableArray` on the JS thread before the call (same-thread lock re-entry is safe; cross-thread is what deadlocks):

```ts
const nsItems = NSMutableArray.alloc<CSSearchableItem>().init();
for (const item of items) {
  nsItems.addObject(item);
}
```

This applies to **nested collections too**: `attrs.keywords = keywords as any` stores a lazy adapter *inside* the attribute set, enumerated later on CoreSpotlight's threads. Materialize it in place:

```ts
attrs.keywords = NSArray.arrayWithArray(keywords as any); // copies now, on this thread
```

**Rule 2 — hop completion handlers back to the main thread** before doing anything further:

```ts
import { Utils } from '@nativescript/core';

index.deleteAllSearchableItemsWithCompletionHandler(() => {
  // fires on CoreSpotlight's queue — do NOT chain native calls from here
  Utils.dispatchToMainThread(() => {
    index.indexSearchableItemsCompletionHandler(nsItems, (error) => {
      Utils.dispatchToMainThread(() => {
        if (error) {
          console.error('Spotlight indexing failed:', error.localizedDescription);
        } else {
          console.log(`Spotlight indexed ${nsItems.count} items`);
        }
      });
    });
  });
});
```

These rules generalize beyond CoreSpotlight: **any** native API that may enumerate a passed collection off-thread (XPC encoding, batch donation APIs, anything using `dispatch_apply`/concurrent enumeration) gets a materialized NSArray, and **any** native completion handler that fires off-main gets a `dispatchToMainThread` hop before further work.

## 3. Known-good integration shape

* **Rebuild, don't diff**: `deleteAllSearchableItems` then re-index everything on each data refresh, so removed items drop out of search. Debounce (~1.5 s) so a burst of updates coalesces into one rebuild.
* **Unique identifiers encode routing**: `<kind>:<id>` (e.g. `meeting:abc123`), with `kind` doubling as the CoreSpotlight `domainIdentifier`, and a single function owning the mapping back to your deep-link URLs.
* **Item construction**: `CSSearchableItemAttributeSet.alloc().initWithContentType(UTTypeText)`, set `title`/`contentDescription`/materialized `keywords`, optional `startDate`/`endDate` (a JS `Date` marshals by value — safe). Set `item.expirationDate = NSDate.distantFuture` — items silently expire after 30 days otherwise; the rebuild cycle owns freshness.
* **Dedupe recurring series** before indexing (one entry per series, pointing at the next occurrence) — expanded occurrences flood search with identical titles.
* **Tap-through**: `applicationContinueUserActivityRestorationHandler` in the app delegate checks `userActivity.activityType === CSSearchableItemActionType`, reads `CSSearchableItemActivityIdentifier` from `userInfo`, maps it to a deep link, and feeds your deep-link pipeline — buffering cold-launch taps (e.g. a ReplaySubject) until services subscribe.

## 4. Verifying and diagnosing

Test **fresh install** after any indexing change (that's when the full index build is biggest and the deadlock window widest): uninstall, install, launch, wait past the debounce, then scroll/tap — a deadlocked app looks alive until the reindex fires.

* Success log: `xcrun simctl spawn booted log show --last 2m --predicate 'processImagePath CONTAINS "<appname>"' | grep -i spotlight` — the JS success `console.log` only prints if the completion round-trip survived.
* Frozen app: `sample <pid>` (simulator processes are host processes) and look for the `v8::Locker::Initialize` signature above — identify who *holds* the mutex (a thread running JS or enumerating an ArrayAdapter) vs who *waits*.
* Query the on-device index: Spotlight search on the simulator home screen for an indexed title; tapping must route to the right detail page.

Verified 2026-08: iOS 26 simulator (iPhone 16 Pro), @nativescript/core 9.1.0-alpha.11 — deadlock reproduced, sampled, and fixed with the two rules in a production app.
