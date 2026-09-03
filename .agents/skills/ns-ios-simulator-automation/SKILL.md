---
name: ns-ios-simulator-automation
description: Use when developing/verifying a NativeScript app on the iOS simulator or Android emulator without a human present — screenshots, video frame-by-frame checks, taps/swipes, locating tap targets, fake location, permission grants, logs, and reading `ns run` output for errors.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# Driving the iOS simulator (and Android emulator) from the shell

```bash
U=$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1)   # booted device udid

# Build & run with live sync (background it and tail its log)
ns run ios --device $U --no-hmr 2>&1 | tee run.log
grep -n "ERROR in\|error TS\|JS ERROR\|Error:" run.log | tail      # webpack STILL syncs a bundle with TS errors — check!

# Screenshots (native px; downscale to look at them)
xcrun simctl io $U screenshot shot.png && sips -Z 900 shot.png --out shot_small.png
# Detect animation / frozen render loop: two shots a few seconds apart
cmp -s a.png b.png && echo "identical (nothing moving)"

# App lifecycle
xcrun simctl terminate $U com.example.app; xcrun simctl launch $U com.example.app

# Location + permissions
xcrun simctl location $U set 45.5152,-122.6784
xcrun simctl privacy $U grant location com.example.app     # applies at next launch

# System log (SceneKit/Metal shader errors, UIKit warnings)
xcrun simctl spawn $U log show --last 3m --predicate 'process == "myapp"' | grep -iE "scenekit|metal|error"

# Touch input: idb (brew install idb-companion; pip install fb-idb) — osascript clicks need Accessibility permission
idb ui tap 220 686 --udid $U                # points (dip), not pixels
idb ui swipe 120 400 330 420 --duration 0.5 --udid $U
```
Point coordinates: `pixel / scale` (iPhone 17 Pro Max: 1320×2868 px = 440×956 pt).

## Verify animations frame by frame
```bash
# iOS
xcrun simctl io $U recordVideo --codec h264 rec.mp4 &  REC=$!; sleep 1; idb ui tap … ; sleep 2; kill -INT $REC
# Android
adb shell screenrecord --time-limit 6 /sdcard/rec.mp4 & sleep 1; adb shell input tap 540 1500; wait; adb pull /sdcard/rec.mp4
# frames → contact sheet / diffs (PIL) to find where the transition happens and whether it eases or snaps
ffmpeg -i rec.mp4 -vf "fps=20,scale=180:-1" f%03d.png
```

## Locate tap targets instead of guessing coordinates
```bash
idb ui describe-all --udid $U          # JSON: AXLabel + frame (points); a UISegmentedControl shows up as "TabGroup"
adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml   # regex text="…" bounds="[x1,y1][x2,y2]" (px)
```
`uiautomator dump` takes 1–2 s — resolve coordinates *before* starting a timed recording.

## Android emulator equivalents
`adb exec-out screencap -p > shot.png` · `adb shell input tap x y` / `input swipe x1 y1 x2 y2 ms` (px) · `adb emu geo fix <lon> <lat>` · `adb shell dumpsys gfxinfo <pkg>` · `adb logcat -s JS` for console output; launch with `nohup emulator -avd … &`; restart `ns run android` if the emulator instance changes.

## Tips
* Take a screenshot mid-swipe (`idb … &` then screenshot after ~250 ms) to verify interaction states (e.g. a panel dimming while dragging).
* Crop the centre at full res (PIL / `sips -c`) when calibrating positions (e.g. does a marker land on the right city).
* Location prompt blocking your screenshots? `simctl privacy grant` then relaunch.
* Cross-check live data with a reference (e.g. ISS position vs `https://api.wheretheiss.at/v1/satellites/25544`).
* If Bash `sleep N` chains are blocked in your harness, poll with `until grep -q "Successfully synced" run.log; do sleep 2; done`.
