---
name: ns-webpack-angular-project-notes
description: Use when setting up or debugging a `ns create --ng` (Angular, webpack) NativeScript project — tsconfig shape, asset paths, HTTP/ATS exceptions, app id, plist keys, build-log noise — and where to go to move it to Vite.
license: MIT
metadata:
  author: nstudio
  source: https://github.com/nstudio/nativescript-agent-skills
---

# `ns create <app> --ng` project notes (NS 9 / Angular 20 / webpack 5)

Moving to Vite? See `ns-angular-vite-migration` (Angular 21 + @nativescript/vite; differences: `bundler: 'vite'` + `vite.config.mts` instead of `webpack.config.js`, output in `.ns-vite-build/bundle.mjs`, `IMAGE_CONFIG` provider needed, `@nativescript/android` pinned to 9.0.5). Everything below about tsconfig, assets, plist/manifest and typings applies to both bundlers.

* Template gives: `provideZonelessChangeDetection()`, standalone components, `@nativescript/webpack`, Tailwind (`app.css` with `@tailwind` directives; utility classes work on NS views), `@nativescript/types`.
* `tsconfig.json`: `include` = `src/**/*.ios.ts`, `src/**/*.android.ts` (+tests); `files` = `src/main.ts`, `references.d.ts`, `src/polyfills.ts`. Everything else enters via the import graph. Add framework typings to `references.d.ts` (`ns-ios-framework-typings`).
* Type errors don't stop the dev bundle: the log says `compiled with N errors` and still syncs. Grep the log.
* Assets: anything under `src/` matching image globs (`assets/**`, `*.jpg`, `*.png`) is copied; load at runtime with `path.join(knownFolders.currentApp().path, 'assets', 'x.jpg')` (iOS `UIImage.imageWithContentsOfFile`, Android `BitmapFactory.decodeFile`).
* App id lives in `nativescript.config.ts` (`id`); change it before the first build to avoid a stale Xcode project (or `ns clean`).
* Networking: HTTP APIs need `NSAppTransportSecurity > NSExceptionDomains > <host> > NSExceptionAllowsInsecureHTTPLoads` in Info.plist and `android:usesCleartextTraffic="true"` on `<application>`.
* Info.plist extras that matter for immersive UIs: `UIStatusBarStyle` = `UIStatusBarStyleLightContent`, `UIViewControllerBasedStatusBarAppearance` = `false`, `CFBundleDisplayName`, usage strings (`NSLocationWhenInUseUsageDescription`, …).
* Android manifest: permissions (`ACCESS_COARSE_LOCATION`, `VIBRATE`), `App_Resources/Android/src/main/res/values/strings.xml` overrides `app_name`.
* Native runtimes install lazily: `@nativescript/android` appears in devDependencies on the first `ns run android`; `ns doctor android` checks JDK/SDK.
* Livesync reloads the Angular app on every file save; component `ngOnInit` timers get recreated — always clear in `ngOnDestroy`.
* Deep-import-hostile deps (ESM `exports` maps, WASM subpath imports) break webpack silently at runtime — prefer pure-JS versions (`satellite.js@5`).
* Colours: 8-digit hex in CSS/templates is `#RRGGBBAA` (CSS), not Android `#AARRGGBB` — prefer `rgba()`. `sys://` SF Symbol images are iOS-only; use `res://` drawables on Android.
* Custom elements: `registerElement('Name', () => Class)` in `main.ts`; components use `schemas: [NO_ERRORS_SCHEMA]`.
