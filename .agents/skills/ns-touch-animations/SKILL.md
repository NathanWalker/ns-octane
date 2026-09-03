---
name: ns-touch-animations
description: Use when adding any tappable UI (buttons, pills, chips, cards), reviewing touch/press animation code, or tuning tap feel — enable TouchManager.enableGlobalTapAnimations once instead of wiring per-view touch handlers or manual scale animations, opt views out with ignoreTouchAnimation (singular — the plural is silently ignored), and override per-view with the touchAnimation property.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Touch animations via TouchManager

`@nativescript/core` ships a global press-feedback system. Enable it once at bootstrap (before the app starts — e.g. `app.ts` / `main.ts`):

```ts
import { CoreTypes, TouchManager } from '@nativescript/core';

TouchManager.enableGlobalTapAnimations = true;
TouchManager.animations = {
  down: {
    scale: { x: 0.97, y: 0.97 },
    duration: 120,
    curve: CoreTypes.AnimationCurve.easeInOut,
  },
  up: {
    scale: { x: 1, y: 1 },
    duration: 120,
    curve: CoreTypes.AnimationCurve.easeInOut,
  },
};
```

Every view with a `tap` binding automatically gets the app-wide press animation — TouchManager wires native down/up handlers when the tap listener is added; no per-view code. (`down`/`up` also accept functions `(view: View) => void` for fully custom native animations.)

## The rule

**Never hand-roll press feedback.** Specifically, do NOT:

* add a `touch` binding that scales/fades a view on down/up — the global animation already does this, and the two will fight over the same transform (the iOS path caches the original transform; a competing manual scale corrupts what gets restored)
* call `view.animate({ scale })` from tap/touch handlers for "button feel"
* configure TouchManager per component — it is global, configured once at bootstrap

`touch` bindings remain correct for **gesture logic** (drag tracking, pan-to-explore surfaces) — the rule is only about press-feedback *animations*.

## Opting out

Views whose taps should NOT animate (list rows, full-screen overlays, containers where a child already animates):

```xml
<GridLayout tap="onTap" ignoreTouchAnimation="true"></GridLayout>
```

**Gotcha: the property is singular.** `ignoreTouchAnimations="true"` (plural) is silently ignored — it's an unknown property, the view still animates. When touching a file that contains the plural form, fix it.

## Per-view override

When one view genuinely needs a different press feel, use the `touchAnimation` property instead of touch handlers — it accepts `{ down, up }` where each is a `TouchAnimationFn` (`(view: View) => void`) or an `AnimationDefinition`:

```xml
<Label tap="onTap" touchAnimation="{{ heroTouchAnimation }}"></Label>
```

```ts
heroTouchAnimation = {
  down: { scale: { x: 0.9, y: 0.9 }, duration: 150, curve: CoreTypes.AnimationCurve.easeInOut },
  up: { scale: { x: 1, y: 1 }, duration: 200, curve: CoreTypes.AnimationCurve.easeInOut },
};
```

Views with `touchAnimation` set animate even without `enableGlobalTapAnimations`; with it on, `touchAnimation` overrides the global `TouchManager.animations` for that view.

## Interplay notes

* The global iOS `down` animation caches the view's original transform, so avoid separately animating `scale`/`translate` on the *same element* that has a tap binding; put decorative transforms on a wrapper or child, or opt the view out first.
* Haptics are separate: pair a haptic impact in the tap handler when the action warrants it ([@nativescript/haptics](https://docs.nativescript.org/plugins/haptics)).
* Disabled/interaction-blocked views (`isUserInteractionEnabled=false`) don't receive taps, hence no animation — no opt-out needed.

## Audit checklist

* `grep -rn '(touch)=' src` (Angular) / `grep -rn 'touch=' app` (core XML) — each hit must be gesture logic, not press feedback.
* `grep -rn 'ignoreTouchAnimations' src` — plural typo, silently no-ops; fix to `ignoreTouchAnimation`.
* Manual `view.animate({ scale })` inside tap/touch handlers → remove in favor of the global animation or a `touchAnimation` override.

API docs: https://docs.nativescript.org/api/classes/TouchManager (append `.md` for a fetchable markdown version).

Verified 2026-08: iOS 26 simulator + Android 15 emulator, @nativescript/core 9.1.0-alpha.11, in a production app with global tap animations enabled app-wide.
