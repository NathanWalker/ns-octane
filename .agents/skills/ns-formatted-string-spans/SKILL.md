---
name: ns-formatted-string-spans
description: Use when mixing styles inside one Label/Button via FormattedString and Span, when a span's colour never applies, or when label.text stops updating after formatted text was shown — setting text while formattedText is set is a silent no-op, the span colour property is `color` (there is no working foregroundColor), Span.text collapses only the first newline/tab, and a span becomes tappable just by adding a linkTap listener.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# FormattedString and Span

Rich text inside a single text component:

```xml
<Label textWrap="true">
  <FormattedString>
    <Span text="14 " fontSize="24" fontWeight="bold" />
    <Span text="new items " color="#2563eb" />
    <Span text="since yesterday" color="#6b7280" />
  </FormattedString>
</Label>
```

```ts
import { FormattedString, Span } from '@nativescript/core';

const fs = new FormattedString();
const bold = new Span();
bold.text = '14 ';
bold.fontWeight = 'bold';
fs.spans.push(bold);
label.formattedText = fs;
```

## The traps

* **`label.text = '...'` while `formattedText` is set is a SILENT NO-OP** on both platforms. The formatted text keeps rendering, nothing throws, and the "why won't my label update" hunt begins. To go back to plain text, clear the formatted text first: `label.formattedText = null; label.text = 'plain';`
* **The colour property is `color`.** Spans style with the same CSS-ish properties as text views (`color`, `backgroundColor`, `fontSize`, `fontFamily`, `fontWeight`, `fontStyle`, `textDecoration`) — there is no functioning `foregroundColor`.
* **`Span.text` replaces only the FIRST `\n` / `\t`** when collapsing whitespace — multi-line span content doesn't behave like a Label's `text`. One span per line (or embed real line breaks via separate spans) is the reliable structure.
* **A span becomes tappable purely by having a `linkTap` listener** — no property to set:

```ts
const link = new Span();
link.text = 'View all';
link.color = new Color('#2563eb');
link.on(Span.linkTapEvent, () => openAllItems());
fs.spans.push(link);
// iOS additionally needs user interaction enabled on the owning text view for links inside selectable text.
```

* Spans inherit unset properties from the owning text view — set base styling on the Label and override per span, not the reverse.
* `formattedText` participates in bindings like any property; but per-span *bindings* multiply observers — for long lists prefer rebuilding the FormattedString on data change.

## When NOT to use it

Separate Labels in a layout beat FormattedString when pieces need independent layout (wrapping columns, tap targets bigger than the text). FormattedString is for inline runs within one flowing text.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the text/formattedText no-op read from packages/core/ui/text-base/index.{ios,android}.ts, span colour property and first-newline collapse from ui/text-base/span.ts, linkTap wiring from span.ts; not re-run standalone.
