---
name: ns-haptics-direct
description: Use when a NativeScript app should give tactile feedback (tab change, tap confirm, success moment) — UIFeedbackGenerator on iOS and VibrationEffect on Android, no plugin.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Haptics without a plugin

```ts
import { isIOS, Utils } from '@nativescript/core';

let light: UIImpactFeedbackGenerator | null = null, medium: UIImpactFeedbackGenerator | null = null;
let selection: UISelectionFeedbackGenerator | null = null, notify: UINotificationFeedbackGenerator | null = null;

function androidVibrate(ms: number, amplitude = 80) {
  const ctx = Utils.android.getApplicationContext();
  const v = ctx.getSystemService(android.content.Context.VIBRATOR_SERVICE) as android.os.Vibrator;
  if (v?.hasVibrator()) v.vibrate(android.os.VibrationEffect.createOneShot(ms, amplitude));   // API 26+
}

export const haptics = {
  tick()    { isIOS ? (selection ??= UISelectionFeedbackGenerator.new()).selectionChanged() : androidVibrate(8, 40); },
  tap()     { isIOS ? (light ??= UIImpactFeedbackGenerator.alloc().initWithStyle(UIImpactFeedbackStyle.Light)).impactOccurred() : androidVibrate(12, 80); },
  thud()    { isIOS ? (medium ??= UIImpactFeedbackGenerator.alloc().initWithStyle(UIImpactFeedbackStyle.Medium)).impactOccurred() : androidVibrate(25, 160); },
  success() { isIOS ? (notify ??= UINotificationFeedbackGenerator.new()).notificationOccurred(UINotificationFeedbackType.Success) : androidVibrate(40, 200); },
};
```
* Android manifest: `<uses-permission android:name="android.permission.VIBRATE"/>`.
* Lazily create generators; call `prepare()` beforehand if the tap timing must be tight.
* Simulator produces no haptics — verify on device. Use `tick` for segmented/tab changes, `tap` for selections, `success` sparingly (a once-per-event moment, e.g. "it's overhead now").
