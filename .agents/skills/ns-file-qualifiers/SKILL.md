---
name: ns-file-qualifiers
description: Use when naming platform/size/orientation file variants (page.ios.xml, home.land.css, main.minWH600.xml) or debugging why a variant file is ignored — the supported qualifiers are minWH/minW/minH/land/port/android/ios in that priority order, .land beats .ios, and .tablet/.phone are NOT qualifiers at all (they silently never load).
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# File-name qualifiers: what resolves, in what order

NativeScript resolves `foo.xml` / `foo.css` / `foo.js` against qualified sibling files at runtime. The **complete** supported qualifier list, ordered by priority (highest wins):

1. `minWH<n>` — min of width AND height ≥ n dip (e.g. `main.minWH600.xml`)
2. `minW<n>` — min width
3. `minH<n>` — min height
4. `land` / `port` — orientation
5. `android` / `ios` — platform

```
test.xml
test.android.xml
test.land.xml
test.minWH600.xml
```

On an Android tablet in portrait with both dimensions ≥ 600, **`test.minWH600.xml` wins** — and on any device in landscape, `test.land.xml` beats `test.ios.xml`/`test.android.xml`. Platform is the *lowest* priority qualifier, which surprises everyone: an orientation variant overrides your platform variant.

## The `.tablet` trap

**`.tablet` / `.phone` are not qualifiers.** No matcher exists for device type, and a file with an unrecognized qualifier isn't even considered a candidate for the base name — `page.tablet.xml` silently never loads, ever. Use size qualifiers instead:

```
home.xml            → phones
home.minWH600.xml   → tablets (the conventional tablet breakpoint)
```

## Rules that bite

* **`minW`/`minH` explicitly exclude `minWH` files** — `test.minW600.xml` and `test.minWH600.xml` are distinct candidates; the matcher never confuses them, but you can: a `minWH` file is NOT a fallback for `minW`.
* **XML, CSS and JS resolve independently.** `page.xml` + `page.land.css` + `page.ios.js` is legal; each artifact picks its own best variant. This also means a stray `foo.land.css` sitting next to a `foo.css` you reference explicitly (`cssFile="…/foo.css"`) **silently overrides it in landscape** — explicit `cssFile`/`codeFile` attribute paths are themselves qualifier-resolved.
* Repeated qualifiers in one name: only the **last** occurrence is scored.
* Custom components resolve the same way inside their folder — a component can ship `MyControl.xml`, `MyControl.ios.xml`, `MyControl.minWH600.xml`.

## Worked example

```
views/player/
  player-page.xml            # base
  player-page.minWH600.xml   # tablet layout
  player-page.land.xml       # phone landscape (beats platform variants!)
  player-page.android.css    # Android-only styling
  player-page.css            # shared styling
```

If tablet-landscape needs its own layout, that's `player-page.minWH600.xml` (minWH outranks land); orientation differences within it belong in CSS (`.ns-landscape` scoping — see `ns-root-css-classes`).

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: priority order and the .tablet non-qualifier behavior are asserted in apps/automated/src/name-resolvers-tests/qualifier-matcher-tests.ts and implemented in packages/core/module-name-resolver/qualifier-matcher/index.ts (supportedQualifiers list); not re-run standalone.
