---
name: ns-ios-scenekit-from-typescript
description: Use when a NativeScript iOS app needs real-time 3D (globes, planets, product viewers, particle scenes) — drive SceneKit (SCNView, materials, Metal shader modifiers, hit testing) directly from TypeScript with no plugin.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# SceneKit straight from TypeScript (NativeScript iOS)

Verified on iOS 26.5 simulator, @nativescript/core 9.0, Angular 20. SceneKit is
a bundled iOS framework: every class is reachable from JS with zero bridging code.
First add the typings (see `ns-ios-framework-typings`):

```ts
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit.d.ts" />
```

## 1. Host an SCNView in a custom View

```ts
import { View } from '@nativescript/core';

export class Globe3D extends View {
  private scene = SCNScene.scene();
  createNativeView(): SCNView {
    const v = SCNView.alloc().initWithFrameOptions(CGRectZero, null);
    v.backgroundColor = UIColor.blackColor;
    v.antialiasingMode = SCNAntialiasingMode.Multisampling4X;
    v.preferredFramesPerSecond = 60;
    v.rendersContinuously = true;      // keep animating even when "nothing changed"
    v.autoenablesDefaultLighting = false;
    v.allowsCameraControl = false;     // own the camera; use NS gestures (pan/pinch)
    return v;
  }
  initNativeView() {
    super.initNativeView();
    const v = this.nativeViewProtected as SCNView;
    v.scene = this.scene;
    v.pointOfView = this.cameraNode;
  }
  disposeNativeView() {
    (this.nativeViewProtected as SCNView).scene = null;
    super.disposeNativeView();
  }
}
```
Set `this.iosOverflowSafeArea = true` in the constructor for a full-bleed view.

## 2. Structs, nodes, textures

* `SCNVector3` is an interop struct — pass plain objects: `node.position = { x, y, z }`, `node.eulerAngles = { x: 0, y: yaw, z: 0 }`. `SCNVector3Zero` exists; `SCNVector3Make` does not (inline C).
* `node.lookAt(SCNVector3Zero)` points −Z at the origin (world coordinates).
* Textures from app assets:
  ```ts
  const file = path.join(knownFolders.currentApp().path, 'assets', 'earth', 'day.jpg');
  material.diffuse.contents = UIImage.imageWithContentsOfFile(file);
  material.diffuse.mipFilter = SCNFilterMode.Linear; material.diffuse.maxAnisotropy = 8;
  ```
* `scene.background.contents = <2:1 equirectangular UIImage>` renders a spherical sky (SceneKit detects 2:1). `background.intensity` dims it.
* Blinn: `shininess` is the specular exponent (default 1 = huge soft highlight; ~20–30 for glints).
* Actions: typings name them `SCNAction.group([...])`, `SCNAction.sequence([...])`, `repeatActionForever`, `rotateByXYZDuration`, `scaleToDuration`, `fadeOpacityToDuration`, `waitForDuration`. `SCNAction.groupWithActions` does not exist.
* Sphere UV ↔ lat/lon (calibrated): texture centre (lon 0) faces **+Z**, east is **+X**, north **+Y**:
  ```ts
  x = r*cos(lat)*sin(lon);  y = r*sin(lat);  z = r*cos(lat)*cos(lon);
  // inverse: lat = asin(y/len), lon = atan2(x, z)
  ```
  So rotating the sphere's parent by `-lon` about Y brings that meridian to the front.

## 3. Metal shader modifiers (the real power)

```ts
material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(SRC, SCNShaderModifierEntryPointFragment) as any;
// custom uniforms are bound by KVC on the material:
material.setValueForKey(NSValue.valueWithSCNVector3({ x, y, z }), 'sunDir');
material.setValueForKey(SCNMaterialProperty.materialPropertyWithContents(uiImage), 'nightTex');
```
```metal
#pragma arguments
texture2d<float> nightTex;   // logs "C3DBaseTypeFromMetalString: unknown type name" — harmless, still binds
float3 sunDir;               // model-space vector, updated whenever you like
#pragma body
constexpr sampler s(filter::linear, address::repeat, mip_filter::linear);
float3 sunView = normalize((scn_node.modelViewTransform * float4(sunDir, 0.0)).xyz);
float3 n = normalize(_surface.geometryNormal);   // smooth normal (ignores normal map)
float3 v = normalize(_surface.view);             // toward camera
float ndl = dot(n, sunView);
float night = 1.0 - smoothstep(-0.06, 0.24, ndl);
_output.color.rgb += nightTex.sample(s, _surface.diffuseTexcoord).rgb * night * 1.9;
_output.color.rgb += float3(0.28, 0.52, 1.0) * pow(1.0 - saturate(dot(n, v)), 3.2) * smoothstep(-0.1, 0.18, ndl);
```
Facts from `SCNShadable.h` (read it: `/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/System/Library/Frameworks/SceneKit.framework/Headers/SCNShadable.h`):
* Fragment stage has `_surface` (read-only: `view, position, normal, geometryNormal, diffuseTexcoord, diffuse, …`) and `_output.color`. **`_lightingContribution` is NOT available in the fragment stage** — compute your own NdotL from a uniform.
* `scn_frame.time`, `scn_node.modelViewTransform` etc. are usable in every stage.
* `#pragma transparent` forces blending `src.rgb + (1-src.a)*dst.rgb` (premultiplied) — with `_output.color = float4(rgb, 0.0)` you get additive glow.
* Metal varyings exist: `#pragma varyings` + `out.x = …` in geometry stage, `in.x` in fragment.
* Uniform types: float/float2 (CGPoint)/float3 (SCNVector3 via NSValue)/float4/float4x4/texture2d (SCNMaterialProperty).

## 4. Atmosphere shell trick
Larger sphere (R≈1.14) rendering **back faces only** so the depth test leaves just a ring outside the limb:
```ts
am.lightingModelName = SCNLightingModelConstant; am.cullMode = SCNCullMode.Front;
am.writesToDepthBuffer = false; am.readsFromDepthBuffer = true; node.renderingOrder = 10;
```
Fragment: `facing = saturate(-dot(gn, v)); t = saturate(facing / sqrt(1 - 1/R²)); glow = pow(t, 1.45)` → brightest at the planet limb, fading outward; modulate by sun dot for day/night.

## 5. Camera
```ts
camera.projectionDirection = SCNCameraProjectionDirection.Horizontal; // fov applies to width — sane portrait framing
camera.fieldOfView = 40; camera.wantsHDR = true; camera.wantsExposureAdaptation = false;
camera.bloomIntensity = 0.55; camera.bloomThreshold = 0.75; camera.bloomBlurRadius = 10;
```
A camera rig node (pitch about X) holding the camera at `(0, -0.13*d, d)` shifts the subject up on screen without perspective skew.

## 6. Hit testing
```ts
const opts = NSDictionary.dictionaryWithObjectsForKeys([CATEGORY_EARTH, true],
  [SCNHitTestOptionCategoryBitMask, SCNHitTestBackFaceCullingKey]) as NSDictionary<string, any>;
const hits = view.hitTestOptions(CGPointMake(x, y), opts);   // x,y in points = NS dip
const local = hits.objectAtIndex(0).localCoordinates;        // model space of the hit node
```
Give decor nodes a different `categoryBitMask`. For tiny targets, project instead: `const p = view.projectPoint(node.worldPosition); if (p.z < 1 && hypot(p.x - x, p.y - y) < 34) …`.
Option keys in typings: `SCNHitTestOptionCategoryBitMask`, `SCNHitTestBackFaceCullingKey`, `SCNHitTestFirstFoundOnlyKey`, `SCNHitTestIgnoreHiddenNodesKey`.

## Pitfalls
* Watch the simulator log for shader compile errors: `xcrun simctl spawn <udid> log show --last 2m --predicate 'process == "yourapp"' | grep -i scenekit`.
* Per-node `opacity` works with shared geometry/material — use it for trails instead of cloning materials.
* Drive per-frame updates with a CADisplayLink (see `ns-ios-cadisplaylink-render-loop`), never from `SCNSceneRendererDelegate` (runs off the JS thread).
