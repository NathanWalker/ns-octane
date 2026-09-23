import { isIOS, type ScrollView, type View } from "@nativescript/core";

// UIRectEdge values; the enum is declared in a typings file this project does
// not reference.
const EDGE_TOP = 1;
const EDGE_BOTTOM = 4;

/**
 * Whether the OS draws scroll-edge effects (iOS 26+): a progressive blur and
 * wash over content that scrolls under a bar, keyed to the bar's frame. Where
 * it does, the chat screen leaves both edges to UIKit; elsewhere it paints
 * gradient layers itself.
 */
export function hasNativeScrollEdges(): boolean {
  return isIOS && typeof UIScrollEdgeElementContainerInteraction !== "undefined";
}

/**
 * Soft effects on both edges. The default `automatic` style resolves per
 * context and is not guaranteed to be the blurred kind.
 */
export function setSoftScrollEdges(scrollView: ScrollView): void {
  if (!hasNativeScrollEdges()) return;
  const native = scrollView.ios as UIScrollView | undefined;
  if (!native) return;
  native.topEdgeEffect.style = UIScrollEdgeEffectStyle.softStyle;
  native.bottomEdgeEffect.style = UIScrollEdgeEffectStyle.softStyle;
}

/**
 * Make `scrollView` treat `container` as a bar at `edge`: UIKit extends the
 * edge effect over the container's frame and keeps it there as either view
 * moves. The container may live in another window, which is how the accessory
 * plugin registers the docked composer. Returns a disposer.
 */
export function attachScrollEdgeContainer(
  scrollView: ScrollView,
  container: View,
  edge: "top" | "bottom",
): () => void {
  if (!hasNativeScrollEdges()) return () => {};
  const native = scrollView.ios as UIScrollView | undefined;
  const bar = container.ios as UIView | undefined;
  if (!native || !bar) return () => {};
  const interaction = UIScrollEdgeElementContainerInteraction.new();
  interaction.scrollView = native;
  interaction.edge = edge === "top" ? EDGE_TOP : EDGE_BOTTOM;
  bar.addInteraction(interaction);
  return () => bar.removeInteraction(interaction);
}
