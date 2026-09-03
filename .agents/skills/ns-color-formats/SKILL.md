---
name: ns-color-formats
description: Use when constructing new Color(...) from hex strings, ints, or rgb()/hsl() syntax, reading color.hex / color.argb, or colors come out with wrong alpha — hex STRINGS are RRGGBBAA (alpha last) while argb ints and the 4-arg constructor are alpha-FIRST, .hex drops the alpha when opaque, and short hex doubles each nibble.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Color: the two alpha orderings

`Color` accepts many input forms, and the alpha channel sits at **opposite ends** depending on the form. Mixing them up produces "the right color at the wrong opacity" bugs that survive review.

```ts
import { Color } from '@nativescript/core';

const c = new Color(100, 255, 100, 100); // 4-arg constructor: (a, r, g, b) — alpha FIRST
c.a;    // 100
c.r;    // 255
c.hex;  // '#FF646464'  — hex string: RRGGBBAA — alpha LAST
c.argb; // 0x64ff6464   — int: 0xAARRGGBB — alpha FIRST
```

| Input form | Alpha position | Example |
|---|---|---|
| Hex string in (`'#RRGGBBAA'`) | **last** | `new Color('#FF0000FF')` → red, a=255 |
| `.hex` out | **last**, and **omitted entirely when a=255** | opaque red → `'#FF0000'` (6 digits, not 8) |
| 4-arg constructor `(a, r, g, b)` | **first** | above |
| Packed int / `.argb` | **first** (`0xAARRGGBB`) | `new Color(0x64646464)` → a=100,r=100,g=100,b=100 |

Consequences:

* **`new Color(0x3366ff)` is INVISIBLE** — the top byte is alpha, and it's 0. Numeric colors need the alpha byte: `0xff3366ff`. Same color as string: `'#3366FF'` (opaque by default). This is the single most common Color bug.
* **Never round-trip `.argb` through a hex string** — `new Color('#' + argbHex)` puts the alpha byte on the wrong end.
* **Never assume `.hex` has 8 digits** — parse defensively; opaque colors come back as 6.

## Other accepted forms

* **Short hex doubles each nibble**: `'#F80'` → `'#FF8800'` (g = 136); `'#F80F'` adds alpha the same way.
* **CSS Color Module 4 space syntax**: `new Color('rgb(255 100 100 / 0.5)')` → a = 0x80, `.hex` = `'#FF646480'`. Classic `rgb(a,b,c)`, `rgba()`, `hsl()`, `hsla()` and named colors also work.
* **`color-mix()` works**: `new Color('color-mix(in lch longer hue, hsl(200deg 50% 80%), coral)').toRgbString()` → `'rgba(136, 202, 134, 1.00)'`.
* **`Color.isValid(value)`** is the guard for user input: accepts 3/4/6/8-digit hex, `rgb()`/`hsl()` forms; rejects `null` and unknown names — use it before constructing from untrusted strings.

```ts
function safeColor(input: string, fallback = '#000000'): Color {
  return new Color(Color.isValid(input) ? input : fallback);
}
```

`isValid` is stricter than the constructor: it rejects `hsv()` and `color-mix()` strings the constructor parses fine — relevant because `view.animate({ backgroundColor })` gates on `Color.isValid` and logs `Property backgroundColor must be valid color` before dropping the animation.

## Manipulation API that actually exists (9.1)

* `Color.mix(c1, c2, amount)` — blending (there is no `Color.blend` or `Color.fromIterable`).
* `color.setAlpha(a)` takes **0–255**, not 0–1.
* `color.ios` is a `UIColor`; `color.android` is a **signed** 32-bit int (negative values are normal — compare with `>>> 0` if you need unsigned).

Android note: 8-digit hex in **Android XML resources** is AARRGGBB (alpha first) — the opposite of NativeScript's CSS/hex-string order. When copying a color between `App_Resources/Android` XML and app CSS, move the alpha byte.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: all orderings and forms asserted in apps/automated/src/color/color-tests-common.ts and ui/styling/style-tests.ts (color-mix); not re-run standalone.
