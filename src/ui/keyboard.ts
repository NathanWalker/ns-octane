import type { View } from "@nativescript/core";

/**
 * Move `view` vertically in step with the keyboard transition described by a
 * `UIKeyboardWillChangeFrame` notification's `userInfo`.
 *
 * The keyboard animates with a private UIView curve that has no public
 * CAMediaTimingFunction, so `view.animate()` cannot match it; the curve is
 * only reachable as a UIView animation option. NativeScript's transform setter
 * disables implicit layer actions, so the property is set first (keeping the
 * view's own state current) and the layer is then animated from its previous
 * transform inside the UIKit block.
 *
 * iOS posts several frame notifications per keyboard transition, and UIView
 * transform animations are additive while one is in flight: a second block
 * would stack its delta on the first and overshoot by a keyboard height. A
 * repeat of the current target is left to the running animation, and a new
 * target clears the layer's animations before starting its own.
 */
/**
 * Structural on purpose: core's view classes carry symbol-keyed native setters
 * whose types differ per subclass, so a `StackLayout` is not assignable to
 * `View` under strict function types.
 */
type SlidingView = Pick<View, "ios" | "translateY">;

export function slideWithKeyboard(view: SlidingView, translateY: number, userInfo: NSDictionary<string, unknown>): void {
  const nativeView = view.ios as UIView | undefined;
  if (!nativeView) {
    view.translateY = translateY;
    return;
  }
  if (view.translateY === translateY) return;

  const layer = nativeView.layer;
  const from = layer.presentationLayer()?.transform ?? layer.transform;
  // The notification can be delivered inside UIKit's own animation context;
  // the model writes must not pick that up, or they animate on their own.
  CATransaction.begin();
  CATransaction.setDisableActions(true);
  layer.removeAllAnimations();
  view.translateY = translateY;
  const to = layer.transform;
  layer.transform = from;
  CATransaction.commit();
  if (CATransform3DEqualToTransform(from, to)) return;

  const duration = keyboardNumber(userInfo, UIKeyboardAnimationDurationUserInfoKey, 0.25);
  const curve = keyboardNumber(userInfo, UIKeyboardAnimationCurveUserInfoKey, 7);
  const options =
    (curve << 16) |
    UIViewAnimationOptions.BeginFromCurrentState |
    UIViewAnimationOptions.OverrideInheritedDuration |
    UIViewAnimationOptions.OverrideInheritedCurve;
  UIView.animateWithDurationDelayOptionsAnimationsCompletion(
    duration,
    0,
    options as UIViewAnimationOptions,
    () => {
      layer.transform = to;
    },
    null,
  );
}

/** The runtime hands `NSNumber` userInfo values over as plain JS numbers. */
function keyboardNumber(userInfo: NSDictionary<string, unknown>, key: string, fallback: number): number {
  const value = userInfo.objectForKey(key) as unknown;
  if (typeof value === "number") return value;
  const boxed = value as { doubleValue?: number } | null;
  return typeof boxed?.doubleValue === "number" ? boxed.doubleValue : fallback;
}
