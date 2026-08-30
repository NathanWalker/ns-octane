---
name: ns-liquid-glass-panel
description: Use when a NativeScript screen needs a frosted/glass panel or card over rich content (maps, 3D, video) — a small GlassView using UIGlassEffect on iOS 26+ (Liquid Glass), UIBlurEffect earlier, and a translucent drawable on Android.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Glass panels in NativeScript

Verified on iOS 26.5 simulator (@nativescript/core 9.0). Native `UIVisualEffectView` wrapped as a plain NS `View`, layered under content. Verified detail: with `UIGlassEffectStyle.Regular` over dark content the panel rendered light grey and white type was unreadable until `glass.tintColor = UIColor.colorWithRedGreenBlueAlpha(0.03, 0.05, 0.11, 0.62)` — after that it reads as dark frosted glass with the lensing intact, and a native `SegmentedBar` sits on it as-is.

```ts
import { Property, Utils, View, isIOS } from '@nativescript/core';

export const glassRadiusProperty = new Property<GlassView, number>({
  name: 'glassRadius', defaultValue: 0, valueConverter: (v) => parseFloat(v),
});

export class GlassView extends View {
  glassRadius: number;

  createNativeView(): any {
    if (isIOS) {
      let effect: UIVisualEffect;
      if (Utils.SDK_VERSION >= 26) {
        const glass = UIGlassEffect.effectWithStyle(UIGlassEffectStyle.Regular);  // .Clear = more transparent
        // Regular glass over dark content renders LIGHT; a deep tint keeps white type readable but keeps the lensing.
        glass.tintColor = UIColor.colorWithRedGreenBlueAlpha(0.03, 0.05, 0.11, 0.62);
        effect = glass;
      } else {
        effect = UIBlurEffect.effectWithStyle(UIBlurEffectStyle.SystemThinMaterialDark);
      }
      const view = UIVisualEffectView.alloc().initWithEffect(effect);
      view.clipsToBounds = true;
      return view;
    }
    const view = new android.view.View(this._context);
    view.setBackground(this.androidBackground(0));
    return view;
  }

  [glassRadiusProperty.setNative](radius: number) {
    const native = this.nativeViewProtected;
    if (!native) return;
    if (isIOS) {
      const v = native as UIVisualEffectView;
      if (Utils.SDK_VERSION >= 26) {
        v.cornerConfiguration = UICornerConfiguration.configurationWithUniformRadius(UICornerRadius.fixedRadius(radius));
      } else {
        v.layer.cornerRadius = radius;
      }
    } else {
      (native as android.view.View).setBackground(this.androidBackground(radius));
    }
  }

  private androidBackground(radius: number) {
    const bg = new android.graphics.drawable.GradientDrawable();
    bg.setColor(android.graphics.Color.parseColor('#C40A0F1E'));
    bg.setCornerRadius(Utils.layout.toDevicePixels(radius));
    bg.setStroke(Utils.layout.toDevicePixels(1), android.graphics.Color.parseColor('#26FFFFFF'));
    return bg;
  }
}
glassRadiusProperty.register(GlassView);
```
Angular: `registerElement('Glass', () => GlassView)`.

## Layering (the part that bites)
```html
<GridLayout rows="auto" verticalAlignment="bottom" class="panel">
  <Glass row="0" glassRadius="28"></Glass>
  <StackLayout row="0" class="p-4"> ...content... </StackLayout>
</GridLayout>
```
* `rows="auto"` is essential: with the implicit `*` row a bare `View` child (the glass) stretches and the "panel" silently becomes full-screen, covering everything above it.
* Put the glass first so it paints under the content in the same cell.
* iOS 26 uses `cornerConfiguration` (proper glass lensing at corners); pre-26 uses `layer.cornerRadius` + `clipsToBounds`. Setting NS `border-radius` on the glass element also works but is less crisp for glass.
* Animate the whole panel `GridLayout` (`view.animate({ opacity: 0.3, duration: 180 })`) to dim it while the user manipulates the content underneath — a system sheet cannot do this (see `ns-ios-bottom-sheet-native`).
* Cap a scrolling panel body at half the screen (NS has no `max-height`): `<ScrollView (loaded)=…><Content (layoutChanged)="onLayout($event)"/></ScrollView>` and
  ```ts
  const dip = (a.object as View).getMeasuredHeight() / Screen.mainScreen.scale;
  const target = Math.min(dip, Screen.mainScreen.heightDIPs * 0.5);
  if (Math.abs((scroll.height as number) - target) > 1) scroll.height = target;
  ```
* Android has no backdrop blur primitive for arbitrary views; a translucent dark fill with a hairline stroke reads as "glass" against dark content. `RenderEffect.createBlurEffect` blurs the view itself, not what is behind it.
