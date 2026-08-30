---
name: ns-navigation-transitions
description: Use when writing or reviewing any Frame.navigate / RouterExtensions.navigate call, when a push/back animation looks flat, janky, or "web-like", or when deciding between animated false, clearHistory, or a custom transition — omit explicit transition options so pages animate with the platform-default navigation transition.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Navigation transitions: default to the platform

Every `Frame.navigate()` (and `RouterExtensions.navigate()` in Angular) accepts a `transition` option. The correct value, almost always, is **none at all**. Omit it and NativeScript hands the navigation to the OS — `UINavigationController`'s push/pop on iOS, the native fragment transition (with predictive back) on Android.

```ts
// WRONG: downgrades the experience — looks close to native, feels wrong
frame.navigate({
  moduleName: 'views/item/item-page',
  context: { id: item.id },
  transition: { name: 'slideLeft' },
});

// RIGHT: platform-default animation
frame.navigate({
  moduleName: 'views/item/item-page',
  context: { id: item.id },
});
```

## Why the default wins

A custom `transition` (`slideLeft`, `fade`, `flip`, …) replaces the system's transition coordinator with a hand-rolled animator. What you lose:

* **Coordinated chrome animation**: the system transition morphs the whole navigation context together — ActionBar/nav-bar crossfade, back-button label slide, Liquid Glass morphing on iOS 26, large-title collapse. A custom animator moves only the page; the chrome snaps.
* **Interactive gestures**: iOS edge-swipe pop and Android predictive back are *interactive, progress-driven* versions of the default transition. Custom transitions at best replay a canned animation, at worst fight the gesture.
* **Platform motion language**: each OS's curves, timing, dimming, and parallax are tuned per release and respect system settings like Reduce Motion. `slideLeft` is a fixed curve that ages with the codebase and looks the same — i.e. wrong — on both platforms.
* **Zero-maintenance upgrades**: when the OS redesigns navigation (as iOS 26 did), default transitions get it for free.

`slideLeft` is the classic trap: it *approximates* the iOS push, so it survives review — but it's an approximation running against the real thing every user knows by feel.

## The legitimate exceptions

Explicit options are for **suppressing** animation in programmatic navigation, not restyling it:

| Situation | Option | Why |
|---|---|---|
| Initial/setup navigation the user never "performs" — populating tab outlets on startup, restoring state, landing a deep link | `{ animated: false }` | Nothing should appear to move; the user didn't navigate. |
| Auth → main app swap, logout resets | `{ clearHistory: true, animated: false }` | A world-switch, not a push; back should not return. |
| Overlays, pickers, flows that sit *on top of* context | Modal (`showModal`, or a flavor's dialog service) | Modality is a different navigation semantic — don't fake it with a transition on a push. |
| A deliberate, designed moment (splash → home crossfade, shared-element showcase) | Custom `transition` | Fine when the *design* calls for non-navigation motion. Rare, intentional, usually one place in the app — never the default for ordinary push/pop. |

If you're typing `transition: { name: 'slide…' }` on a plain forward navigation, stop — that's the platform's job.

## Review checklist

* `grep -rn "transition" src --include="*.ts"` — each hit must be one of the exceptions above, with a reason; ordinary pushes carry no `transition`.
* `animated: false` only on navigations the user didn't initiate.
* On device: push then edge-swipe back on iOS (page and nav bar must track the finger together); on Android check predictive back preview. If either looks detached, a custom transition is likely interfering.

Verified 2026-08: iOS 26 simulator + Android 15 emulator, @nativescript/core 9.1.0-alpha.11 (edge-swipe/predictive-back behavior checked with and without custom transitions in a production app).
