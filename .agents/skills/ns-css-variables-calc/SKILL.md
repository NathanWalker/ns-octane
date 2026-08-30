---
name: ns-css-variables-calc
description: Use when using var(--x, fallback) or calc() in NativeScript CSS, when view.width reads back as a unit object instead of a number, or when a calc() mixing px and % never evaluates — the var() fallback truth table, the unit-dependent return shapes of calc(), and percent values being fractions (50% parses to value 0.5).
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# CSS variables and calc()

Custom properties and `var()` work, with cascade/inheritance down the view tree:

```css
.ns-root { --brand: #2563eb; --pad: 16; }
.cta { color: var(--brand); padding: var(--pad); }
```

## var() fallback truth table

| Declaration | Result |
|---|---|
| `var(--undefined-var)` | property **unset** |
| `var(--undefined-var, red)` | `red` |
| `var(--undefined-var, var(--defined-fallback))` | the fallback var's value |
| `var(--undefined-var, var(--undefined-fallback))` | **unset** (no error) |
| `var(--undefined-var, var(--undefined-fallback, yellow))` | `yellow` |

An undefined variable with no (resolvable) fallback silently unsets the property — it does not keep a previous value and does not warn.

Dynamic theming trick: `class` is settable via CSS as a special property, and can itself come from a variable — `class: var(--theme-class);` swaps component classes per scope. Note an **inline** `style="--x: ..."` custom property beats any class-defined one.

## calc(): the return-shape trap

`calc()` folds constants, but the **type** of the computed style value depends on the unit inside:

| CSS | `view.width` reads back as |
|---|---|
| `width: calc(5 + 5)` | `10` (number, dip) |
| `width: calc(5dip + 5dip)` | `10` |
| `width: calc(6% + 4%)` | `{ unit: '%', value: 0.1 }` |
| `width: calc(5px + 5px)` | `{ unit: 'px', value: 10 }` |

And **percent values are fractions**: `'50%'` parses to `{ value: 0.5, unit: '%' }`. Code doing `view.width.value === 50` or treating `view.width` as always-number breaks the moment a percent or px unit enters. Read defensively:

```ts
import { PercentLength } from '@nativescript/core';

function widthInfo(v: any): string {
  if (typeof v === 'number') return `${v} dip`;
  if (v?.unit === '%') return `${v.value * 100}%`;
  return `${v?.value} ${v?.unit}`;
}
```

**Mixed px/% in one `calc()` is left unevaluated** — `calc(100px - (100px - 100%))` stays a literal string and the property never resolves. There is no late (layout-time) evaluation; restructure to a single unit.

`PercentLength.parse` throws on malformed strings — including the classic template-literal bug `` `${undefined}px` `` → `'undefinedpx'`. Guard interpolated style strings.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the fallback table, calc return shapes, fraction percents and the unevaluated mixed-unit case are asserted in apps/automated/src/ui/styling/style-tests.ts and style-properties-tests.ts; not re-run standalone.
