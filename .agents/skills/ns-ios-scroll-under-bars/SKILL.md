---
name: ns-ios-scroll-under-bars
description: Use when a ScrollView/ListView visibly cuts off at a hard line above the tab bar or bottom edge on iOS, when content hides behind a floating/translucent bar with no way to scroll it clear, or when reviewing any iosOverflowSafeArea usage — scroll viewports must extend under floating chrome to the physical screen edge, with clearance padding inside the content.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Scroll content must reach the device edge

On modern iOS (and Material 3 Android), bottom tab bars and nav bars are **floating, translucent chrome** — Liquid Glass on iOS 26. The platform look is content scrolling *underneath* them to the physical edge of the screen, blurred through the glass. A scroll container that stops at the safe-area line produces a hard horizontal cut floating above the tab bar — an immediate tell that the layout is fighting the OS.

## The rule

**Never set `iosOverflowSafeArea="false"` on a scroll container that touches a screen edge.** NativeScript's default is the correct behavior: a view whose bounds touch a safe-area boundary is automatically expanded to the physical edge, so the scroll *viewport* runs full-bleed and the chrome floats over it.

```xml
<!-- WRONG: hard line above the tab bar; content can never reach the edge -->
<ScrollView row="1" iosOverflowSafeArea="false">
  <StackLayout class="pb-6"> </StackLayout>
</ScrollView>

<!-- RIGHT: viewport extends under the floating bar; padding gives the LAST
     item clearance so it can scroll out from behind the glass -->
<ScrollView row="1">
  <StackLayout class="pb-24"> </StackLayout>
</ScrollView>
```

Two halves, both required:

1. **Let the viewport overflow** — remove `iosOverflowSafeArea="false"` (i.e. accept the default). The clipped-at-safe-area look cannot be fixed with padding, margins, or background tricks; only the viewport itself extending under the bar fixes it.
2. **Give the content clearance** — the scrolled-to-bottom position must show the last item *above* the floating chrome. Add generous bottom padding **inside** the scroll content (~96dp covers home indicator + floating tab bar + breathing room). Without it, the final rows are permanently trapped behind the bar.

The same applies to `ListView`/`CollectionView` (use `contentInset`/footer spacing) and to the top edge under a translucent ActionBar when a page draws its own full-bleed content.

## When `iosOverflowSafeArea="false"` is legitimate

Only when the scroll container **doesn't own a screen edge**, so overflow is meaningless or harmful:

* A scroll area sandwiched between docked, opaque controls — a chat page whose composer owns the bottom edge (see `ns-keyboard-input`), or a detail page with a docked action bar below the scroll area.
* Small embedded scroll regions inside cards or sheets that sit entirely within the safe area.

In those layouts it's the *docked control* (a layout container) that should extend under the safe area — layouts do that by default too, painting their background to the edge while keeping children inside the safe area.

* When a small decorative view *inside* scroll content smears into a stretched pill or band, that is the one place `iosOverflowSafeArea="false"` belongs — on the leaf, never the viewport. See `ns-ios-safe-area-smudge`.

## Verify

* Scroll to the very bottom: content must slide beneath the tab bar and remain readable through the translucency; at rest, the last item must sit fully above the bar (if not, increase inner bottom padding — the viewport fix and the clearance padding are separate knobs).
* Check every tab root *and* pushed pages inside tabs — the floating tab bar overlays them all.
* With `iosTabBarMinimizeBehavior="onScrollDown"`, scroll down/up to confirm content stays edge-to-edge in both bar states.
* Rotate/notched devices: no opaque strip at the home indicator; the content, not the page background, shows through the glass.

Verified 2026-08: iOS 26 simulator (iPhone 16 Pro), @nativescript/core 9.1.0-alpha.11, in a production app. Android Material 3 equivalent handled by the inset system — see `ns-android-edge-to-edge`.
