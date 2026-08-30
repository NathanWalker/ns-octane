---
name: ns-ios-widgets
description: Use when adding iOS Home Screen widgets, Live Activities, or Dynamic Island UI to a NativeScript app (ns widget ios, WidgetKit, ActivityKit), when a Live Activity never appears or renders empty ("Archive was nil. LiveActivity will be empty"), when a widget shows stale/no data, or when a widget image asset renders blank — App Group data flow, the @objcMembers JS bridge, and the three silent image traps.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Apple widgets: Home Screen, lock screen, Dynamic Island

Widgets and Live Activities run in a **separate extension process** with no JS runtime — everything is SwiftUI on the native side, fed by your NativeScript app through an App Group. Official guide: https://docs.nativescript.org/guide/widgets-ios.md

## 1. Scaffold — `ns widget ios`

NativeScript CLI 8.9+ generates the whole stack with one command (prompts for a name and a type: Live Activity, Home Screen Widget, or both): `ns widget ios`.

| Path | Role |
|---|---|
| `App_Resources/iOS/extensions/<name>/` | The widget extension target: `<Name>Bundle.swift` (`@main WidgetBundle`), the SwiftUI files, `Info.plist` (`NSExtensionPointIdentifier: com.apple.widgetkit-extension`), `<name>.entitlements`, `extension.json`, `PrivacyInfo.xcprivacy` |
| `App_Resources/iOS/extensions/provisioning.json` | Maps the extension bundle id (`<appId>.<name>`) → provisioning profile UUID |
| `App_Resources/iOS/src/AppleWidgetUtils.swift` | The JS ↔ native bridge (§3) |
| `Shared_Resources/iOS/SharedWidget/` | Local Swift package shared by app + extension — holds the `ActivityAttributes` model (the data contract) |
| `App_Resources/iOS/app.entitlements` | App Groups capability (created if missing) |

Non-negotiable prerequisites (each fails *silently* or with a misleading error when missing):

* `IPHONEOS_DEPLOYMENT_TARGET = 17.0;` in `App_Resources/iOS/build.xcconfig` — ActivityKit and the widget `containerBackground` API need it; without it you get "only available in application extensions for iOS 17.0 or newer" build errors.
* `NSSupportsLiveActivities` → `true` in the **app's** `Info.plist` — without it `Activity.request` throws and no island/lock-screen UI ever appears.
* The **same** App Group id (`group.<appId>`) in *both* `app.entitlements` and the extension's `.entitlements`. A mismatch = widget reads nil forever, no error anywhere.
* Device builds: each extension needs its own provisioning profile — find the Xcode-managed one under `~/Library/Developer/Xcode/UserData/Provisioning Profiles`, put its UUID in `provisioning.json`.

The shared package is wired in `nativescript.config.ts` — `targets: ['widget']` links it into the extension in addition to the app:

```ts
ios: {
  SPMPackages: [
    { name: 'SharedWidget', libs: ['SharedWidget'],
      path: './Shared_Resources/iOS/SharedWidget', targets: ['widget'] }
  ]
}
```

## 2. The data contract: preformatted strings through the App Group

The app and widget share **JSON strings in App Group UserDefaults** — JS stringifies a payload, the widget decodes it with `Codable`. Two rules: **format every label on the JS side** (the widget never does timezone math or date formatting — ship display-ready strings like `timeLabel: "11:00 AM"` plus raw epoch ms for the only math the widget legitimately does: filtering by "now"; SwiftUI views stay dumb renderers). And **keep the shared key constants in sync by comment on both sides** — the TS key constant and the Swift key enum must match by string; a drift is another silent-nil failure. Same for the App Group id, which appears in four places (2 entitlements files, the bridge, the widget).

## 3. The JS bridge: `@objcMembers` static utils

WidgetKit and ActivityKit are Swift-only — the bridge is a small `@objcMembers public class AppleWidgetUtils: NSObject` of static methods in `App_Resources/iOS/src/` (app-target sources are auto-compiled; the class is visible to JS with a bare `declare const AppleWidgetUtils: any`, or typed declarations in `references.d.ts`).

* JS object literals arrive as `NSDictionary` — unpack defensively: `data.object(forKey: "title") as? String ?? ""`.
* `WidgetCenter.shared.reloadAllTimelines()` after every App Group write, from a detached Task.
* **Keep every WidgetKit/ActivityKit call off the launch path** — cold-start native calls in field initializers/constructors cause white-screen/boot jank; defer with a `setTimeout(..., 2000)`.

## 4. Live Activity + Dynamic Island specifics

* `ActivityAttributes` lives in the shared package: fixed attributes = set once at start; `ContentState` = everything updatable.
* **Start only from the foreground** — ActivityKit rejects background `request`s. Sync on your data-feed updates *and* on `Application.resumeEvent`; that covers both.
* **One activity, idempotent sync**: expose `hasActiveActivity()` from the bridge and branch start-vs-update in JS. On start, first `end(nil, dismissalPolicy: .immediate)` any existing activities — orphans from a previous run otherwise stack up.
* **End with meaning**: when the session completes, `end` with a final ContentState rather than just cancelling — the lock screen shows the final state briefly.
* **Dynamic Island regions**: use `DynamicIslandExpandedRegion(.center)` for a full-width row below the camera — `.leading`/`.trailing` clip around the cutout. Provide all three small forms: `compactLeading` (brand mark ~18pt), `compactTrailing` (the one live datum), `minimal` (~16pt mark). Gate on `ActivityAuthorizationInfo().areActivitiesEnabled` before every call, and wrap `Activity` calls in `Task { }` (they're async) so bridge methods stay synchronous fire-and-forget for JS.

## 5. Home Screen widget: precompute the timeline, no network

Widget extensions get milliseconds of CPU and no reliable network. Don't fetch — **precompute entries from the App Group payload**: one entry for "now" plus one at each event boundary (e.g. each meeting's end time), so the rendered list advances the instant an event wraps; a coarse `policy: .after(30 min)` catches payload changes. Always implement a realistic `placeholder(in:)` — it renders in the widget gallery. `WidgetCenter.shared.getCurrentConfigurations` (async) tells you how many widgets are actually installed — write the count into the App Group to drive an in-app "Add the widget" promo card.

## 6. Deep links back into the app

Put `.widgetURL(...)` on every surface — the lock-screen view, the `DynamicIsland { }` result, and home widget views — using the app's custom scheme with a source marker: `myapp://items/detail?id=X&source=widget`. Keep one `enum` in the widget that mirrors JS routing, and buffer cold-launch URLs on the JS side (the tap may arrive before services subscribe). For per-row links inside a medium/large widget, use `Link(destination:)`; `.widgetURL` covers the whole-widget tap.

## 7. Images in the widget (the blank-logo trap)

The extension **cannot see the app's `Assets.xcassets`** — `Image("SomeAppAsset")` silently renders nothing. Bundle images in the shared Swift package: drop the PNG in `Sources/SharedWidget/Resources/`, declare `resources: [.process("Resources")]` on the target, and load **by file path, not by name**. Three silent failure modes, all hit in practice:

* **Named lookup renders nothing.** In widget processes, SwiftUI's `Image("name", bundle:)` — including via `Bundle.module` — only consults a **compiled asset catalog**, and SPM `.process()` ships loose PNGs, no catalog. Only trace: `SwiftUI: No image named 'x' found in asset catalog for ...SharedWidget_SharedWidget.bundle` in system logs. Fix: `bundle.path(forResource:ofType:)` → `UIImage(contentsOfFile:)` → `Image(uiImage:)`.
* **Oversized bitmap can blank the whole island.** ActivityKit refuses images larger than the presentation and can drop the *entire* archive — `WidgetRenderer: Archive was nil. LiveActivity will be empty` in system logs, island invisible. `.resizable().frame(height: 18)` does NOT protect you: the full bitmap is what gets archived. Pre-resize the asset to ~largest display size × 3 (e.g. `sips -Z 96` for a ≤32pt mark).
* **`Bundle.module` is a fatalError** when the SPM resource bundle isn't embedded in some build path — it kills the extension process → nil archives → invisible activity. Use a nil-returning bundle finder and fall back to a text glyph: a degraded brand mark beats an invisible activity.

```swift
private final class BundleFinder {}

// resource bundle is named <PackageName>_<TargetName>.bundle, at the root of
// whichever bundle links the package (.appex for the extension, .app for the app)
static func loadLogo() -> Image? {
    let bundleName = "SharedWidget_SharedWidget.bundle"
    let candidates = [
        Bundle(for: BundleFinder.self).resourceURL,
        Bundle.main.resourceURL,
        Bundle(for: BundleFinder.self).bundleURL.deletingLastPathComponent(),
    ]
    for candidate in candidates {
        guard let url = candidate?.appendingPathComponent(bundleName),
              let bundle = Bundle(url: url),
              let path = bundle.path(forResource: "logo", ofType: "png"),
              let image = UIImage(contentsOfFile: path) else { continue }
        return Image(uiImage: image)   // NOT Image("logo", bundle:)
    }
    return nil
}
```

Annotate shared-package view helpers `@available(iOS 13.0, macOS 10.15, *)` and guard UIKit with `#if canImport(UIKit)` — SourceKit type-checks the package for macOS and reports false errors otherwise.

## 8. Verifying and diagnosing

* Validate the shared package standalone (plain `swift build` fails — ActivityKit is iOS-only): `swift build --sdk $(xcrun --sdk iphonesimulator --show-sdk-path) -Xswiftc -target -Xswiftc arm64-apple-ios17.0-simulator`.
* SourceKit's `No such module 'SharedWidget'` in `extensions/*/*.swift` is **editor noise** — those files only compile inside the generated `platforms/ios` project. Trust `ns build ios`.
* Live Activity never appears → check, in order: `NSSupportsLiveActivities`; Settings → app → Live Activities toggle; started from foreground; `areActivitiesEnabled`; bridge prints in device logs.
* Was working, now empty/absent → check whether the app intentionally ended it, then grep system logs for `archive was nil` (see §7 image traps). A `fatalError` additionally leaves a `widget-*.ips` in `~/Library/Logs/DiagnosticReports/`; no crash report + nil archives points at the image-size limit.
* Widget shows placeholder/stale data → App Group id mismatch, or the JS write happened without `reloadAllTimelines`; long-press → remove → re-add the widget to force a fresh timeline.
* Dynamic Island needs an island device or iPhone 15/16/17-class simulator; elsewhere the same activity renders on the lock screen only — test both. **`xcrun simctl io booted screenshot` does NOT composite the Dynamic Island layer** — capture the Simulator window instead (`screencapture -x`).
* After changing `extension.json`, entitlements, or provisioning: `ns clean` — the generated Xcode project caches target config.
* Extension `print()`/faults don't appear in `log show` — attach stdout with `xcrun simctl launch --console-pty booted <bundleId>`.

Verified 2026-08: iOS 26 simulator (iPhone 16 Pro), NativeScript CLI 8.9+/9.1, @nativescript/core 9.1.0-alpha.11 — Home Screen widget + Live Activity + Dynamic Island shipping in a production app; every trap above hit and diagnosed first-hand. Device provisioning flow untested on CI.
