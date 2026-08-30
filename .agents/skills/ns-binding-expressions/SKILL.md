---
name: ns-binding-expressions
description: Use when an XML {{ }} binding throws "Invalid expression syntax", "Disallowed binary operator", or "Invalid converter syntax", when arrow functions in bindings fail, when a binding writes garbage back to the model, or when wiring $value/$parent/$parents/converters — the expression allow-list, the two-way-by-default write-back and its string-substitution hazard, and the silent-global fallback for typo'd names.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Binding expressions: allow-list, two-way default, write-back hazard

## What you may write inside `{{ }}`

Expressions are parsed with a real JS parser against an **allow-list** of node types: array/object literals, template literals, member access (incl. optional chaining), calls, `new`, ternaries, unary `+ - ! void typeof`, arithmetic/comparison operators, and logical `&& || ??`.

**Not allowed** (throws `Invalid expression syntax`): arrow functions, function expressions, assignments, `++`/`--`, `await`, comma sequences. `{{ items.filter(i => i.done) }}` fails — compute it in the view model and bind the result.

Special keys: `$value` (the whole binding context — the implicit source for bare expressions), `$parent` (one level up), `$parents['StackLayout']` / `$parents[0]` (ancestor **View by class name** or depth — a view lookup, not a data lookup).

`|` is the **converter pipe**, never bitwise-or:

```xml
<Label text="{{ createdAt | dateConverter('DD.MM.YYYY') }}" />
```

```ts
import { Application } from '@nativescript/core';
Application.getResources()['dateConverter'] = {
  toView: (value: Date, format: string) => formatDate(value, format),
  toModel: (value: string, format: string) => parseDate(value, format),
};
```

Converters run even for `null` values — guard inside `toView`.

## Every XML binding is two-way by default

`{{ expr }}` sets `twoWay: true` unless you opt out. Two consequences:

1. Editable targets (TextField `text`) write back to the model automatically — usually what you want.
2. **Computed expressions attempt a write-back too**, and the write-back path rewrites the expression by *global string substitution* of the source property name. With source `firstName`, the expression `firstName + ' ' + firstNameSuffix` gets **both** occurrences replaced — including the substring inside `firstNameSuffix` — producing garbage.

Defenses:

* Opt out with the third positional param: `{{ someProp, someProp * 2, false }}` (source, expression, twoWay).
* Never name one bindable property as a prefix/substring of another (`firstName` / `firstNameSuffix`) when both appear in one expression.

## Silent failures and how to debug them

* **A typo'd identifier resolves against `global`** instead of erroring — the binding just renders `undefined`. A throwing target setter is also silently swallowed (old value stays).
* Malformed source paths surface only via `Trace`:

```ts
import { Trace } from '@nativescript/core';
Trace.enable();
Trace.addCategories(Trace.categories.Binding + ',' + Trace.categories.BindingError);
```

(See `ns-trace-debugging` — note `BindingError` is NOT part of `Trace.categories.All`.)

* `tap="onTap"` resolves against the page's **exports**; `tap="{{ onTap }}"` resolves against the **bindingContext**. Different resolution paths — mixing them up gives "handler not found" on one page and works on another.
* Clearing an ancestor's `bindingContext` blanks bound properties down the tree (context is inherited).
* Parsed expressions are cached by their text — identical strings across the app cost one parse.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: allow-list, error strings, converter pipe and global fallback confirmed in packages/core/ui/core/bindable/bindable-expressions.ts, two-way default and prepareExpressionForUpdate substitution in ui/builder/binding-builder.ts + ui/core/bindable/index.ts; expression forms asserted in apps/automated bindable/xml-declaration tests. Not re-run standalone.
