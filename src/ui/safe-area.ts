import { Utils, isIOS } from "@nativescript/core";

/** Window safe-area insets in DIPs (status bar / home indicator / gesture nav). */
export function safeAreaInsets(): { top: number; bottom: number } {
  if (isIOS) {
    const app = UIApplication.sharedApplication;
    const window = app.keyWindow ?? app.windows.firstObject;
    if (window) {
      const insets = window.safeAreaInsets;
      return { top: insets.top, bottom: insets.bottom };
    }
    return { top: 59, bottom: 34 };
  }
  const activity = Utils.android.getCurrentActivity();
  if (!activity) return { top: 24, bottom: 0 };
  const bars = android.view.WindowInsets.Type.statusBars() | android.view.WindowInsets.Type.navigationBars();
  // WindowMetrics is synchronous and needs no attached window, so it is right
  // during the first render on a cold start; root window insets are null then.
  if (android.os.Build.VERSION.SDK_INT >= 30) {
    const insets = activity.getWindowManager().getCurrentWindowMetrics().getWindowInsets().getInsets(bars);
    return {
      top: Utils.layout.toDeviceIndependentPixels(insets.top),
      bottom: Utils.layout.toDeviceIndependentPixels(insets.bottom),
    };
  }
  const insets = activity.getWindow()?.getDecorView()?.getRootWindowInsets();
  if (!insets) return { top: 24, bottom: 0 };
  return {
    top: Utils.layout.toDeviceIndependentPixels(insets.getSystemWindowInsetTop()),
    bottom: Utils.layout.toDeviceIndependentPixels(insets.getSystemWindowInsetBottom()),
  };
}
