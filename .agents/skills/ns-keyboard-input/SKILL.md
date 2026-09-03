---
name: ns-keyboard-input
description: Use when the iOS/Android keyboard covers a text input, when building a chat/composer/search bar docked to the keyboard, or when choosing between @nativescript/iqkeyboardmanager and @nativescript/input-accessory — the decision framework, the docked-composer implementation (TextView not TextField, tab-bar exclusion rule), and the verification workflow.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Keyboard input strategy

The keyboard covering an input has two fundamentally different fixes depending on the screen's shape. Pick the plugin from the use case, not the other way around.

## 1. Decision framework

| Screen shape | Plugin | Why |
|---|---|---|
| **Form / settings** — multiple `TextField`s inside a `ScrollView`, user tabs between fields | `@nativescript/iqkeyboardmanager` | Zero-code global fix: shifts the view controller's view so the focused field stays visible, adds prev/next arrows + Done toolbar. iOS-only (Android's `adjustResize`/`adjustPan` usually suffices for forms). |
| **Chat / composer / docked search** — one input pinned to the bottom edge with scrolling content above | `@nativescript/input-accessory` | Moves the input bar into the keyboard's `inputAccessoryView` (iMessage-style dock, interactive swipe-to-dismiss, auto-scroll, auto-growing input). Works on iOS **and** Android (`WindowInsetsAnimationCompat`). |

Anti-patterns: IQKeyboardManager on a chat screen shifts the *entire page* (header scrolls off, tab bar fights the transform) and does nothing on Android; input-accessory on a multi-field form is wrong because the accessory dock is built around exactly one `TextView` — forms want field-to-field navigation, not a docked composer.

## 2. Hard rule: a docked composer must own the bottom edge

**Do not use input-accessory on a screen that shows a tab bar.** When the keyboard hides, the docked accessory sits at the bottom of the *screen* — directly on top of the tab bar. There is no styling fix; the screen must be presented **without** the tab bar. In a TabView-shell architecture, route the composer screen at the **root** level (a sibling of the shell route, pushed over the whole shell), not inside a tab's child routes; returning is a plain back — the shell and all tab outlets are restored from the nav stack.

## 3. input-accessory implementation

Required structure — one ScrollView for content, one input container as the last grid row, one `TextView` (**not** `TextField`; auto-grow measurement needs a TextView). Angular shown; the shape is identical in other flavors:

```html
<GridLayout rows="auto, *, auto">
  <Label row="0" text="Header"></Label>
  <ScrollView row="1" (loaded)="loadedScroller($event)">
    <StackLayout (tap)="dismissKeyboard()"><Label text="messages"></Label></StackLayout>
  </ScrollView>
  <!-- container stays TRANSPARENT; the pill inside is the visible surface.
       The send button is a SIBLING of the pill, never a child (see below). -->
  <GridLayout row="2" columns="*, auto" class="px-3 pt-1 pb-2 bg-transparent" (loaded)="loadedComposer($event)">
    <StackLayout col="0" minHeight="36" class="composer-pill rounded-full">
      <TextView minHeight="36" class="mx-4 py-2 bg-transparent border-0"
        (loaded)="loadedInput($event)" (textChange)="onTextChange($event)"></TextView>
    </StackLayout>
    <Button col="1" width="36" height="36" verticalAlignment="center"
      class="ml-2 rounded-full p-0" text="↑" (tap)="send()"></Button>
  </GridLayout>
</GridLayout>
```

```ts
page = inject(Page); // Angular: available via DI on any page-router-outlet component
private accessory: InputAccessoryManager | null = null;

// each (loaded) handler stores its view then calls trySetup();
// guard so setup runs exactly once when all three views exist
private trySetup() {
  if (this.accessory || !this.scrollView || !this.composer || !this.textView) return;
  this.accessory = new InputAccessoryManager();
  this.accessory.setup({ page: this.page, scrollView: this.scrollView,
    inputContainer: this.composer, textView: this.textView });
}
onTextChange(args) { this.accessory?.updateAccessoryHeight(); }
send() { /* dispatch, clear text */ this.accessory?.updateAccessoryHeight(); }
dismissKeyboard() { this.accessory?.dismissKeyboard(); }
ngOnDestroy() { this.accessory?.cleanup(); this.accessory = null; }
```

Do **not** call `dismissSoftInput()` after send — the composer stays docked, iMessage-style.

**Multi-line interaction contract** (matches iMessage/WhatsApp expectations):

* The return key inserts a **line break**, never submits. Do NOT set `returnKeyType="send"` or wire `returnPress` on the TextView — on a TextView the newline still lands in the text while `returnPress` fires, so you get both a submit *and* stray blank lines.
* Only the explicit send button submits; `send()` should `trim()` before dispatching.
* Set `minHeight` (single-line height, e.g. 36) on **both** the TextView and the pill. The plugin clamps only the *accessory container* to `baseHeight` — the pill inside tracks the TextView's natural measure, and an emptied TextView measures near zero, visibly collapsing the pill.
* `setup()` derives `baseHeight` from the container frame only when it is ≤ 50pt; a taller container silently falls back to the default **48** and gets measured at exactly that height, squeezing your pill. Pass real geometry: `baseHeight: pillHeight + containerVerticalPadding` and `containerPadding: containerVerticalPadding`.
* **Never write `UITextView.textContainerInset` natively — set NativeScript CSS padding instead.** Core maps the TextView's CSS padding onto `textContainerInset` and re-applies that mapping on every full style pass (dark/light toggle, trait changes), silently stomping any raw native write — the text drifts off-center only *after* some later style event. To center a single line in a fixed-height pill, compute `(pillHeight - tv.font.lineHeight) / 2` and assign it to `textView.style.paddingTop/Bottom` after `setup()`.

**Send button placement:** keep it a **sibling** of the pill in its own column, with explicit `width`/`height` and `verticalAlignment="center"` (the WhatsApp/Signal shape). Inside a rounded, clipping pill, corner-curve clipping and the plugin-imposed container height conspire to slice or misplace it.

**Plugin-version check:** confirm your installed `@nativescript/input-accessory` handles (a) TextView scrolling once text outgrows `maxHeight` (caret must stay reachable) and (b) restoring the accessory after a fullscreen modal over the page (the accessory only exists while its tracking view holds first responder; UIKit never re-grants it unprompted). If dialogs/sheets are presented over the composer page, see `ns-input-accessory-dialogs`. Swift changes under a plugin's `platforms/ios/src/` require a full `ns run` restart — webpack HMR will not pick them up.

## 4. iqkeyboardmanager (when the form shape wins)

```bash
npm install @nativescript/iqkeyboardmanager
```

Plugin ≥3.0 wraps IQKeyboardManagerSwift 8 delivered as an SPM package via the plugin's own `nativescript.config.ts` (the CLI merges plugin SPMPackages at prepare) — adding it requires a full `ns run` native rebuild, and every manager ships **disabled**:

```ts
// iOS only, at bootstrap (reference the plugin typings in references.d.ts)
const iq = IQKeyboardManager.shared;
iq.isEnabled = true;             // keyboard-avoidance distance handling
iq.resignOnTouchOutside = true;  // tap anywhere outside a field to dismiss
// toolbar (prev/next/Done) is opt-in too: IQKeyboardToolbarManager.shared.isEnabled
```

Old 6.x names (`enable`, `shouldResignOnTouchOutside`) are gone — it's `isEnabled` / `resignOnTouchOutside` now.

**Coexisting with input-accessory:** IQ is global, so a page whose input lives in the keyboard's `inputAccessoryView` must switch it off for its lifetime — `IQKeyboardManager.shared.isEnabled = false` on enter, back to `true` on destroy. Disabling also detaches the touch-resign gesture, so the composer page's own tap-to-dismiss keeps working.

## 5. Verify (simulator)

1. Focus the input → composer docks directly above the keyboard, nothing covered.
2. Keyboard hidden → composer rests at the bottom edge; **no tab bar underneath it**.
3. Type, send → input clears, accessory height resets, stays docked.
4. Navigate away and back → manager re-attaches (proves `cleanup()`/setup guard are right).
5. Simulator gotcha: cursor + AutoFill callout but no keyboard = hardware-keyboard mode. Quit Simulator, set `ConnectHardwareKeyboard = false` both top-level and under `DevicePreferences:<UDID>` in the simulator preferences plist (`com.apple.iphonesimulator.plist` in the user Library's Preferences folder), reopen. Definitive focus check without a visible keyboard: `idb ui text "abc"` with no field tap — characters landing in the field proves programmatic focus.

Verified 2026-08: iOS 26 simulator + Android 15 emulator, @nativescript/core 9.1.0-alpha.11, @nativescript/input-accessory 1.x, @nativescript/iqkeyboardmanager 3.x, in a production chat screen. Some accessory behaviors (scroll-past-cap, post-modal restore) depend on plugin version — verify against yours.
