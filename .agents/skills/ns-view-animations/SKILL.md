---
name: ns-view-animations
description: Use when calling view.animate() / createAnimation().play(), hitting "Animation is already playing.", "Animation cancelled.", "cannot animate height on root view" or "Animating property 'X' is unsupported", or when a cancelled animation's promise never settles on iOS — the two rejection shapes, synchronous validation throws, absolute (not relative) transforms, and the per-platform cancel asymmetry.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# view.animate(): promises, cancel, transforms

```ts
import { CoreTypes } from '@nativescript/core';

await view.animate({
  translate: { x: 0, y: -24 },
  opacity: 1,
  duration: 220,
  curve: CoreTypes.AnimationCurve.easeInOut, // ease, easeIn, easeOut, easeInOut, linear, spring, cubicBezier(...)
});
```

Animatable: `opacity`, `backgroundColor`, `translate`, `scale`, `rotate`, `width`, `height` (+ `duration`, `delay`, `iterations`, `curve`, `target`).

## The three failure shapes

1. **Synchronous throws** for bad option types — `label.animate({ opacity: '0.75' as any })` and invalid percent strings throw **before** any promise exists. Wrap the *call*, not just the promise, when input is dynamic.
2. **Replay rejects with a bare string**: playing an `Animation` that's already playing rejects with `'Animation is already playing.'` — a string, not an Error. `catch (e) { e.message }` logs `undefined` for this case.
3. **Cancel rejects with a real Error**: `'Error: Animation cancelled.'` via `e.toString()`.

```ts
const animation = view.createAnimation({ opacity: 0, duration: 400 });
animation.play().catch((e) => {
  const msg = typeof e === 'string' ? e : e?.toString();
  if (msg !== 'Error: Animation cancelled.') throw e;
});
animation.cancel(); // safe no-op if never played
```

## Cancel is asymmetric across platforms

* **Android**: cancelling resolves/settles the promise like a finish.
* **iOS**: the promise from a cancelled `animate()` can stay **pending forever** with `isPlaying` stuck — an `await` upstream hangs, and replaying hits `'Animation is already playing.'`.

Rule: **never `await` an animation you might cancel.** Fire-and-forget with a `.catch`, and guard replays with `if (!animation.isPlaying)`.

## Transforms are absolute, not relative

Animating `{ translate: { x: 100, y: 0 } }` twice moves the view **once** — values are destinations from the identity transform, not deltas. To slide something in: set the off-screen start state directly (`view.translateX = -300`), then animate to the resting position (`{ translate: { x: 0, y: 0 } }`). Chained different-property animations keep earlier results (a `scale` animation after a `translate` leaves `translateX` at its animated value).

## Platform footguns

* `iterations: 0` is **infinite on Android** (maps to `Animation.INFINITE`); iOS treats it as none. Use `iterations: 1` as the explicit default.
* `curve: 'spring'` is a UIKit spring on iOS but a `BounceInterpolator` on Android — visibly different motion. `cubicBezier(...)` is the portable custom curve.
* Android throws `cannot animate ${property} on root view` (animating the page root) and `Animating property 'X' is unsupported` — exact strings worth grepping logs for.
* An invalid `backgroundColor` value logs `Property backgroundColor must be valid color` and silently drops that property from the set (see `ns-color-formats`).

For CSS `@keyframes` (different engine, different rules) see `ns-css-keyframes`. For press feedback don't hand-roll animate calls — see `ns-touch-animations`.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: rejection shapes and synchronous throws asserted in apps/automated/src/ui/animation/animation-tests.ts; absolute transforms, cancel asymmetry, iterations-0 and error strings confirmed in packages/core/ui/animation/index.{ios,android}.ts and animation-common.ts. Not re-run standalone.
