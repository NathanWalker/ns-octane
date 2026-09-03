---
name: ns-css-selectors
description: Use when a NativeScript CSS rule silently doesn't apply and you're asking "does NativeScript support this selector?" — the supported selector set (:not/:is/:where/:pressed/:hovered/@media/attribute operators), :where()'s zero specificity, bare [attr] selectors matching nothing, per-declaration (not per-block) error recovery, and the className-swap stale-background workaround.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# CSS selector support and silent failures

## Supported

Type (`Button`, dashed forms like `stack-layout`), `.class`, `#id`, child `>`, descendant, `:not()`, `:is()`, `:where()`, `:pressed`, `:hovered`, `@media` (nestable), and attribute selectors with every operator: `[a]`, `[a=v]`, `[a~=v]`, `[a|=v]`, `[a^=v]`, `[a$=v]`, `[a*=v]`. Attribute selectors match arbitrary properties — including plain expando props you set from code (`btn['testAttr'] = 'x'`).

Not in the framework's own test surface (treat as unverified): `!important`, `z-index` interplay, transforms via type selectors, sibling combinators (`+`, `~`).

## Specificity notes

* `:where()` has **zero specificity** — `#myButton { color: green }` beats `Button:where(#myButton) { color: red }`. Use `:where()` to write overridable defaults.
* Property **names** are case-insensitive (`cOlOr: blue` applies); keyword *values* generally are not — keep values lowercase.

## Silent failure modes (the debugging checklist)

* **A bare `[attr]` selector with no type/class prefix matches nothing.** `[testAttr*='flower'] { }` is dead; `button[testAttr*='flower']` works.
* **`~=` is whitespace-token match, not substring**: `testAttr="my-flower"` does NOT match `[testAttr~='flower']` (use `*=`).
* **A typo'd id anywhere in a `>` chain kills the whole rule silently** — no warning exists for unmatched selectors.
* **Invalid declarations fail per-declaration, not per-block**: a block with eleven bogus values and one valid `font-size: 30` still applies the font-size. Don't assume a rule "didn't parse" because one line is broken — and don't assume the rest is fine because one line applied.
* Only real component types register as CSS types — a type selector for a non-registered name matches nothing (e.g. inside `ActionBar`, `NavigationButton { }` and `ActionItem { }` silently match nothing — style bar items via classes, see `ns-top-nav`).

## Applying CSS dynamically

* `css` is settable on **any View**, not just Page: `someLayout.css = '.hot { color: red; }'`.
* `Application.addTaggedAdditionalCSS(css, tag)` / `removeTaggedAdditionalCSS(tag)` update the global sheet but need a state refresh on live pages (`page._onCssStateChange()`) to repaint already-rendered views.
* Scope platform/theme/orientation styling with the root classes (`.ns-android`, `.ns-dark`, `.ns-landscape`, …) — see `ns-root-css-classes`.

## Known workaround: className swap leaves stale background

Switching `view.className` directly from one class to another can leave the previous class's native background color behind (a long-standing framework TODO). Clear between values:

```ts
view.className = '';
view.className = 'card-highlighted';
```

New in 9.1: `corner-shape: squircle` (continuous corner curve) — **iOS-only**; Android ignores it silently.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: selector support, :where() specificity, attribute-operator semantics, per-declaration recovery and the className workaround are asserted in apps/automated/src/ui/styling/style-tests.ts and ui/button/button-tests.ts; corner-shape read from packages/core/ui/styling (background.ios.ts). Not re-run standalone.
