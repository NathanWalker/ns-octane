---
name: ns-line-height
description: Use when multi-line Labels show huge gaps between wrapped lines, text looks fine single-line but wrong wrapped, or when configuring @nativescript/tailwind typography — CSS line-height in NativeScript means ADDITIVE space between lines (iOS paragraphStyle.lineSpacing, Android setLineSpacing), not the web's total line box, so web values like 24 or 1.5 inject giant or no-op spacing.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# line-height: additive, not the web's line box

`line-height` in NativeScript does **not** mean what it means on the web, and the difference only shows on text that wraps — which is why the bug ships: single-line labels look perfect, then a long title wraps and sprouts a giant gap.

## The semantics

| Platform | What `line-height: N` does |
|---|---|
| Web | Sets the **total height of each line box**; `1.5` on 16px text = 24px lines — normal typography. |
| NativeScript iOS | `paragraphStyle.lineSpacing = N` — N points of **extra space added between lines**. |
| NativeScript Android | `setLineSpacing(N * density, 1)` — same: N dp of **extra** spacing. |

So a web-normal `line-height: 24` on 16dp text renders ~16dp lines **plus 24dp of air between them** — more gap than text. And a unitless web value like `1.25` becomes a meaningless 1.25dp of extra spacing (visually a no-op).

**Default rule: don't set `line-height` at all.** Native text rendering already uses the platform's per-font line spacing — the "correct" look. Reach for `line-height` only to add deliberate breathing room, and think in **dp of extra space** (`line-height: 4`), never in web ratios or rem-derived values.

## The Tailwind trap (how this bug enters a codebase)

Tailwind's default `fontSize` scale ships tuples: `text-base` = `[1rem, { lineHeight: 1.5rem }]`. Through `@nativescript/tailwind` that becomes `font-size: 16; line-height: 24` — silently injecting 24dp of extra spacing into every `text-base` label that wraps. Every `text-*` utility does this.

**Fix at the root — replace the scale with plain sizes** in `tailwind.config.js` so `text-*` emits only `font-size`:

```js
theme: {
  fontSize: {
    xs: '12', sm: '14', base: '16', lg: '18', xl: '20',
    '2xl': '24', '3xl': '30', '4xl': '36', '5xl': '48', '6xl': '60',
  },
  extend: {},
}
```

Note it's `theme.fontSize` (replace), not `theme.extend.fontSize` (merge — would keep the tuples).

Don't fix it per-label with `leading-none`/`leading-tight` sprinkled wherever wrapping is noticed today: unitless `leading-*` values are ~no-op dp amounts in NativeScript (they only *appear* to work by overriding the tuple), and the next wrapped label reintroduces the bug. One config change fixes every current and future label.

## Case guide

* **Multi-line Label gaps too big** (list titles, descriptions with `textWrap="true"`): remove the `line-height` — usually by fixing the Tailwind scale above.
* **Looks right on one screen, wrong on another**: the "right" screen likely has a `leading-*` utility overriding the tuple with a near-zero dp value. That's masking, not fixing — fix the scale.
* **Deliberately airier paragraphs** (long-form reading): add explicit dp, e.g. `line-height: 4` (≈ +4dp between lines), on that text style only.
* **Markdown/rich-text components** manage their own paragraph spacing — don't impose an app-wide `line-height` on their containers.
* **Cross-platform check**: values are additive on both platforms, so one dp value reads consistently — but always eyeball a wrapped label on both.

## Verify

* Find a label that wraps to 2+ lines (or temporarily lengthen its text): the inter-line gap should match the rhythm native text has in the OS's own apps, not paragraph-like air.
* Single-line labels are useless as evidence — `line-height` has no effect until text wraps.
* Grep the compiled CSS or source for `line-height`: every remaining occurrence should be an intentional, dp-denominated value with a reason.

Verified 2026-08: iOS 26 simulator + Android 15 emulator, @nativescript/core 9.1.0-alpha.11 with @nativescript/tailwind, in a production app (before/after screenshots of wrapped labels).
