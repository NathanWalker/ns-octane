---
name: ns-ios-cadisplaylink-render-loop
description: Use when NativeScript iOS code needs a 60fps JS tick (custom animation loops, SceneKit/Canvas frame updates, physics) — a CADisplayLink target class that actually fires under the NativeScript runtime.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# CADisplayLink from NativeScript (iOS)

Verified on iOS 26.5 / @nativescript/core 9.0.

```ts
@NativeClass()
class TickTarget extends NSObject {
  static ObjCExposedMethods = {
    tick: { returns: interop.types.void, params: [CADisplayLink] },
  };
  owner: WeakRef<MyView> | null = null;

  static initWithOwner(owner: MyView): TickTarget {
    const t = TickTarget.new() as TickTarget;
    t.owner = new WeakRef(owner);
    return t;
  }
  tick(link: CADisplayLink): void {
    this.owner?.deref()?.onFrame(link);
  }
}

// in initNativeView():
this.target = TickTarget.initWithOwner(this);
this.link = CADisplayLink.displayLinkWithTargetSelector(this.target, 'tick');
this.link.addToRunLoopForMode(NSRunLoop.mainRunLoop, NSDefaultRunLoopMode);
this.link.addToRunLoopForMode(NSRunLoop.mainRunLoop, UITrackingRunLoopMode); // keeps ticking during scrolls

onFrame(link: CADisplayLink) {
  const dt = this.last ? Math.min(0.05, link.timestamp - this.last) : 1 / 60;  // seconds; clamp after pauses
  this.last = link.timestamp;
  // ... advance state, push into native views
}

// in disposeNativeView():
this.link?.invalidate(); this.link = null; this.target = null;
```

## Pitfalls we hit
* **`NSRunLoopCommonModes` alone never fired** — the link was "armed" (`paused === false`) but `tick` was never called. Register `NSDefaultRunLoopMode` and `UITrackingRunLoopMode` explicitly (this is also what `@nativescript/core` does internally in `fps-meter` / `application.ios`).
* The `NSObject.extend({ tick() {} }, { exposedMethods: {...} })` form also did not fire for us; the `@NativeClass()` class with `static ObjCExposedMethods` did.
* Selector string is the JS method name (`'tick'`), no colon, even though the method takes the link parameter.
* Keep strong references to both the link and the target on your view; hold the view via `WeakRef` from the target to avoid cycles.
* Per-frame JS → native calls (setting `SCNNode.eulerAngles`, `position` on a handful of nodes) are cheap; avoid allocating per frame.
* `Application.on('suspend'/'resume')` — pause/resume the link (`link.paused = true`) if the loop does heavy work.
