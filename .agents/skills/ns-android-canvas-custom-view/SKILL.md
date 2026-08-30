---
name: ns-android-canvas-custom-view
description: Use when a NativeScript Android view needs custom 2D drawing at 60fps (charts, globes, particle backdrops) — subclass android.view.View from TypeScript, override onDraw, tick with Choreographer, and avoid the marshalling/perf traps that bite on first try.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Custom-drawn Android view from TypeScript

Verified on a Pixel 6a API 35 emulator (SwiftShader) with @nativescript/core 9.0.
Marshalling rules referenced here are collected in `ns-android-java-interop-gotchas`.

Three rules the runtime enforces (each one is a crash, not a warning):
1. `@NativeClass()` subclass at **module scope**, `return global.__native(this)` in its constructor, owner via `WeakRef`.
2. Everything you hand to `Canvas`/`Paint` is a **plain `number[]`** — declare the fields as `number[]` (`private readonly xy: number[] = []`), never `Float32Array`/`Int32Array`, not even as the backing store you copy from.
3. Gradient colours/stops (`RadialGradient`, `LinearGradient`) are **typed Java arrays** from `Array.create('int' | 'float', n)`.

```ts
import { Utils, View } from '@nativescript/core';

/**
 * Declare @NativeClass classes at MODULE scope. A @NativeClass declared inside another
 * class's method makes @nativescript/webpack's NativeClass transformer (text fallback
 * `/^\s*@NativeClass\b/m`) downlevel the OUTER class to ES5 → runtime
 * "Class constructor View cannot be invoked without 'new'".
 */
@NativeClass()
class DotsSurface extends android.view.View {
  owner: WeakRef<DotsView> | null = null;          // set after construction; no closures over the owner
  constructor(context: android.content.Context) {
    super(context);
    return global.__native(this);                   // required when extending Android classes
  }
  onDraw(canvas: android.graphics.Canvas): void {
    super.onDraw(canvas);
    this.owner?.deref()?.paintFrame(canvas, this.getWidth(), this.getHeight());
  }
}

export class DotsView extends View {
  private surface: DotsSurface | null = null;
  private frameCallback: android.view.Choreographer.FrameCallback | null = null;
  private lastNanos = 0;
  private readonly paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
  private readonly xy: number[] = [];               // plain number[] → marshals to float[]; a Float32Array here would fail at drawPoints
  private readonly px: number[] = []; private readonly py: number[] = [];   // positions too — keep the whole pipeline number[]

  createNativeView(): android.view.View {
    const v = new DotsSurface(this._context);
    v.owner = new WeakRef(this);
    v.setBackgroundColor(android.graphics.Color.BLACK);
    return v;
  }

  initNativeView() {
    super.initNativeView();
    this.surface = this.nativeViewProtected as DotsSurface;
    const ch = android.view.Choreographer.getInstance();
    this.frameCallback = new android.view.Choreographer.FrameCallback({
      doFrame: (nanos: number) => {
        if (!this.frameCallback) return;
        const dt = this.lastNanos ? Math.min(0.05, (nanos - this.lastNanos) / 1e9) : 1 / 60;
        this.lastNanos = nanos;
        this.step(dt);                              // advance state …
        this.surface?.postInvalidateOnAnimation();  // … then schedule onDraw
        ch.postFrameCallback(this.frameCallback);   // re-arm every frame
      },
    });
    ch.postFrameCallback(this.frameCallback);
  }

  disposeNativeView() {
    if (this.frameCallback) android.view.Choreographer.getInstance().removeFrameCallback(this.frameCallback);
    this.frameCallback = null; this.surface = null;
    super.disposeNativeView();
  }

  paintFrame(canvas: android.graphics.Canvas, w: number, h: number) {
    const density = Utils.layout.getDisplayDensity();      // px per dip
    const p = this.paint;

    // Gradients: int[]/float[] overloads can't resolve from JS arrays — build them with Array.create
    const colors = Array.create('int', 2) as androidNative.Array<number>;
    colors[0] = android.graphics.Color.argb(255, 34, 88, 178); colors[1] = android.graphics.Color.argb(255, 6, 22, 64);
    const stops = Array.create('float', 2) as androidNative.Array<number>; stops[0] = 0; stops[1] = 1;
    p.setStyle(android.graphics.Paint.Style.FILL);
    p.setShader(new android.graphics.RadialGradient(w / 2, h / 2, w * 0.4, colors, stops, android.graphics.Shader.TileMode.CLAMP));
    canvas.drawCircle(w / 2, h / 2, w * 0.4, p);
    p.setShader(null);

    // Many points: batch into ONE drawPoints per paint. Plain number[] marshals to float[];
    // a Float32Array does NOT ("Failed resolving method drawPoints on class android.graphics.RecordingCanvas").
    this.xy.length = 0;                                     // reuse the array, don't reallocate
    for (let i = 0; i < this.count; i++) { this.xy.push(this.px[i], this.py[i]); }
    p.setStrokeCap(android.graphics.Paint.Cap.ROUND); p.setStrokeWidth(2 * density);
    canvas.drawPoints(this.xy, p);
  }
}
```

## Performance (measured on SwiftShader; real devices are far faster)
* The JS loop projecting ~6k points is ~1 ms/frame; the cost is Java calls + Skia. Went from ~30 ms → ~15 ms/frame by:
  * caching static content (starfield/background) into an `android.graphics.Bitmap` once and `drawBitmap`ing it;
  * binning points by colour/alpha into a handful of `drawPoints` calls instead of thousands of `drawCircle`s;
  * never doing `Path.op(...)` booleans per frame (several ms each) — use `canvas.save()` / `rotate()` / `clipPath()` / `clipRect()` and even-odd `Path` fills, then `restore()`.
* Reuse `Paint`/`Path`/arrays across frames. `BlurMaskFilter` is unreliable under hardware acceleration — stack a few translucent shapes for soft edges.
* `adb shell dumpsys gfxinfo <pkg>` gives frame-time histograms; reset with `dumpsys gfxinfo <pkg> reset`.

## Other Android-specific bites
* Gesture coordinates from NativeScript (`e.getX()`) are dip; onDraw works in px: `Utils.layout.toDevicePixels(dip)`.
* Colours in NS templates/CSS: 8-digit hex is `#RRGGBBAA` (CSS order), not Android's `#AARRGGBB` — use `rgba(...)` strings.
* `sys://` SF Symbol image sources don't exist on Android — ship vector drawables in `App_Resources/Android/src/main/res/drawable/*.xml` and use `res://name`, branching on `isIOS`.
* Keep the same public API as the iOS renderer so shared code never branches — see `ns-custom-view-platform-split`.

## Emulator workflow
```bash
nohup emulator -avd Pixel_6a_API_35 -no-snapshot-load -gpu auto > emu.log 2>&1 &   # detach (no setsid on macOS)
adb exec-out screencap -p > shot.png            # screenshot
adb shell input tap 540 1500                    # px, not dip
adb emu geo fix -122.6784 45.5152               # GPS fix: lon lat
adb shell df -h /data                           # a Play-image AVD can be too full to install → other AVD or -wipe-data
```
`ns run android` does not re-attach if the emulator instance changes — restart it.
