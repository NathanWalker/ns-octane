---
name: ns-xml-custom-components
description: 'Use when authoring NativeScript XML — custom components via xmlns, codeFile/cssFile/import attributes, ios:/android: attribute prefixes vs <ios>/<android> element blocks — or when decoding a "Building UI from XML." error like "Module not found for element", including why template contents only throw when the template first renders.'
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# XML builder: custom components, platform blocks, and its errors

## Custom components

Point an `xmlns` prefix at a module path (relative to `app/`), then use exported view classes as tags:

```xml
<Page xmlns:ui="components/rating">
  <StackLayout>
    <ui:Rating value="3" />
  </StackLayout>
</Page>
```

* The module's **exported symbol name** is the tag (`export class Rating extends GridLayout`).
* A component folder can be XML-first: `components/card/Card.xml` (+ optional co-located `Card.css`, code-behind, or a `package.json` naming the entry) — usable with no JS class at all.
* Framework modules work through the same mechanism: `xmlns:c="ui/label"` → `<c:Label>`.
* Unknown attributes on a custom component become plain expando properties (`panel['myProperty'] = 'myValue'`) — **never an error**, so attribute typos fail silently. Property names are checked nowhere; test bindings visually.
* Dashed lowercase tags are first-class: `<stack-layout>`, `<segmented-bar>` — and CSS *type* selectors must use that dashed form.

## Page-level attributes

* `codeFile="~/views/shared/list-code"` and `import="..."` are equivalent — both point the page at a different code-behind; a bad path **throws at parse time**.
* `cssFile="~/styles/custom.css"` scopes a stylesheet to the page — and the path is itself run through file-qualifier resolution (`custom.land.css` can override what you referenced — see `ns-file-qualifiers`).

## Platform-conditional markup: two mechanisms, don't nest them

```xml
<TextField ios:editable="false" android:editable="true" />

<ios><TextField hint="Cupertino" /></ios>
<android><Label text="Mountain View" /></android>
```

Attribute prefixes (`ios:`/`android:`) and element blocks (`<ios>`/`<android>`) both work — but **nesting an `<android>` block inside an `<ios>` block throws**. Keep platform blocks siblings.

## Reading builder errors

```
Building UI from XML. @app/views/feed/feed-page.xml:11:5
 > Module 'Unicorn' not found for element 'Unicorn'.
```

The `@file:line:col` points at the offending element. Two timing rules:

* Page-level errors throw when the page **loads**.
* Errors inside an `itemTemplate` are **deferred**: `Builder.load()` succeeds and the throw happens only when the template first instantiates (first row render) — a list page that "loads fine then crashes on data arrival" is usually a broken template element, and the reported line/col points inside the template.

Programmatic use: `Builder.parse(xmlString, context)` and `Builder.load({ path, name, exports, page, attributes })`.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: error format, deferred template throws, platform-block nesting throw, expando attributes, dashed tags and codeFile/cssFile behavior are asserted in apps/automated/src/xml-declaration/xml-declaration-tests.ts; not re-run standalone.
