---
name: ns-solar-terminator-math
description: Use when you need the sun's position from a clock — subsolar point for a day/night terminator, sun elevation at a place, day-phase words, and next sunrise/sunset — in a few dependency-free lines.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Sun from the clock (USNO approximate solar coordinates, ±0.1°, 1950–2050)

```ts
const DEG = Math.PI / 180, RAD = 180 / Math.PI;
const norm360 = (d: number) => ((d % 360) + 360) % 360;
export const normLon = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
export const julianDay = (date: Date) => date.getTime() / 86400000 + 2440587.5;

export function sunState(date: Date) {
  const n = julianDay(date) - 2451545.0;
  const L = norm360(280.46 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = norm360(280.46061837 + 360.98564736629 * n) * DEG;
  return {
    lat: dec * RAD, lon: normLon((ra - gmst) * RAD),                 // subsolar point (sun overhead here)
    ra, dec,
    eci: { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) },   // unit vector for shadow tests
  };
}

export function sunElevation(sun: ReturnType<typeof sunState>, lat: number, lon: number): number {
  const ha = (lon - sun.lon) * DEG;
  const s = Math.sin(lat * DEG) * Math.sin(sun.lat * DEG) + Math.cos(lat * DEG) * Math.cos(sun.lat * DEG) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, s))) * RAD;
}
export const dayPhase = (el: number) => (el > 6 ? 'day' : el > -0.833 ? 'golden' : el > -12 ? 'twilight' : 'night');

/** Minute scan over 24 h; null when the sun never rises/sets (polar). */
export function nextSunEvents(from: Date, lat: number, lon: number) {
  let sunrise: Date | null = null, sunset: Date | null = null, prev = sunElevation(sunState(from), lat, lon);
  for (let m = 1; m <= 1440 && (!sunrise || !sunset); m++) {
    const t = new Date(from.getTime() + m * 60000), e = sunElevation(sunState(t), lat, lon);
    if (!sunrise && prev <= -0.833 && e > -0.833) sunrise = t;
    if (!sunset && prev > -0.833 && e <= -0.833) sunset = t;
    prev = e;
  }
  return { sunrise, sunset };
}
```
Sanity checks that passed: equinox 12:00 UTC → subsolar lat −0.04°, lon +1.9° (equation of time); solstice → 23.44°.
Rising or setting at a spot? Compare elevation with a point 2.5° further east (10 min later in its day): higher there ⇒ rising.
Terminator on a 3D globe: turn the subsolar lat/lon into a unit vector in the planet's frame and hand the same vector to the light and to any shader (see `ns-ios-scenekit-from-typescript`). Recompute per second; it is a handful of trig calls.
