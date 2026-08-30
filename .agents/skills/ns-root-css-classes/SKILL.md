---
name: ns-root-css-classes
description: Use when writing platform-, device-, orientation-, or theme-conditional CSS without JS branching — the framework stamps ns-root/ns-modal, ns-android/ns-ios/ns-visionos, ns-phone/ns-tablet, ns-portrait/ns-landscape, ns-dark/ns-light, ns-ltr/ns-rtl plus a per-SDK class like ns-ios-17 on every root view; modals get ns-modal instead of ns-root, and neither ns-dark nor ns-light exists on iOS 12 and below.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Root CSS classes: conditional styling without JS

Every root view (and every modal root) carries framework classes you can scope any rule with — no `isAndroid` branches in code:

| Group | Classes |
|---|---|
| Root kind | `ns-root` (app root) / `ns-modal` (modal roots — INSTEAD of `ns-root`) |
| Platform | `ns-android`, `ns-ios`, `ns-visionos` |
| Device type | `ns-phone`, `ns-tablet` |
| Orientation | `ns-portrait`, `ns-landscape`, `ns-unknown` |
| Appearance | `ns-dark`, `ns-light` |
| Layout direction | `ns-ltr`, `ns-rtl` |
| SDK version | `.ns-<os>-<major>`, e.g. `.ns-ios-17`, `.ns-android-35` |

```css
.ns-android .toolbar { background-color: #f7f7f9; }
.ns-android.ns-dark .toolbar { background-color: #0e1117; }
.ns-tablet .content { padding: 32; }
.ns-landscape .hero { height: 180; }
.ns-ios-26 .card { corner-shape: squircle; }
```

Orientation and appearance classes update live on rotation/theme change — unlike file-name qualifiers, which resolve once (see `ns-file-qualifiers`).

## Rules that matter

* **Modals**: a modal's root gets `ns-modal` **instead of** `ns-root` but keeps all the platform/device/orientation/appearance classes. A rule scoped `.ns-root .card { }` silently misses every modal — scope shared styling as `.ns-root .card, .ns-modal .card { }` or just don't anchor on the root-kind class.
* **`view.className` is additive-safe**: the framework classes live in the internal `cssClasses` set and survive you assigning `className` on the root view — you can't accidentally wipe `ns-dark` this way.
* **Don't rely on `.ns-light` as your default theme scope**: on iOS ≤ 12 *neither* `ns-dark` nor `ns-light` is applied. Write defaults on bare selectors and override under `.ns-dark`:

```css
.card { background-color: #ffffff; }      /* default = light */
.ns-dark .card { background-color: #161c26; }
```

* The SDK class uses the **major** version only (`Math.floor(SDK_VERSION)`), handy for OS-gated styling (e.g. Liquid Glass-era tweaks under `.ns-ios-26`).

## Code-side equivalents

When CSS can't express it, the same facts come from `Application.systemAppearance()`, `Screen.mainScreen`, and `Application.orientation()` — but reach for these classes first; they keep theming declarative and they re-evaluate automatically. For views built entirely in code (outside CSS reach), see `ns-code-built-view-styling`.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the full class list, the ns-modal substitution, className additivity and the iOS ≤ 12 appearance gap are asserted in apps/automated/src/ui/styling/root-views-css-classes-tests.ts; not re-run standalone.
