---
name: ns-listview-recycling
description: Use when a ListView janks or stutters while scrolling, an itemTemplates template never applies, analytics or side effects in itemLoading fire far too often, or when writing itemLoading handlers / itemTemplateSelector / refresh() — the args.view recycling contract (only create when absent), the selector's silent fallback to the default template on unknown keys, and why refresh() re-fires itemLoading for every item.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# ListView: recycling contract, template selectors, refresh

## The `itemLoading` recycling contract

`args.view` is the recycled view from a row that scrolled off. Create only when it's absent; otherwise **reconfigure** what you're given:

```ts
import { ItemEventData, Label, ListView } from '@nativescript/core';

listView.on(ListView.itemLoadingEvent, (args: ItemEventData) => {
  if (!args.view) {
    args.view = new Label(); // create once per on-screen slot
  }
  (<Label>args.view).text = items[args.index];
});
```

Unconditionally assigning `args.view = new Label()` defeats recycling — every scroll frame allocates native views and scrolling jank follows. The handler must be a pure function of `args.index`: recycled views arrive with the *previous* row's state, so set every property you ever set, not just the ones that changed.

## Template selectors

`itemTemplateSelector` accepts a string expression evaluated against the item, or a function:

```ts
listView.itemTemplateSelector = "age % 2 === 0 ? 'red' : 'green'";
// or
listView.itemTemplateSelector = (item: Item, index: number, items: Item[]) =>
  item.featured ? 'hero' : 'row';
```

* **Unknown keys fall back silently** to the default `itemTemplate` — a typo'd key renders the default template with no error anywhere. If a template "randomly doesn't apply", diff the selector's returned strings against the declared `itemTemplates` keys first.
* Each key's views recycle within that key — returning many distinct keys shrinks each recycling pool.
* In sectioned/grouped mode the selector receives the **row item**, not the section wrapper.

## `refresh()` is a full re-render

`listView.refresh()` re-fires `itemLoading` for **every** item — it is not a diff. Two consequences:

* Side effects in `itemLoading` (analytics, network) double-fire on every refresh — keep the handler pure.
* For incremental changes, bind `items` to an `ObservableArray` and mutate it; the ListView applies changes without a full pass (see `ns-observable-array-change-events`). Reserve `refresh()` for "the same items now render differently" (theme change, display-mode toggle).

## Small print

* `items` defaults to `undefined`, not `[]` — guard `(listView.items || []).length`.
* `scrollToIndex` before `items` is set is a safe no-op.
* `loadMoreItemsEvent` fires when scrolling nears the end — the standard infinite-scroll hook.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the recycling contract, refresh re-fire counts, selector forms and silent fallback are asserted in apps/automated/src/ui/list-view/list-view-tests.ts; not re-run standalone.
