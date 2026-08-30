---
name: ns-animated-panel-height
description: Use when a NativeScript panel/sheet/card must smoothly grow or shrink as its content changes (mode switches, expanding lists) on both iOS and Android — measure the body explicitly and animate the container height, avoiding the Android layoutChanged/ScrollView traps.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Animating a panel's height to fit new content

Verified frame-by-frame (video) on iOS 26.5 simulator and Android API 35 emulator, @nativescript/core 9.0, Angular 20 zoneless.

## Structure
```html
<GridLayout rows="auto" verticalAlignment="bottom" class="panel">
  <Glass row="0" glassRadius="28"></Glass>                                    <!-- backdrop under -->
  <ScrollView row="0" scrollBarIndicatorVisible="false" (loaded)="onScrollLoaded($event)">
    <ns-panel (bodyLoaded)="onBodyLoaded($event)" (bodyLayout)="fit()"></ns-panel>
  </ScrollView>
</GridLayout>
```
Inside `ns-panel`, bind `(loaded)`/`(layoutChanged)` on the component's **root StackLayout** and
re-emit them as Angular `output()`s (`bodyLoaded`, `bodyLayout`). Binding `(layoutChanged)` on the
component host element (`<ns-panel (layoutChanged)>`) fires on iOS but **not on Android**.

## The height fit
```ts
private scroll: View | null = null; private body: View | null = null; private lastTarget = -1;

constructor() {
  // re-fit whenever the content signal changes; setTimeout(0) lets zoneless Angular render the new content first
  effect(() => { this.store.mode(); setTimeout(() => this.fit(), 0); });
}
onScrollLoaded(a: EventData) { this.scroll = a.object as View; }
onBodyLoaded(a: EventData) { this.body = a.object as View; this.fit(); }

fit(): void {
  const scroll = this.scroll, body = this.body;
  if (!scroll || !body || !scroll.getMeasuredWidth()) return;
  // Measure the body's NATURAL height explicitly — do not trust layout events (see pitfalls)
  body.measure(
    Utils.layout.makeMeasureSpec(scroll.getMeasuredWidth(), Utils.layout.EXACTLY),
    Utils.layout.makeMeasureSpec(0, Utils.layout.UNSPECIFIED),
  );
  const naturalDip = body.getMeasuredHeight() / Screen.mainScreen.scale;
  const target = Math.min(naturalDip, Screen.mainScreen.heightDIPs * 0.5);   // cap: half the screen, then it scrolls
  if (Math.abs(target - this.lastTarget) < 1) return;                          // skip no-op animations
  const first = this.lastTarget < 0;
  this.lastTarget = target;
  if (first) scroll.height = target;                                            // no animation on first layout
  else void scroll.animate({ height: target, duration: 340, curve: 'easeInOut' });   // width/height animate on BOTH platforms
}
```
`view.animate({ height })` is implemented by core on both platforms (Android: ValueAnimator updating `style.height`; iOS: layout animation).

## Pitfalls (Android)
* NS raises `layoutChanged` only when a view's bounds actually change (`_raiseLayoutChangedEvent` compares left/top/right/bottom), and the native `org.nativescript.widgets.VerticalScrollView` lays its child out **at least as tall as itself**. So a body that shrinks inside a ScrollView never reports a smaller layout: expansion works, shrinking never fires. Hence the explicit `measure()` above.
* `(layoutChanged)` on an Angular component host doesn't fire on Android — bind it on a real layout view.
* Keep `lastTarget` so reflows caused by the animation itself don't re-trigger it.

## Companion patterns
* Glass backdrop: `ns-liquid-glass-panel`. Dim the whole panel during interactions with `panel.animate({ opacity })`.
* Verify with frame-by-frame recordings: `ns-ios-simulator-automation`.
