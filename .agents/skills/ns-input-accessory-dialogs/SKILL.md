---
name: ns-input-accessory-dialogs
description: Use when a @nativescript/input-accessory docked composer bar floats ON TOP of a page sheet, alert, or popover on iOS, fails to reappear after a modal, or reappears on its own — the bar lives in the keyboard's own window (UITextEffectsWindow), which UIKit z-orders above sheet presentations, so it must be suspended on dialog open and restored on close.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# input-accessory vs dialogs: suspend/restore around sheet presentations

A `@nativescript/input-accessory` composer bar is not part of the page's view hierarchy — the plugin reparents it into an `inputAccessoryView` hosted in the **keyboard's own window** (`UITextEffectsWindow`), kept on screen by holding first responder. UIKit z-orders that window **above sheet-style presentations** (`PageSheet`, `FormSheet`, popovers, alerts). So when a dialog opens over the page, the composer floats on top of it.

## 1. Why the two modal styles behave differently

| Presentation | What happens to the bar | What you must do |
|---|---|---|
| **Fullscreen modal** | Presenting view leaves the window → first responder resigns → bar disappears by itself. But UIKit never restores first responder, so it stays gone after dismiss. | `restore()` after dismiss only. |
| **Sheet / popover / alert** | Presenting view **stays in the window** → first responder is kept → bar stays visible, floating **above** the sheet. | `suspend()` on open **and** `restore()` on close. |

The plugin's own recovery hooks (`didMoveToWindow`) only fire for the fullscreen case. Sheets need the explicit pair.

## 2. Why naive fixes fail

* **`resignFirstResponder()` from app code**: the plugin's auto-restore (`textDidEndEditing` → re-`becomeFirstResponder`) exists so tapping away doesn't kill the bar — it will instantly bring the bar back. You cannot win this race from the JS side.
* **Hiding the NativeScript container view** (`visibility`, `opacity`): the view was reparented into the accessory container; collapsing it breaks the plugin's measure/layout cycle and leaves a blank blur bar docked anyway.
* **Dismissing the keyboard first**: `dismissKeyboard()` deliberately keeps the accessory-only state (that's its point) — the bar remains.

The only correct mechanism is a **native suspended gate inside the plugin's keyboard-tracking view**: set it, then resign first responder (the bar — and keyboard, if open — slides away with the standard UIKit animation). Every auto-restore path (`textDidEndEditing`, `didMoveToWindow`, the restore poll loop, setup's delayed `becomeFirstResponder`) must check the gate. `restore()` clears the gate and re-claims first responder — polling until `rootViewController.presentedViewController == nil`, so it is safe to call the moment the dialog starts closing.

## 3. Getting `suspend()`

Check the installed plugin first: if `InputAccessoryManager.suspend()` exists, use it. If your version predates it, patch the plugin (patch-package). The patch shape:

* `platforms/ios/src/KeyboardTrackingView.swift`: a `private var isSuspended = false`; a public `suspendAccessory()` that guards not-cleaning-up/already-suspended, sets the flag, stops interactive tracking, resigns the hosted text input then `self`; `!isSuspended` added to the guards in `restoreAccessoryFirstResponderIfNeeded`, `didMoveToWindow`, `restoreAccessoryWhenReady`, and setup's delayed `becomeFirstResponder`; `restoreAccessory()` clears the flag before polling.
* `index.ios.js` / typings: `suspend()` → `keyboardTrackingView?.suspendAccessory()`.
* `index.android.js`: no-op `suspend()` for API parity — Android dialogs are separate windows drawn above the activity; they already cover the bar.

After editing node_modules, regenerate with `npx patch-package @nativescript/input-accessory` (needs a `postinstall: patch-package` script), and remember Swift changes need a full `ns run` restart.

## 4. Wiring pattern

Route it through whatever central service presents dialogs, so *every* future dialog behaves — don't sprinkle suspend/restore at call sites. Angular example with a signal:

```ts
// dialog.service.ts
readonly sheetOpen = signal(false);

openSheet(cmp, config?) {
  return new Promise((resolve) => {
    if (this.sheetOpen()) return;
    this.sheetOpen.set(true);
    const ref = this.nativeDialog.open(cmp, { nativeOptions: { transition: { name: 'pageSheet' } } });
    ref.afterClosed().subscribe((data) => {
      this.sheetOpen.set(false);   // fires as dismissal begins — restore() polls, so this is safe
      resolve(data);
    });
  });
}
```

```ts
// page owning the composer
effect(() => {
  const sheetOpen = this.dialogs.sheetOpen();
  if (!this.accessory) return;           // accessory builds after view load
  if (sheetOpen) this.accessory.suspend();
  else this.accessory.restore();
});
```

Notes:

* Suspend as the sheet **starts** opening — the bar's slide-down runs concurrently with the sheet's slide-up, which reads as one native gesture.
* `restore()`/`suspend()` are idempotent; calling `restore()` when never suspended is harmless (it won't steal first responder from a legitimate holder).
* A global open-state flag is fine: only pages that own an accessory react, and a page popped from the stack destroys its effect — no cross-page leakage.
* For the composer implementation itself see `ns-keyboard-input`.

## 5. Verify

1. On the composer page with the **keyboard closed**, trigger the dialog: the bar must slide down as the sheet slides up; nothing overlaps the sheet.
2. Close the dialog (button **and** swipe-down-dismiss): the bar must slide back up on its own — including after the swipe, where no button code ran.
3. Repeat with the **keyboard open**: keyboard + bar leave together; after close, the bar returns in accessory-only state (keyboard stays closed).
4. Regression: fullscreen modals over the page must still restore the bar, and tapping in/out of the input must still keep the bar docked.

Verified 2026-08: iOS 26 simulator, @nativescript/core 9.1.0-alpha.11, @nativescript/input-accessory 1.0.3 with the suspend/restore patch, in a production chat screen. Android path is a design no-op (dialogs cover the bar natively) — verified by inspection only.
