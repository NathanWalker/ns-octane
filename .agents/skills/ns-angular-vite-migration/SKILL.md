---
name: ns-angular-vite-migration
description: Use when moving a NativeScript Angular project from @nativescript/webpack to @nativescript/vite (or starting one on Vite) — the version set that works together, the analogjs patch, config files, and the two launch crashes (NG0210 document, Android FORTIFY fseeko) with fixes.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# NativeScript Angular on Vite (@nativescript/vite)

Verified 2026-08 on iOS 26.5 simulator and Android API 35 emulator with the version set below
(mirrors the `ns-apple-music/ns-angular` reference project). Custom views, `@NativeClass`
Android views, SceneKit, native services, Tailwind and `sys://` images all ran unchanged after
the switch; incremental iOS builds ~11 s.

## package.json
```jsonc
"dependencies": {
  "@angular/animations|common|compiler|core|forms|platform-browser|router": "~21.2.0",
  "@nativescript/angular": "21.2.0-alpha.4",
  "@nativescript/core": "9.1.0-next.2",
  "rxjs": "~7.8.0"                       // no zone.js — zoneless
},
"devDependencies": {
  "@analogjs/vite-plugin-angular": "^2.6.4",   // 2.7.0 installs
  "@angular-devkit/build-angular": "~21.2.0",
  "@angular/compiler-cli": "~21.2.0",
  "@nativescript/vite": "8.0.0-alpha.73",
  "@nativescript/ios": "9.1.0-alpha.20",
  "@nativescript/android": "9.0.5",            // see PITFALL 2 — NOT 9.1.0-alpha.10
  "@nativescript/types": "~9.0.0",
  "patch-package": "^8.0.1",
  "typescript": "~5.9.0"
  // @nativescript/webpack + @ngtools/webpack can stay (harmless) or go
},
"overrides": { "@nativescript/angular": "21.2.0-alpha.4", "@nativescript/core": "9.1.0-next.2", "vite": "^8.0.0" },
"scripts": { "postinstall": "patch-package" }
```

## The analogjs patch
Copy `assets/patches/@analogjs+vite-plugin-angular+2.6.3.patch` (bundled next to this SKILL.md) into
the project's `patches/` folder. It adds an `externalRuntimeStyles` option that
`@nativescript/vite/configuration/angular.js` sets to `false` (NativeScript can't consume runtime-URL
component styles). patch-package warns about the version mismatch (2.6.3 patch on 2.7.0) but applies cleanly.

## Config files
`vite.config.mts`
```ts
import { angularConfig } from '@nativescript/vite/angular';
import { defineConfig, mergeConfig } from 'vite';
import { setEnableTemplateSourceLocations } from '@angular/compiler';

// tiny plugin: better template error locations
const angularTemplateSourceLocationsPlugin = () => ({ name: 'ns-angular-template-source-locations', buildStart() { setEnableTemplateSourceLocations(true); } });

export default defineConfig(({ mode }) => mergeConfig(angularConfig({ mode }), { plugins: [angularTemplateSourceLocationsPlugin()] }));
```
`nativescript.config.ts`
```ts
export default {
  id: '…', appPath: 'src', appResourcesPath: 'App_Resources',
  bundler: 'vite',
  bundlerConfigPath: 'vite.config.mts',
  cli: { additionalPathsToClean: ['.ns-vite-build'] },
  android: { v8Flags: '--expose_gc', markingMode: 'none' },
} as NativeScriptConfig;
```
Then: add `.ns-vite-build` to `.gitignore`; delete `webpack.config.js`, `hooks/`, `platforms/`, `node_modules`, the lockfile; `npm install`.
Unchanged: `tsconfig.json` (module esnext, moduleResolution bundler, `include` `*.ios.ts`/`*.android.ts`, `files` main.ts + references.d.ts + polyfills.ts) and `src/polyfills.ts` (`@nativescript/core/globals` + `@nativescript/angular/polyfills`).
Output: `.ns-vite-build/bundle.mjs` (+ `assets/`) copied into the platform; the entry is a virtual module that wires the polyfills; the vendor chunk is inlined for non-HMR builds.

## PITFALL 1 — `NG0210: The document object is not available in this context` at bootstrap (Angular 21 dev mode)
`ImagePerformanceWarning.start` sees a `PerformanceObserver` global in the NS runtime, passes its guard, then `getDocument()` throws. Fix in `bootstrapApplication` providers:
```ts
import { IMAGE_CONFIG } from '@angular/common';
{ provide: IMAGE_CONFIG, useValue: { disableImageSizeWarning: true, disableImageLazyLoadWarning: true } },
```
(The sourcemap misattributes the throw to core's shared-transition-helper — ignore that.)

## PITFALL 2 — Android aborts at launch with `FORTIFY: fseeko: null FILE*`
With `@nativescript/android` 9.1.0-alpha.10 the process SIGABRTs in `Java_com_tns_Runtime_runModule` ← `createJSInstance` ← `NativeScriptActivity.<init>` (breadcrumb "main module=<none>") on an API 35 arm64 emulator, even though the bundle, metadata and SBG bindings (`javaScriptFile = "./bundle.mjs"`) are correct. Pin `@nativescript/android` to **9.0.5** — the identical ESM `.mjs` bundle runs fine there.
Diagnose:
```bash
adb logcat -d | grep -E "F DEBUG|TNS"
adb shell run-as <pkg> cat files/.ns-crash-breadcrumb
unzip -l platforms/android/app/build/outputs/apk/debug/app-debug.apk | grep assets/app
cat platforms/android/build-tools/sbg-bindings.txt
```

## Day-to-day
* `ns run ios|android` as before; HMR is on by default (`--no-hmr` to disable). Type errors still surface in the run log — grep for them.
* Add native framework typings exactly as with webpack (`ns-ios-framework-typings`).
