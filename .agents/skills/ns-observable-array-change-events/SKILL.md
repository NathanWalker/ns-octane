---
name: ns-observable-array-change-events
description: Use when handling ObservableArray change events (on('change', ...), ChangedData, args.action/index/addedCount/removed) or when a list misses updates after array.length = n — length assignments emit 'splice' (never add/delete), push reports the pre-push index, setItem's removed holds the old value, and the ObservableArray constructor has a numeric-arity trap.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# ObservableArray change events: the action table

`ObservableArray` emits one `change` event per mutation with `ChangedData<T>`: `{ action, index, addedCount, removed }`. The four actions are the string literals `'add'`, `'delete'`, `'update'`, `'splice'`. A handler that only switches on `'add'`/`'delete'` silently misses every `length =` mutation — those are `'splice'`.

```ts
import { ChangedData, ObservableArray } from '@nativescript/core';

const items = new ObservableArray(['a', 'b', 'c']);
items.on(ObservableArray.changeEvent, (args: ChangedData<string>) => {
  if (args.action === 'splice') {
    rebuildAll(); // covers items.length = N in both directions
  } else {
    patchRows(args.index, args.addedCount, args.removed);
  }
});
items.length = 0; // -> action 'splice', index 0, addedCount 0, removed ['a','b','c']
```

## What each mutation reports

| Mutation | action | index | addedCount | removed |
|---|---|---|---|---|
| `push(x)` / `push(x, y, z)` | `add` | length *before* the push | count pushed | `[]` |
| `pop()` | `delete` | new length | 0 | `[last]` |
| `shift()` | `delete` | 0 | 0 | `[first]` |
| `unshift(x)` | `add` (not a distinct action) | 0 | count | `[]` |
| `splice(i, del, ...add)` | `splice` | i clamped to current length | added | deleted items |
| `setItem(i, v)` | `update` | i | 1 | `[old value]` |
| `length = n` (shrink **or** grow) | `splice` | old length (grow) / n (shrink) | grown count | shrunk items |

Details the table can't show:

* **`sort()` and `reverse()` emit NOTHING.** Both mutate in place and skip `notify()` entirely — a bound ListView keeps the old order until you force it. Re-sort with `items.splice(0, items.length, ...sorted)` (one `'splice'` event) or call `listView.refresh()` after sorting.
* **No bracket access.** `arr[0]` is `undefined` and `arr[0] = x` fires nothing — use `getItem(i)` / `setItem(i, v)` (both accept negative indices).
* **`length =` is always `'splice'`.** Growing `[1,2,3]` with `length = 5` fires `{ action: 'splice', index: 3, addedCount: 2, removed: [] }`.
* **Never retain the `args` object.** The `'add'`/`'delete'` event args are shared mutable singletons reused by every push/pop/shift/unshift — copy the fields you need inside the handler.
* **`splice` clamps its start index**: on a 1-item array, `array.splice(2, 0, x)` reports `index: 1` (normalized to the array end), not 2.
* **`map`/`filter`/`slice`/`concat` return `ObservableArray`**, not plain arrays.
* **`ChangeType.Change` exists as a constant but is never emitted** by any method — don't wait for it.
* **`VirtualArray` disagrees**: on a `VirtualArray`, `array.length += array.loadSize` fires `'add'`, not `'splice'` — don't share one handler between the two types blindly.

## Constructor arity trap

```ts
new ObservableArray(1, 2, 3);  // 3 items: [1, 2, 3]
new ObservableArray(100);      // NOT one item — an array of length 100
new ObservableArray([100]);    // one item
```

A single numeric argument means "length", matching `Array`. When building from a variable that might be a lone number, always pass an array literal.

## Practical rules

* Prefer `ObservableArray` mutations over re-assigning a plain array to `items` on list controls — `ListView` applies the change incrementally instead of re-rendering (see `ns-listview-recycling`).
* `removed` on `'update'` is how you diff: it holds the value being replaced.
* To reset, `array.length = 0` (one `'splice'`) beats popping in a loop (N events).

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: behaviors asserted in the framework's test suite (apps/automated/src/data/observable-array-tests.ts, virtual-array-tests.ts) and confirmed in source (packages/core/data/observable-array/index.ts — sort/reverse notify-free, shared _addArgs/_deleteArgs singletons); not re-run standalone.
