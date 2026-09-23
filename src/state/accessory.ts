import type { InputAccessoryManager } from "@nativescript/input-accessory";
import { isIOS } from "@nativescript/core";
import { safeAreaInsets } from "../ui/safe-area";
import { hasNativeScrollEdges } from "../ui/scroll-edge";

export const COMPOSER_PILL_HEIGHT = 52;
/** `.composer-pill`'s border, inside the pill height. */
export const COMPOSER_PILL_BORDER = 1;
/** `.composer-row`'s vertical padding: 12 top + 8 bottom. */
export const COMPOSER_ROW_PADDING = 20;
/**
 * Set on the TextView as a property rather than in CSS: the composer sizes its
 * text insets from the font at load time, and a CSS font lands after that.
 */
export const COMPOSER_FONT_SIZE = 17;

/**
 * Height of the docked composer bar while the keyboard is hidden, as the
 * accessory plugin sizes it: the row plus the home-indicator padding the plugin
 * adds beneath it (the window's bottom safe-area inset less 20).
 */
export function dockedComposerHeight(): number {
  return COMPOSER_PILL_HEIGHT + COMPOSER_ROW_PADDING + Math.max(0, safeAreaInsets().bottom - 20);
}

/**
 * The composer's accessory manager, for callers outside the composer. The bar
 * lives in the keyboard's own window on iOS, which UIKit z-orders above both
 * in-app overlays and sheets — anything covering the page (drawer, settings
 * sheet, share sheet) must suspend() it while open and restore() after.
 *
 * Kept in `import.meta.hot.data` so a hot re-evaluation of this module hands
 * importers the same registry the mounted composer filled in.
 */
export const accessory: { current: InputAccessoryManager | null } =
  import.meta.hot?.data.accessory ?? { current: null };
if (import.meta.hot) import.meta.hot.data.accessory = accessory;

export function dismissKeyboard(): void {
  accessory.current?.dismissKeyboard();
}

export function suspendComposer(): void {
  accessory.current?.suspend();
}

export function restoreComposer(): void {
  accessory.current?.restore();
}

/** The composer's own native view, as the accessory plugin docked it. */
function composerContent(): UIView | null {
  if (!isIOS) return null;
  const manager = accessory.current as (InputAccessoryManager & { inputContainerView?: UIView }) | null;
  return manager?.inputContainerView ?? null;
}

/** The native container the accessory plugin docks the composer into, once set up. */
function accessoryContainer(): UIView | null {
  return composerContent()?.superview ?? null;
}

const BACKDROP_TAG = 0x0c7a9e1f;

/**
 * Before iOS 26 the plugin docks the composer in a keyboard-style UIInputView,
 * which draws the system keyboard's material across the bar's full width; over
 * dark content that is a gray band with a hard top edge, and nothing in the
 * page can cover it, since the bar's window sits above the page's. An opaque
 * view between the material and the composer hides it. The colors are the
 * bottom stops of `.screen-canvas`; `.bottom-fade` runs content into the same
 * value just above the bar. On iOS 26+ the container is transparent and the
 * scroll view's edge effect is the bar's background, so nothing is added. Safe
 * to call again: a container that already carries the backdrop is left alone.
 */
export function installComposerBackdrop(): void {
  if (hasNativeScrollEdges()) return;
  const content = composerContent();
  const container = content?.superview;
  if (!content || !container || container.viewWithTag(BACKDROP_TAG)) return;
  const backdrop = UIView.alloc().initWithFrame(container.bounds);
  backdrop.tag = BACKDROP_TAG;
  backdrop.userInteractionEnabled = false;
  backdrop.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;
  backdrop.backgroundColor = UIColor.colorWithDynamicProvider((traits: UITraitCollection) =>
    traits.userInterfaceStyle === UIUserInterfaceStyle.Dark
      ? UIColor.colorWithRedGreenBlueAlpha(28 / 255, 28 / 255, 29 / 255, 1)
      : UIColor.colorWithRedGreenBlueAlpha(244 / 255, 244 / 255, 245 / 255, 1),
  );
  container.insertSubviewBelowSubview(backdrop, content);
}

/**
 * Slide the docked bar sideways by `x`, the horizontal offset of the page it
 * belongs to. The bar lives in the keyboard's window, so a page that is pushed
 * aside (the drawer) has to carry it along explicitly.
 */
export function translateComposer(x: number, animationDuration = 0): void {
  const container = accessoryContainer();
  if (!container) return;
  const transform = CGAffineTransformMakeTranslation(x, 0);
  if (animationDuration <= 0) {
    container.transform = transform;
    return;
  }
  UIView.animateWithDurationDelayOptionsAnimationsCompletion(
    animationDuration / 1000,
    0,
    UIViewAnimationOptions.CurveEaseInOut | UIViewAnimationOptions.BeginFromCurrentState,
    () => {
      container.transform = transform;
    },
    null,
  );
}

/**
 * Mark the bar as riding on a pushed-aside page: its bottom corners take the
 * page's radius (a mask that stays open at the top so the pill's shadow is not
 * clipped) and it stops taking touches, like the rest of the page under the
 * drawer's backdrop. Radius 0 restores the resting state.
 */
export function setComposerPushed(cornerRadius: number): void {
  const container = accessoryContainer();
  if (!container) return;
  container.userInteractionEnabled = cornerRadius === 0;
  if (cornerRadius === 0) {
    container.layer.mask = null;
    return;
  }
  const bounds = container.bounds;
  const reach = 200;
  const mask = CAShapeLayer.new();
  mask.frame = CGRectMake(0, -reach, bounds.size.width, bounds.size.height + reach);
  mask.path = UIBezierPath.bezierPathWithRoundedRectByRoundingCornersCornerRadii(
    CGRectMake(0, 0, bounds.size.width, bounds.size.height + reach),
    UIRectCorner.BottomLeft | UIRectCorner.BottomRight,
    CGSizeMake(cornerRadius, cornerRadius),
  ).CGPath;
  container.layer.mask = mask;
}
