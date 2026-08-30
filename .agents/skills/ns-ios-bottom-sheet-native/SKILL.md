---
name: ns-ios-bottom-sheet-native
description: Use when a NativeScript app wants a real iOS bottom sheet (UISheetPresentationController detents, grabber, iOS 26 system glass) instead of a hand-rolled panel — includes the Angular NativeDialogService recipe and when NOT to use it.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Native iOS bottom sheet (UISheetPresentationController)

Source: https://nstudio.io/blog/ios-bottom-sheet-glass (Nathan Walker, March 2026).
The blog recipe (medium/large detents, grabber, transparent background on iOS 26 so
system glass shows) is the verified part. The additions marked *untested* below were
written but not exercised end-to-end.

## Open (Angular, NativeDialogService)
```ts
this.dialog.open(SheetComponent, {
  disableClose: true,        // → cancelable:false → swipe-to-dismiss blocked
  hasBackdrop: false,
  nativeOptions: {
    fullscreen: __ANDROID__,   // Android has no sheet controller; consider an in-page panel instead
    ios: { presentationStyle: UIModalPresentationStyle.PageSheet },
  },
});
```
Core (`page.showModal('~/sheet', { fullscreen: __ANDROID__, ios: { presentationStyle: UIModalPresentationStyle.PageSheet } })`) works the same; configure in the modal's `loaded`.

## Configure the presented controller (in the sheet component)
```ts
onLoaded(args: EventData) { const view = args.object as View; setTimeout(() => this.configure(view), 0); }

private configure(view: View) {
  if (!__IOS__) return;
  const nativeModalRef = (this.dialogRef as any)?._nativeModalRef;
  const modalView = nativeModalRef?.modalViewRef?.firstNativeLikeView as View | undefined;
  const vc: UIViewController = modalView?.viewController || view.viewController || view.page?.ios;
  vc.modalPresentationStyle = UIModalPresentationStyle.PageSheet;
  const sheet = vc.sheetPresentationController || vc.parentViewController?.sheetPresentationController;
  if (!sheet) return;

  sheet.detents = Utils.ios.collections.jsArrayToNSArray([
    UISheetPresentationControllerDetent.customDetentWithIdentifierResolver('peek', () => 250), // untested (iOS 16+)
    UISheetPresentationControllerDetent.mediumDetent(),
    UISheetPresentationControllerDetent.largeDetent(),
  ]);
  sheet.selectedDetentIdentifier = 'peek';                                                       // untested
  sheet.largestUndimmedDetentIdentifier = UISheetPresentationControllerDetentIdentifierMedium;   // untested: view behind stays interactive at ≤ medium
  vc.modalInPresentation = true;                                                                  // untested: never dismissable
  sheet.prefersGrabberVisible = true;
  sheet.prefersScrollingExpandsWhenScrolledToEdge = true;
  sheet.preferredCornerRadius = 24;

  if (Utils.SDK_VERSION >= 26) {                 // let Liquid Glass show through
    const page = modalView?.page || view.page;
    if (page) page.backgroundColor = new Color('transparent');
    if (vc.view) vc.view.backgroundColor = UIColor.clearColor;
  }
}
```
Template root: transparent container (`bg-transparent`), translucent cards inside (`bg-white/80` or dark equivalents).

## Trade-off: sheet vs. in-page glass panel
A system sheet gives you free detents, grabber physics and Liquid Glass. It cannot join
page-level choreography: e.g. dimming the panel while the user drags a globe/map behind
it, or animating it in as part of an intro. If that interplay is the point of the screen,
build an in-page panel with `ns-liquid-glass-panel` (real `UIGlassEffect` on iOS 26) plus a
native `SegmentedBar`, and cap its body height with a `ScrollView`. Use the sheet when the
content is a separate task (details, forms, pickers).

## Troubleshooting (from the blog)
* Opens as a classic modal → check `ios.presentationStyle` and that you configured the *presented* controller.
* `sheetPresentationController` null → configure after the view is loaded (`setTimeout(..., 0)`).
* Not transparent on iOS 26 → both the NS Page background and `vc.view.backgroundColor` must be clear.
