---
name: ns-iss-tracking-satellite-js
description: Use when an app (NativeScript or any JS) needs live satellite/ISS position, ground track, sunlit state, or "when can I see it" pass predictions — satellite.js pinning, TLE sourcing with offline fallback, and the visibility math.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# ISS tracking with satellite.js (offline-capable)

## Dependency
`npm i satellite.js@5.0.0` — **pin 5.x**. 7.x is ESM-only, re-exports a WASM runtime via package
`imports` subpaths (`#wasm-single-thread`) that bundlers choke on, and `exports` blocks deep imports.
5.x is pure JS (`import * as satellite from 'satellite.js'`), API: `twoline2satrec, propagate(satrec, date), gstime, eciToGeodetic, eciToEcf, ecfToLookAngles`.
`propagate` returns `{ position, velocity }` where each may be `false` on error — guard.

## Elements
```ts
const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'; // 3 lines: name, L1, L2
export const FALLBACK_TLE = ['1 25544U 98067A   26228.56710022  .00005115  00000+0  99348-4 0  9991',
                            '2 25544  51.6334   1.2594 0007609  53.1141 307.0544 15.49461657581119'];
// bundle a recent TLE so the app is truthful offline; refresh from CelesTrak on launch (accuracy decays ~km/day)
const rec = satellite.twoline2satrec(l1, l2); const ageHours = (Date.now() - (rec.jdsatepoch - 2440587.5) * 864e5) / 36e5;
```

## State, ground track, look angles
```ts
const pv = satellite.propagate(satrec, date); const gmst = satellite.gstime(date);
const geo = satellite.eciToGeodetic(pv.position, gmst);       // radians + height km
const lat = geo.latitude * RAD, lon = geo.longitude * RAD, altKm = geo.height;
const speedKmh = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) * 3600;
const ecf = satellite.eciToEcf(pv.position, gmst);
const la = satellite.ecfToLookAngles({ latitude: obsLat*DEG, longitude: obsLon*DEG, height: 0.05 }, ecf); // azimuth, elevation (rad), rangeSat km
```
Ground track: sample −45…+45 min at 60 s (91 propagations ≈ 0.5 ms).

## Sunlit? (cylindrical shadow)
```ts
function isSunlit(posEci: Vec3, sunEci: Vec3 /* unit, from RA/dec */): boolean {
  const along = dot(posEci, sunEci); if (along >= 0) return true;
  const perp = sub(posEci, scale(sunEci, along)); return len(perp) > 6371;
}
```
Sun unit vector in ECI: `(cos dec cos ra, cos dec sin ra, sin dec)` from `ns-solar-terminator-math`.

## Passes and naked-eye visibility
```ts
// coarse scan: 30 s steps over N hours; track entering/leaving elevation ≥ 10°, keep peak
// visible = observer sun elevation at peak < -6° (twilight or darker) && satellite sunlit at peak
```
48 h scan ≈ 14 ms in V8. Report rise/set azimuth (compass label), peak elevation, duration.
Orbital sunrise/sunset: scan 20 s steps up to 100 min for the sunlit flag flipping.

## Cross-check
`curl https://api.wheretheiss.at/v1/satellites/25544` — with a fresh TLE we matched to 0.04° lat/lon and 0.1 km altitude.
Crew list: `http://api.open-notify.org/astros.json` (HTTP — needs an ATS exception / cleartext on Android; bundle a fallback).
