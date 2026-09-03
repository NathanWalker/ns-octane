---
name: ns-no-intl-native-formatting
description: Use when NativeScript output shows ungrouped numbers, "Tue Aug 18 2026 05:14:26 GMT-0700" style dates, or `Intl is not defined` — the iOS V8 runtime has no ICU, so format times/numbers with NSDateFormatter / SimpleDateFormat instead.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Formatting without `Intl` in NativeScript

The NativeScript iOS runtime's V8 is built without ICU: `Intl` is undefined,
`Number.prototype.toLocaleString()` does not group digits, `Date.prototype.toLocaleString()`
returns the long default string. Android's V8 may have it, but write one path that always
works: ask the platform's own formatters (they also honour the user's 12/24-hour setting and
render a moment in any IANA time zone).

Two rules: **never** `Intl`/`toLocaleString` (undefined or wrong on iOS), and **cache every formatter** — creating an `NSDateFormatter` or `SimpleDateFormat` per call is milliseconds each and shows up when a list re-renders every second. One `Map` keyed by `template|timeZone` per platform, as below.

```ts
import { isIOS } from '@nativescript/core';

const iosFormatters = new Map<string, NSDateFormatter>();          // cache: template|tz → formatter
function iosFormatter(template: string, timeZone?: string): NSDateFormatter {
  const key = `${template}|${timeZone ?? ''}`;
  let f = iosFormatters.get(key);
  if (!f) {
    f = NSDateFormatter.new();
    f.locale = NSLocale.currentLocale;
    // skeleton → localized pattern ("jmm" → "h:mm a" or "HH:mm"; "EEE" → "Tue")
    f.dateFormat = NSDateFormatter.dateFormatFromTemplateOptionsLocale(template, 0, NSLocale.currentLocale);
    if (timeZone) { const tz = NSTimeZone.timeZoneWithName(timeZone); if (tz) f.timeZone = tz; }
    iosFormatters.set(key, f);
  }
  return f;
}

const androidFormatters = new Map<string, java.text.SimpleDateFormat>();  // same cache on Android
function androidFormatter(template: string, timeZone?: string): java.text.SimpleDateFormat {
  const key = `${template}|${timeZone ?? ''}`;
  let f = androidFormatters.get(key);
  if (!f) {
    const locale = java.util.Locale.getDefault();
    const pattern = android.text.format.DateFormat.getBestDateTimePattern(locale, template);
    f = new java.text.SimpleDateFormat(pattern, locale);
    if (timeZone) f.setTimeZone(java.util.TimeZone.getTimeZone(timeZone));
    androidFormatters.set(key, f);
  }
  return f;
}

function formatWithTemplate(date: Date, template: string, timeZone?: string): string {
  if (isIOS) return iosFormatter(template, timeZone).stringFromDate(date);  // JS Date marshals to NSDate directly
  return androidFormatter(template, timeZone).format(new java.util.Date(date.getTime()));
}

export const formatTime = (d: Date, tz?: string) => formatWithTemplate(d, 'jmm', tz);      // "9:42 PM"
export function formatWhen(d: Date, now = new Date()): string {                              // "Today 9:42 PM" / "Tomorrow …" / "Thu 5:14 AM"
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  const t = formatTime(d);
  return diff === 0 ? `Today ${t}` : diff === 1 ? `Tomorrow ${t}` : `${formatWithTemplate(d, 'EEE')} ${t}`;
}
export function groupDigits(n: number): string {                                              // 27597 → "27,597"
  const r = Math.round(n);
  return (r < 0 ? '-' : '') + Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
```
Notes
* Don't pass `NSDate.dateWithTimeIntervalSince1970(...)` — the typings expect a JS `Date` and the runtime converts.
* Templates are Unicode skeletons (`jmm`, `Hmm`, `EEE`, `MMMd`, `yMMMd jm`).
* Clear the caches if the app reacts to locale changes (`Application.on('systemAppearanceChanged')` won't fire for locale — listen for `NSCurrentLocaleDidChangeNotification` / `ACTION_LOCALE_CHANGED` if you care).
* For a "solar clock" at a spot with no zone (open ocean) format a synthetic UTC date with `formatTime(d, 'UTC')`.
