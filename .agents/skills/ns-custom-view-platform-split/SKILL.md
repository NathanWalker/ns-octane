---
name: ns-custom-view-platform-split
description: Use when building a custom NativeScript view with different native renderers per platform (e.g. SceneKit on iOS, Canvas on Android) — the common/ios/android/d.ts file split, shared gesture + Property handling, and Angular registration.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Custom View with a per-platform renderer

Verified with @nativescript/core 9.0 + Angular 20 (webpack). Pattern:

```
globe-view.common.ts   abstract base: Properties, events, gestures, shared state machine
globe-view.ios.ts      export class GlobeView extends GlobeViewBase { createNativeView(): SCNView ... }
globe-view.android.ts  export class GlobeView extends GlobeViewBase { createNativeView(): android.view.View ... }
globe-view.d.ts        export declare class GlobeView extends GlobeViewBase { ... }   // what `import './globe-view'` resolves to
earth-scene.ios.ts     iOS-only helper; import it as './earth-scene.ios' (explicit suffix so TS resolves it)
```
Webpack picks `.ios.ts`/`.android.ts` for `./globe-view`; TypeScript resolves the `.d.ts`. Both platform files must `export * from './globe-view.common'`.

## Base class essentials
```ts
export const autoRotateProperty = new Property<GlobeViewBase, boolean>({
  name: 'autoRotate', defaultValue: true, valueConverter: booleanConverter,
});
export abstract class GlobeViewBase extends View {
  static readonly globeTapEvent = 'globeTap';
  autoRotate: boolean;
  abstract setData(...): void;
  protected abstract applyCamera(): void;
  protected abstract hitTest(x: number, y: number): ...;

  protected attachGestures() {           // call from initNativeView
    this.on('pan', this.onPan, this);    // string names — GestureTypes enum trips the on/off typings
    this.on('pinch', this.onPinch, this);
    this.on('tap', this.onTap, this);
  }
  protected detachGestures() { this.off('pan', this.onPan, this); /* … */ }
  private onPan(e: PanGestureEventData) {
    // e.deltaX / e.deltaY are CUMULATIVE since gesture start — diff against the last value yourself
    // e.state: GestureStateTypes.began | changed | ended | cancelled
  }
  private onPinch(e: PinchGestureEventData) { /* e.scale cumulative */ }
  private onTap(e: TapGestureEventData) { const hit = this.hitTest(e.getX(), e.getY()); this.notify({ eventName: GlobeViewBase.globeTapEvent, object: this, ...hit }); }
}
autoRotateProperty.register(GlobeViewBase);
```
Width in dip for gesture scaling: `Utils.layout.toDeviceIndependentPixels(this.getMeasuredWidth())`.

## Platform file skeleton
```ts
export class GlobeView extends GlobeViewBase {
  constructor() { super(); this.iosOverflowSafeArea = true; }   // full-bleed under the notch (iOS)
  createNativeView() { /* return the native view */ }
  initNativeView() { super.initNativeView(); /* wire scene / ticker */ this.attachGestures(); }
  disposeNativeView() { /* stop ticker */ this.detachGestures(); super.disposeNativeView(); }
  protected applyCamera() { /* push state to native */ }
}
```

## Angular wiring
```ts
// main.ts
import { registerElement } from '@nativescript/angular';
import { GlobeView } from './app/globe/globe-view';
registerElement('Globe', () => GlobeView);
```
```html
<Globe row="0" autoRotate="false" (loaded)="onGlobeLoaded($event)"></Globe>
```
Component needs `schemas: [NO_ERRORS_SCHEMA]`. Grab the instance in `(loaded)`: `this.globe = args.object as GlobeView`, then subscribe: `this.globe.on('globeTap', …)`.

## Overlays over a full-bleed view
Parent `GridLayout rows="*" iosOverflowSafeArea="true"`; the custom view fills row 0; overlay layouts in the same row use `iosOverflowSafeArea="false"` so they stay inside the status-bar/home-indicator safe area.

## Platform-specific UI around the view
A native `SegmentedBar` looks right on iOS; on Android prefer a custom animated pill tab bar (recipe in `ns-angular-zoneless-native-choreography`). Bind `(layoutChanged)` on real layout views, not Angular host elements (Android never fires it there).

## Android traps (see `ns-android-java-interop-gotchas`)
Declare `@NativeClass` subclasses at module scope (never inside `createNativeView`), pass typed Java arrays for overloaded constructors, plain `number[]` (not typed arrays) for `float[]` params.

## Known noise
Webpack warns "…globe-view.android.ts is part of the TypeScript compilation but it's unused" during an iOS build (tsconfig `include` lists both suffixes). Harmless.
