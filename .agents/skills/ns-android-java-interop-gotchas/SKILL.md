---
name: ns-android-java-interop-gotchas
description: Use when NativeScript Android code throws "Cannot marshal JavaScript argument … to Java type", "Failed resolving method … on class", "Class constructor X cannot be invoked without 'new'", or colours/8-digit hex render wrong — the Java interop rules that trip TypeScript authors.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# NativeScript ↔ Java interop gotchas (verified, core 9.0, API 35)

## Checklist — apply ALL of these to every Java call in the file you are fixing
1. Every `@NativeClass()` class lives at **module scope**, never inside a method; it reaches its owner through a `WeakRef` property, not a closure.
2. Any Java parameter typed `int[]`, `float[]`, `long[]`, `double[]` where the method/constructor is **overloaded** (`RadialGradient`, `LinearGradient`, `SweepGradient`, `Path.setLastPoint`, `Matrix.setValues`, …) gets a **typed Java array** from `Array.create('int' | 'float', n)` — never a JS array literal.
3. Where the overload is unambiguous (`Canvas.drawPoints`, `drawLines`, `Paint.setPathEffect(new DashPathEffect(...))`), pass a **plain `number[]`** — never `Float32Array` / `Int32Array` / any typed array, and never a variable that was *declared* as one.
4. Colours in CSS/templates: `rgba(r,g,b,a)` or `#RRGGBBAA` (CSS order) — never Android's `#AARRGGBB`.
Search the file for `new Float32Array`, `new Int32Array`, `[` inside `new android.graphics.*Gradient(`, and `#[0-9A-Fa-f]{8}` before you declare it fixed.

## "Class constructor <Base> cannot be invoked without 'new'"
Cause: a `@NativeClass()` class declared *inside* another class's method. `@nativescript/webpack`'s
NativeClass transformer falls back to a text regex (`/^\s*@NativeClass\b/m`) that matches the
enclosing class body and downlevels the OUTER class to ES5, which then can't extend a real ES class.
Fix: declare every `@NativeClass` at module scope; hand it the owner via a property:
```ts
@NativeClass()
class Surface extends android.view.View {
  owner: WeakRef<MyView> | null = null;
  constructor(ctx: android.content.Context) { super(ctx); return global.__native(this); }
  onDraw(c: android.graphics.Canvas) { this.owner?.deref()?.paint(c); }
}
// in createNativeView(): const v = new Surface(this._context); v.owner = new WeakRef(this);
```

## "Cannot marshal JavaScript argument at index N to Java type"
Overloaded Java methods/constructors that differ only by primitive array type (`int[]` vs `long[]`,
`float[]` vs `double[]`) can't be resolved from a JS array. The classic case is a gradient —
`new android.graphics.RadialGradient(cx, cy, r, [c1, c2], [0, 1], mode)` throws exactly this for
index 3 (the `int[]` colours). Build typed Java arrays:
```ts
const colors = Array.create('int', 2) as androidNative.Array<number>;   // type is androidNative.Array, not native.Array
colors[0] = android.graphics.Color.argb(255, 34, 88, 178);
colors[1] = android.graphics.Color.argb(255, 6, 22, 64);
const stops = Array.create('float', 2) as androidNative.Array<number>;
stops[0] = 0; stops[1] = 1;
new android.graphics.RadialGradient(cx, cy, r, colors, stops, android.graphics.Shader.TileMode.CLAMP);
```
Same for `LinearGradient`/`SweepGradient` colour+stop arrays. Fixing `drawPoints` (next section) does **not** fix this one — they are two different bugs that usually appear together in a custom-drawn view.

## "Failed resolving method drawPoints on class android.graphics.RecordingCanvas"
JS typed arrays (`Float32Array`, `Int32Array`, …) are **not** marshalled to Java primitive arrays.
Plain JS `number[]` arrays do marshal to `float[]` when the overload is unambiguous:
```ts
private readonly xy: number[] = [];   // declared as number[], reused every frame
this.xy.length = 0;
this.xy.push(x0, y0, x1, y1);
canvas.drawPoints(this.xy, paint);    // OK
canvas.drawPoints(new Float32Array(4), paint);       // fails
canvas.drawPoints(Array.from(this.f32), paint);      // works but allocates per frame — don't
```
Keep the *backing store* a `number[]` too: a `Float32Array` field that you copy into a `number[]` at the call site is a per-frame allocation. Where the overload IS ambiguous, fall back to `Array.create('float', n)`.

## Colours
NativeScript parses 8-digit hex as CSS `#RRGGBBAA`, not Android's `#AARRGGBB` — `"#1AFFFFFF"` in a
template becomes near-opaque cyan. Use `rgba(255,255,255,0.1)` in CSS/templates; in Java calls use
`android.graphics.Color.argb(a, r, g, b)` / `Color.parseColor('#AARRGGBB')` (Android order there).

## Images
`sys://symbol.name` (SF Symbols) is iOS-only; on Android it logs "Error in reading bitmap … sys:/name".
Provide `res://name` vector drawables under `App_Resources/Android/src/main/res/drawable/` and branch on `isIOS`.

## Misc
* Extending Android classes: constructor must call `super(...)` then `return global.__native(this)`.
* Interface implementations: `new android.view.Choreographer.FrameCallback({ doFrame(nanos) {…} })` (Java `long` arrives as a JS number).
* Units: NS gesture coords are dip; native drawing/measure is px — `Utils.layout.toDevicePixels` / `toDeviceIndependentPixels`; density via `Utils.layout.getDisplayDensity()`.
* SegmentedBar on Android: style with `background-color` / `selected-background-color` / `color` (rgba strings); titles render uppercase.
