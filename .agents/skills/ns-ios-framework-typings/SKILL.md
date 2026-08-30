---
name: ns-ios-framework-typings
description: Use when TypeScript says "Cannot find name SCNView / CLLocationManager / CMMotionManager …" in a NativeScript iOS project — add the missing framework typings and look up exact native method names in the generated d.ts and Apple headers.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# iOS framework typings in NativeScript projects

`@nativescript/types` (via `references.d.ts`) only references a default subset of iOS
frameworks (UIKit, Foundation, AVFoundation, CoreGraphics, QuartzCore, WebKit, …).
SceneKit, CoreLocation, CoreMotion, CoreHaptics, MapKit, Metal, SpriteKit, Contacts, etc.
ship as d.ts files but are **not** referenced. Runtime access works regardless — this is
purely a compile-time problem, and Angular's webpack plugin will still emit a bundle but
report the errors.

## Fix: extend `references.d.ts`

```ts
/// <reference path="./node_modules/@nativescript/types/index.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!CoreLocation.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!_LocationEssentials.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!CoreMotion.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!CoreHaptics.d.ts" />
```
Gotcha: `CLLocation` itself is declared in `objc!_LocationEssentials.d.ts`, not `objc!CoreLocation.d.ts` — reference both. List what exists with
`ls node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/`.

## Find the exact selector spelling
Generated names concatenate the selector parts. Grep before guessing:
```bash
T="node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit.d.ts"
grep -n "static sphereWithRadius\|initWithFrameOptions\|hitTestOptions\|static group\b" "$T"
grep -n "declare const enum SCNTransparencyMode" -A8 "$T"
```
Examples: `SCNAction.group([...])` (not `groupWithActions`), `SCNView.alloc().initWithFrameOptions(rect, null)`, `NSDictionary.dictionaryWithObjectForKey(obj, key)`, `NSValue.valueWithSCNVector3(v)`.

## Missing constants
If an `extern const` seems missing, it is usually declared in a sibling file you have not referenced yet (`kCLLocationAccuracyKilometer` lives in `objc!_LocationEssentials.d.ts`, not `objc!CoreLocation.d.ts`) — `grep -rn "declare var kCLLocationAccuracyKilometer" node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/` finds the file. Only if it is truly absent, use the numeric value with a comment (`desiredAccuracy = 1000 // metres`).

Shortcut when you need many frameworks: `/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/ios.d.ts" />` references every framework d.ts (slower `tsc`, zero guessing); the per-framework lines above keep type-checking fast.

## Semantics: read the header, not your memory
Enum meanings and struct availability are documented in the SDK headers, e.g.
`/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk/System/Library/Frameworks/SceneKit.framework/Headers/SCNMaterial.h`
(`grep -n -A8 "SCNTransparencyModeRGBZero"` told us "luminance 0.0 is opaque"). This is faster and safer than trial builds.

## Both platforms type-check everywhere
`@nativescript/types/index.d.ts` references android and ios typings together, so iOS-only files type-check during Android builds too — no `#if` needed, just keep platform code in `.ios.ts`/`.android.ts` files (see `ns-custom-view-platform-split`).
