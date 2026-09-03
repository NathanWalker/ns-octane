---
name: ns-ios-safe-area-smudge
description: Use when an iOS list shows a random colored streak, stretched dot/pill, or gray band near the bottom edge while scrolling, or a card/list shows an unexplained empty band at its bottom on load — NativeScript's iOS safe-area expansion stretches any small view (dots, hairline dividers, row backgrounds) whose edge lands on the safe-area boundary; fix with iosOverflowSafeArea="false" on the leaves and iosOverflowSafeAreaEnabled="false" on card containers, never on the scroll viewport.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Safe-area smudges in scrolled lists

Scrolling a list, a tiny decorative view suddenly renders as a smear: a 2×2 status dot stretched into a tall pill, a 1px divider inflated into a full gray band, a row background bleeding past its card. It only happens at certain scroll offsets, near the bottom (or top) of the screen, and fixes itself when you keep scrolling — which makes it look like a paint glitch. It isn't.

**Load-time variant:** the same mechanism fires before any scrolling. If a card/list container's bottom edge lands near the safe-area boundary at initial layout (short content, or the last card on the page), iOS expands the *container* down to the physical screen edge — the card renders with a long empty band at its bottom, as if it had huge trailing padding.

## The cause

NativeScript's iOS safe-area expansion applies to **every view whose laid-out edge touches a safe-area boundary**, not just page-level containers. That behavior is exactly right for the scroll viewport (see `ns-ios-scroll-under-bars` — content should flow under floating chrome). But scroll content moves: any row, dot, or divider can momentarily land with its edge on the boundary line. When it does, iOS-side layout expands that innocent view to the physical screen edge — and a 1px divider "expanded to the edge" is a giant band. The smaller and thinner the view, the more grotesque the artifact, which is why dots and hairline dividers are the usual victims.

## The fix

Set `iosOverflowSafeArea="false"` on the small views **inside** scroll content — never on the scroll container itself:

```xml
<!-- scroll container keeps the default (overflows under floating chrome) -->
<ScrollView row="1">
  <StackLayout class="pb-24">
    <!-- tappable row: its pressed background must not expand -->
    <GridLayout columns="auto, *" class="p-4" iosOverflowSafeArea="false" tap="open">
      <!-- status dot: without the flag it smears into a pill -->
      <StackLayout col="0" width="8" height="8" class="rounded-full" backgroundColor="#22c55e"></StackLayout>
      <Label col="1" text="Item title"></Label>
    </GridLayout>
    <!-- hairline divider: without the flag it smears into a band -->
    <StackLayout height="1" class="mx-4" backgroundColor="#e5e7eb" iosOverflowSafeArea="false"></StackLayout>
  </StackLayout>
</ScrollView>
```

Apply it, inside any ScrollView/ListView/CollectionView content, to:

* **status dots / color indicator bars** (fixed tiny width or height + background color)
* **hairline dividers** (1px views)
* **repeated row roots** that have a background, pressed highlight, or tap handler
* any other **small fixed-size decorated view** (chips with backgrounds, avatars with borders)

Plain Labels and unstyled layout wrappers don't need it — expansion is invisible without a background/border to stretch.

## Container variant: `iosOverflowSafeAreaEnabled="false"` on cards

Core has **two** properties and they are not interchangeable:

* `iosOverflowSafeArea` — per-view: may *this* view expand into the safe area.
* `iosOverflowSafeAreaEnabled` — inherited (default `true`): master switch for the expansion mechanism on this view **and its whole subtree**.

For a styled container (a card StackLayout with background + rounded corners) holding repeated rows, set `iosOverflowSafeAreaEnabled="false"` on the container. This fixes the load-time stretch of the card itself (`iosOverflowSafeArea="false"` on the rows alone does not stop the *container* expanding) and disables expansion for every descendant in one attribute:

```xml
<!-- card can no longer stretch into the safe area at load,
     and no descendant can smear during scroll -->
<StackLayout class="card p-0" iosOverflowSafeAreaEnabled="false">
  <GridLayout class="p-4" tap="open"><Label text="Row"></Label></GridLayout>
  <StackLayout height="1" backgroundColor="#e5e7eb" class="mx-4"></StackLayout>
</StackLayout>
```

With the container switch in place, per-row `iosOverflowSafeArea="false"` inside that subtree is redundant (harmless, but unnecessary on new code). Keep the switch on the **card/content container** — putting it any higher disables overflow for the viewport itself.

## What NOT to do

* **Never** put `iosOverflowSafeArea="false"` on the ScrollView/ListView itself to "fix" a smudge — that trades a transient artifact for a permanent hard cut above the tab bar, the exact anti-pattern `ns-ios-scroll-under-bars` exists to prevent. The two properties serve opposite goals at different depths of the tree: **overflow ON at the viewport, OFF at the decorative leaves.**
* Don't try to fix it with margins/padding: the expansion is computed against screen coordinates, so any offset that scrolls can still land on the boundary.

## Verify

Scroll slowly through every list so rows cross the bottom boundary, pausing at intermediate offsets (fling + catch): no streaks, pills, or bands may appear at any offset. Check every page with dots/dividers, both themes — dark surfaces make light-colored bands subtler but still visible. Also check the **initial load state before touching anything**: the last card on each page must end where its content ends. Test with content short enough that a card's bottom edge lands near the safe-area boundary.

Verified 2026-08: iOS 26 simulator (iPhone 16 Pro), @nativescript/core 9.1.0-alpha.11, in a production app (both the scroll-time and load-time variants reproduced and fixed).
