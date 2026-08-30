---
name: ns-trace-debugging
description: 'Use when debugging layout, binding, navigation, or native lifecycle issues with @nativescript/core Trace and getting no output — Trace.enable() alone prints nothing without addCategories, Trace.categories.All omits Accessibility and BindingError, console lines are prefixed with the category name, and Trace.error() THROWS by default.'
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Trace: turning on the framework's own diagnostics

`@nativescript/core` logs rich internals — binding failures, layout passes, navigation, native lifecycle — but only when you enable BOTH the switch and the categories:

```ts
import { Trace } from '@nativescript/core';

Trace.enable();                       // step 1 — alone this prints NOTHING
Trace.addCategories(
  Trace.categories.concat(            // step 2 — pick categories
    Trace.categories.Binding,
    'BindingError',                   // see the All caveat below
    Trace.categories.Layout,
    Trace.categories.Navigation,
  ),
);
```

The full category list: `Accessibility`, `VisualTreeEvents`, `Layout`, `Style`, `ViewHierarchy`, `NativeLifecycle`, `Debug`, `Navigation`, `Test`, `Binding`, `BindingError`, `Error`, `Animation`, `Transition`, `Livesync`, `ModuleNameResolver`, `MediaQuery`.

## The `All` that isn't all

`Trace.categories.All` **omits `Accessibility` and `BindingError`.** The two categories you most want when hunting a silent binding failure or an a11y issue need explicit opt-in — passing `All` and concluding "no binding errors were logged" is a false negative. `Trace.categories.Accessibility` is also missing from the shipped TypeScript typings — pass the string `'Accessibility'`.

## Reading the output

A `ConsoleWriter` is registered by default; each line is `` `${category}: ${message}` `` in the `ns run` console:

```
Binding: Binding target: Label(34) targetProperty: text
BindingError: Property 'titel' not found on ViewModel
```

Grep `ns run` output for the category prefix. Calling `Trace.addWriter(...)` **adds** a writer — output duplicates unless you `Trace.clearWriters()` first when installing a custom one.

## `Trace.error()` throws by default

The default error handler rethrows — `Trace.error(new Error('x'))` **crashes** unless you install a handler first. The handler interface method is spelled `handlerError` (sic), not `handleError`:

```ts
Trace.setErrorHandler({
  handlerError(err) {           // note the spelling
    console.log('[trace-error]', err?.message ?? err);
  },
});
Trace.error('string input is wrapped into an Error for you');
```

Also: error-level writes (`Trace.write(msg, category, Trace.messageType.error)`) bypass the enabled/category filters — they always reach writers.

## Practical bootstraps

Debug binding issues: enable + `Binding` + `'BindingError'` (pairs with `ns-binding-expressions`). Debug "why did my view not re-layout": `Layout` + `ViewHierarchy`. Debug navigation event order: `Navigation` (pairs with `ns-page-navigation-lifecycle`). Gate it out of release builds with `if (__DEV__)`.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: category list, the All omissions, default ConsoleWriter format, handlerError spelling and the rethrow default read from packages/core/trace/index.ts (and the typings gap from trace/index.d.ts); not re-run standalone.
