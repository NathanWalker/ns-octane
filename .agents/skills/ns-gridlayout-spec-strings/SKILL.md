---
name: ns-gridlayout-spec-strings
description: Use when writing GridLayout rows/columns spec strings ("auto, *, 2*"), hitting "Cannot parse item spec from string" or "itemSpec is already added to GridLayout", or when a grid column/row silently renders as a 1dp hairline — fr and % units parseInt to garbage without erroring, 'auto' is case-sensitive (Auto throws), numbers are dip not px, grid.rows is write-only, and gap only works on FlexboxLayout.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# GridLayout spec strings

```xml
<GridLayout rows="auto, *, 2*, 100" columns="auto * 48">
```

Separators are spaces and/or commas. The three unit types:

| Token | Meaning |
|---|---|
| `auto` | size to content (**exactly lowercase** — `Auto` throws `Cannot parse item spec from string: Auto`) |
| `*`, `2*`, `10*` | star weights (`*` = `1*`) |
| `100` | **dip** (device-independent pixels — multiplied by display density natively; not physical px) |

## The silent web-unit trap

The parser tries `parseInt` on anything that isn't `auto`/`*`:

* `columns="1fr"` → `parseInt('1fr')` = 1 → a **1-dip column**, no error. Use `*`.
* `columns="50%"` → a **50-dip column**, no error. Percent is not supported in grid specs — use star ratios (`1*, 1*` for halves) or `GridUnitType`-free layouts.

If a grid column/row is mysteriously hairline-thin, grep its spec for `fr`/`%` first.

## Reading and writing specs from code

`grid.rows` / `grid.columns` are **write-only** — the getters don't exist at runtime, so `grid.rows` is `undefined` (despite the TypeScript type saying `string`). Read structure with `getRows()` / `getColumns()`; mutate with `addRow(new ItemSpec(1, 'star'))`, `addColumn`, `removeRow`, etc.

```ts
import { GridLayout, ItemSpec } from '@nativescript/core';

const grid = new GridLayout();
grid.addRow(new ItemSpec(1, 'auto'));
grid.addRow(new ItemSpec(1, 'star'));
grid.addColumn(new ItemSpec(48, 'pixel')); // 'pixel' = dip
GridLayout.setRow(child, 1);
grid.addChild(child);
```

* An `ItemSpec` instance belongs to exactly one grid — reusing it throws `itemSpec is already added to GridLayout.`
* `ItemSpec` constructor: 0 or 2 args (`ItemSpec expects 0 or 2 arguments`); negative/NaN values throw `Value should not be negative, NaN or Infinity`.
* Child placement: `col`/`colSpan`/`row`/`rowSpan` are the real property names; `column`/`columnSpan` are aliases. Values clamp — `setRow(view, -1)` becomes 0 and `setRowSpan(view, 0)` becomes 1 **without throwing**, so an off-by-one lands your view in row 0 silently.

## `gap` doesn't work here

`gap` / `row-gap` / `column-gap` are registered as CSS properties globally but **only FlexboxLayout honors them** — on GridLayout and StackLayout they are silently ignored. Fake grid gaps with padding on cells or extra fixed-size rows/columns.

## Star sizing reality

Star columns distribute whole dips: four `*` columns in 110dip come out 28/27/28/27 — don't assert pixel-equal widths in tests or pixel-perfect designs.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: parser behavior, exact error strings, write-only rows/columns, dip conversion, clamping and the gap/Flexbox limitation confirmed in packages/core/ui/layouts/grid-layout/* and asserted in apps/automated/src/ui/layouts/grid-layout-tests.ts; not re-run standalone.
