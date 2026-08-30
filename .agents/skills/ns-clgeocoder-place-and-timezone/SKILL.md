---
name: ns-clgeocoder-place-and-timezone
description: Use when a NativeScript app must turn a coordinate into a place name and its local time (tap on a map/globe, "what time is it there") — CLGeocoder reverse geocoding with CLPlacemark.timeZone on iOS, android.location.Geocoder on Android, and an ocean fallback.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Reverse geocode + local time zone, no API keys

Verified on iOS 26.5 simulator (`CLGeocoder` needs network but no key) and Android API 35 emulator (`android.location.Geocoder`).

```ts
export interface Place { name: string; timeZone?: string; ocean: boolean }

function reverseGeocodeIOS(lat: number, lon: number): Promise<Place> {
  return new Promise((resolve) => {
    const geocoder = CLGeocoder.new();
    const location = CLLocation.alloc().initWithLatitudeLongitude(lat, lon);
    geocoder.reverseGeocodeLocationCompletionHandler(location, (placemarks, error) => {
      const pm = placemarks?.firstObject;
      if (error || !pm) return resolve({ name: oceanName(lat, lon), ocean: true });
      const parts = [pm.locality || pm.subAdministrativeArea || pm.administrativeArea, pm.country].filter(Boolean);
      const isWater = !pm.country && !!(pm.ocean || pm.inlandWater);
      resolve({
        name: isWater ? `the ${pm.ocean || pm.inlandWater}` : parts.join(', ') || pm.name || oceanName(lat, lon),
        timeZone: pm.timeZone?.name,     // IANA id, e.g. "Africa/Lagos" — feed it to NSDateFormatter.timeZone
        ocean: isWater,
      });
    });
  });
}

function reverseGeocodeAndroid(lat: number, lon: number): Promise<Place> {
  return new Promise((resolve) => {
    try {
      const geocoder = new android.location.Geocoder(Utils.android.getApplicationContext(), java.util.Locale.getDefault());
      const results = geocoder.getFromLocation(lat, lon, 1);          // synchronous; call off the UI thread for many lookups
      const a = results && results.size() > 0 ? results.get(0) : null;
      if (!a) return resolve({ name: oceanName(lat, lon), ocean: true });
      const parts = [a.getLocality() || a.getSubAdminArea() || a.getAdminArea(), a.getCountryName()].filter(Boolean);
      resolve({ name: parts.length ? parts.join(', ') : oceanName(lat, lon), ocean: parts.length === 0 });
    } catch { resolve({ name: oceanName(lat, lon), ocean: true }); }
  });
}

/** Coarse but friendly names for taps on open water. */
export function oceanName(lat: number, lon: number): string {
  if (lat < -60) return 'the Southern Ocean';
  if (lat > 66) return 'the Arctic Ocean';
  if (lon > 20 && lon < 147 && lat < 30) return 'the Indian Ocean';
  if (lon >= -70 && lon <= 20) return 'the Atlantic Ocean';
  if (lon > 147 || lon < -70) return 'the Pacific Ocean';
  return 'the open ocean';
}
```
* Android's Geocoder has no time zone; derive local time from longitude (`utcMinutes + lon*4`, "mean solar time") or a tz library.
* Rate limits apply (Apple: don't fire per drag event; geocode on tap/dwell only).
* Pair with `ns-no-intl-native-formatting` to render the remote local time (`formatTime(now, place.timeZone)`), and with sun-elevation math to describe day/night there.
