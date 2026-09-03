---
name: ns-corelocation-direct
description: Use when a NativeScript app needs the device location or compass heading without a plugin — CLLocationManager + delegate class on iOS, LocationManager on Android, plus simulator/permission setup.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Location + heading straight from the platform

Verified: iOS 26.5 simulator (one-shot location + authorization flow) and Pixel 6a API 35 emulator (LocationManager + `android.location.Geocoder`).

## iOS — step 1: typings (do this first; without it `CLLocationManager`, `CLLocation`, `CLAuthorizationStatus` are "Cannot find name")
Append to the project's `references.d.ts` (both lines — `CLLocation` itself is declared in `_LocationEssentials`):
```ts
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!CoreLocation.d.ts" />
/// <reference path="./node_modules/@nativescript/types-ios/lib/ios/objc-x86_64/objc!_LocationEssentials.d.ts" />
```
(background: `ns-ios-framework-typings`.)

## iOS — step 2: CLLocationManager with a TypeScript delegate
```ts
let onLocation: ((loc: { lat: number; lon: number } | null, error?: string) => void) | null = null;
let onHeading: ((trueHeading: number) => void) | null = null;

@NativeClass()
class Delegate extends NSObject implements CLLocationManagerDelegate {
  static ObjCProtocols = [CLLocationManagerDelegate];

  locationManagerDidChangeAuthorization(mgr: CLLocationManager) {   // iOS 14+ callback
    const s = mgr.authorizationStatus;
    if (s === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedWhenInUse || s === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedAlways) mgr.requestLocation();
    else if (s === CLAuthorizationStatus.kCLAuthorizationStatusDenied || s === CLAuthorizationStatus.kCLAuthorizationStatusRestricted) onLocation?.(null, 'denied');
  }
  locationManagerDidUpdateLocations(_m: CLLocationManager, locations: NSArray<CLLocation>) {
    const last = locations.lastObject; if (last) onLocation?.({ lat: last.coordinate.latitude, lon: last.coordinate.longitude });
  }
  locationManagerDidFailWithError(_m: CLLocationManager, error: NSError) { onLocation?.(null, error.localizedDescription); }
  locationManagerDidUpdateHeading(_m: CLLocationManager, h: CLHeading) {
    if (h.headingAccuracy < 0) return;
    onHeading?.(h.trueHeading >= 0 ? h.trueHeading : h.magneticHeading);
  }
}

let manager: CLLocationManager | null = null; let delegate: Delegate | null = null;   // keep BOTH alive
function ensure() {
  if (!manager) { manager = CLLocationManager.new(); manager.desiredAccuracy = kCLLocationAccuracyKilometer; /* declared in objc!_LocationEssentials.d.ts — reference it, or use 1000 (metres) */ delegate = Delegate.new(); manager.delegate = delegate; }
  return manager;
}
export function requestOnce(cb: typeof onLocation) {
  onLocation = cb; const m = ensure();
  const s = m.authorizationStatus;
  if (s === CLAuthorizationStatus.kCLAuthorizationStatusNotDetermined) m.requestWhenInUseAuthorization();  // → delegate callback → requestLocation
  else if (s === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedWhenInUse || s === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedAlways) m.requestLocation();
  else cb?.(null, 'denied');
}
export const headingAvailable = () => CLLocationManager.headingAvailable();
export function startHeading(cb: (deg: number) => void) { onHeading = cb; const m = ensure(); m.headingFilter = 2; m.startUpdatingHeading(); }
export function stopHeading() { onHeading = null; manager?.stopUpdatingHeading(); }
```
## iOS — step 3: Info.plist
```xml
<key>NSLocationWhenInUseUsageDescription</key><string>Why you need it, in one human sentence.</string>
```

## Android
```ts
const ctx = Utils.android.getApplicationContext();
const granted = androidx.core.content.ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.ACCESS_COARSE_LOCATION) === android.content.pm.PackageManager.PERMISSION_GRANTED;
if (!granted) { const a = Utils.android.getCurrentActivity(); if (a) androidx.core.app.ActivityCompat.requestPermissions(a, [android.Manifest.permission.ACCESS_COARSE_LOCATION], 4242); return; }
const lm = ctx.getSystemService(android.content.Context.LOCATION_SERVICE) as android.location.LocationManager;
const last = lm.getLastKnownLocation(android.location.LocationManager.NETWORK_PROVIDER) ?? lm.getLastKnownLocation(android.location.LocationManager.GPS_PROVIDER);
```
Manifest: `<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>`. Listen for the permission result via `Application.android.on(AndroidApplication.activityRequestPermissionsEvent, …)` if you need to retry automatically.

## Simulator
* `xcrun simctl location <udid> set 45.5152,-122.6784` — fake a fix.
* `xcrun simctl privacy <udid> grant location <bundleId>` — pre-approve; takes effect on the next launch (`xcrun simctl terminate/launch`).
* Android emulator GPS fix: `adb emu geo fix <lon> <lat>` (longitude first).
* Heading is never available on the simulator (`headingAvailable()` false) — design the UI so the compass arrow is optional.
