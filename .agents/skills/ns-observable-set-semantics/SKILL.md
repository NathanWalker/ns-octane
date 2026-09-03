---
name: ns-observable-set-semantics
description: Use when Observable.set() doesn't fire propertyChange, when vm.someProp reads null while vm.get('someProp') works (fromObject accessor gap), when a View's propertyChange listener never fires (views raise textChange/checkedChange-style events instead), or when a listener won't detach or once('tap') keeps firing — set() compares by reference (WrappedValue.wrap is the escape hatch), fromObject only creates accessors for creation-time keys, and comma-joined event names subscribe to nothing.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Observable.set, fromObject, and listener identity

Three quiet rules in `Observable` cause most "my binding didn't update" bugs.

## 1. `set()` is a reference-equality no-op

Setting the **same object instance** fires nothing — mutating an array/object in place and setting it back updates no binding:

```ts
import { fromObject, WrappedValue } from '@nativescript/core';

const vm = fromObject({ items: [] as number[] });
const arr = vm.get('items');
arr.push(2);
vm.set('items', arr);                    // NO propertyChange — same reference
vm.set('items', WrappedValue.wrap(arr)); // fires propertyChange
```

`WrappedValue` exists only to force the change logic: the stored/observed value is the **unwrapped** array — `vm.get('items')` returns `arr`, not the wrapper. (Alternatives: store a new array (`vm.set('items', [...arr])`), or use `ObservableArray` — see `ns-observable-array-change-events`.)

## 2. `fromObject` accessors exist only for creation-time keys

`fromObject({...})` installs dot-access property accessors **only for keys present in the source literal**. `set()` on a new key stores the value (and `get()` works), but dot access stays `null` forever:

```ts
const vm = fromObject({});
vm.set('user', { name: 'Ada' });
vm.get('user');   // { name: 'Ada' }
(vm as any).user; // null — no accessor was ever created
```

Declare every property up front, even as `null`: `fromObject({ user: null })` gives you both paths. For nested observables use `fromObjectRecursive`.

## 3. View properties fire `<name>Change`, NOT `propertyChange`

`ViewBase` deliberately suppresses the generic `propertyChange` event — each styled/registered Property raises its **own** event named `<propertyName>Change`:

```ts
textField.on('propertyChange', cb); // never fires for text
textField.on('textChange', cb);     // fires
switchView.on('checkedChange', cb); // fires
```

(On a plain `Observable` view model, `propertyChange` works as expected; `setProperty()` fires both the generic and the named event.)

## 4. Listener identity and registration quirks

* `addEventListener('propertyChange,myEvent', cb)` — comma-joined names — **subscribes to nothing** (support was dropped; no error is raised). Register each event separately.
* A registration's identity is `[eventName, callback, thisArg]`. All falsy `thisArg`s collapse to one bucket, and `removeEventListener(name, cb)` with no `thisArg` removes **all** matching registrations for that callback.
* Re-adding the same `(callback, thisArg)` pair is **silently ignored** — a "why is my handler not duplicated" mystery in reverse.
* `once()` works for plain events but **not for gesture names on views**: `view.once('tap', cb)` routes through the gesture observer path, which ignores the once flag — the handler fires forever. Use `on` + explicit `off` for gestures.
* For long-lived sources observed by short-lived targets (the ListView→items pattern), use `addWeakEventListener(source, eventName, handler, target)` — the target is held weakly and auto-unsubscribed on collection.

## Review checklist

* Any in-place mutation followed by `set(sameRef)` → wrap or copy.
* Any `fromObject({})` followed by later `set()` of new keys → declare keys at creation.
* Any comma in an event-name string → split into separate registrations.
* Any `propertyChange` listener on a View → switch to the `<name>Change` event.
* Any `once('tap'|'pan'|...)` on a view → `on`/`off` pair.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: behaviors asserted in apps/automated/src/data/observable-tests.ts (same-reference no-op, WrappedValue transparency, fromObject accessor gap, dropped plural event names, falsy-thisArg collapsing) and confirmed in source (packages/core/ui/core/view-base — propertyChange suppression; view-common — the gesture once gap; ui/core/weak-event-listener); not re-run standalone.
