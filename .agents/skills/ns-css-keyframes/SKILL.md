---
name: ns-css-keyframes
description: Use when a CSS @keyframes animation animates nothing, snaps back at the end, or ignores animation-direction alternate / animation-play-state — only 12 properties (+transform) are animatable and everything else is silently dropped, fill-mode forwards is required to keep the end state, a unitless animation-delay is seconds, and keyframes under a non-matching @media come back null.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# CSS @keyframes: what actually animates

```css
@keyframes pulse {
  0% { transform: scale(1, 1); }
  50% { transform: scale(1.08, 1.08); }
  100% { transform: scale(1, 1); }
}
.pulse {
  animation-name: pulse;
  animation-duration: 0.8s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
```

Adding the class to a loaded view is enough to start it. Shorthand order: `animation: name duration timing-function delay iteration-count`.

## The animatable set — everything else is silently dropped

Exactly these properties animate: `width`, `height`, `opacity`, `background-color`, `rotate`, `rotateX`, `rotateY`, `perspective`, `scaleX`, `scaleY`, `translateX`, `translateY` — plus the `transform` shorthand. A keyframe declaring `color`, `border-radius`, or `font-size` is **discarded with no warning**: the animation "runs" but that property never moves. If a keyframe animation does nothing, check the property list first.

## Rules the web trained you to get wrong

* **No `fill-mode` → snap-back.** Without `animation-fill-mode: forwards` (or `both`), every animated value resets to unset when the animation ends. If the view must stay where it landed, `forwards` is mandatory.
* **A unitless delay is SECONDS**: `animation-delay: 1.5` = 1500ms (durations: `4s` = 4000ms, `500ms` works too).
* **`animation-direction` recognizes only the exact string `reverse`** — `alternate` and `alternate-reverse` are ignored.
* **`animation-play-state` is not implemented** (a TODO in the parser) — pausing/resuming must be done in code.
* `infinite` maps to `Number.POSITIVE_INFINITY` for `iteration-count`.
* `spring` is a valid NativeScript-only timing function.
* `transform: none` in a keyframe resets scale to **1** (identity), not 0.

## Structural quirks

* **Duplicate `@keyframes` names replace wholesale** — the second block wins entirely; there is no per-offset merging.
* Comma selectors (`20%, 60% { }`) expand into separate keyframes, and the resulting array is sorted by offset regardless of source order.
* **Keyframes gated behind a non-matching `@media` yield `null`, not `[]`** — code reading `page.getKeyframeAnimationWithName(...)` / parsed `animation.keyframes` must null-check.
* `@import 'path/other.css';` works in NativeScript CSS.
* Replaying an already-running keyframe animation logs `Keyframe animation is already playing.` and returns an already-resolved promise (unlike `view.animate()`, which rejects — see `ns-view-animations`).
* Keyframe values write through the CSS `keyframe` value source — they compete with styles set from code; prefer one owner per property.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the animatable-property gate and shorthand handlers confirmed in packages/core/ui/styling/css-animation-parser.ts and keyframe-animation.ts; unitless delay, spring curve, infinite mapping, duplicate-name replacement and null-under-media asserted in apps/automated/src/ui/animation/css-animation-tests.ts. Not re-run standalone.
