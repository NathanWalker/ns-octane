# ns-octane

A NativeScript app rendered by [Octane](https://octanejs.dev). No React, no virtual DOM, no DOM shim.

This branch is the companion to the
[Octane + Vite HMR on NativeScript 9.1](https://nstudio.io/blog/octane-vite-hmr-nativescript-9-1)
post: a SwiftUI + Metal logo driven from a `Worker`, an ember element written against the
platform, and every hot-update path the post walks through. The `main` branch is the
ChatGPT-style app built on the same stack.

Octane compiles components ahead of time. For a renderer-owned `.tsx` it emits a static
**plan** plus a slot table rather than a tree of elements:

```js
universalPlan("nativescript", {
  kind: "host", type: "gridlayout", props: { rows: "*,auto,auto,auto,*" },
  children: [{ kind: "host", type: "label", bindings: [["row", 0]], … }]
})
```

At runtime that plan turns into a batch of `create` / `update` / `insert` / `event` / `destroy`
commands. Applying those commands to `@nativescript/core` views is the entire port.

## How it is wired

Octane ships `octane/universal/native`, a host-neutral runtime with no dependency on its DOM
half — built for JS environments without DOM globals, which is exactly NativeScript. The
integration is [`@nativescript-community/octane`](https://github.com/nativescript-community/octane/tree/main/packages/octane),
following the shape `@octanejs/three` uses for its non-DOM renderer:

| Entry | Role |
| --- | --- |
| `@nativescript-community/octane` | Compiler-facing ABI (re-exports the universal runtime), `UniversalHostDriver`: host commands → NativeScript views, and the element registry |
| `@nativescript-community/octane/config` | Serializable renderer metadata, read on the Node side by the Vite flavor |
| `@nativescript-community/octane/intrinsics` | JSX element types, derived from the core view classes |
| `@nativescript-community/octane/jsx-runtime` | What `jsxImportSource` resolves to |

`vite.config.mts` uses [`@nativescript-community/vite-octane`](https://github.com/nativescript-community/octane),
the Octane flavor for `@nativescript/vite`: it runs `@octanejs/vite-plugin` with the NativeScript
renderer scoped to `src/**/*.tsx` by rule and registers the Octane HMR strategy. The app's own
part is [`src/elements.ts`](src/elements.ts), which registers the two tags it adds to the core
set, and [`src/octane.d.ts`](src/octane.d.ts), which adds them to the JSX types.

Three details worth knowing before editing:

- **Tag names are lowercase** — `<gridlayout>`, `<stacklayout>`, `<scrollview>`. They match the
  driver's registry keys. Unknown or camelCase names are a type error, not a blank screen.
- **Props are view properties, not attributes.** The driver assigns them onto the instance, so
  anything on the `@nativescript/core` class works and is typed as such.
- **Text is a host node.** Octane lowers `<label>Hi</label>` to a `#text` child; the driver keeps
  those viewless and folds them into the parent's `text`, since NativeScript has no text nodes.

## Hot module replacement

`ns debug ios` starts the Vite dev server and the app boots over HTTP ESM, as described in the
[NativeScript 9.1 release notes](https://blog.nativescript.org/nativescript-9-1-announcement).
Octane's compiler wraps every exported component in `hmrUniversalComponent` and emits
`import.meta.hot.accept(...)`; the strategy in `@nativescript-community/vite-octane` sequences
the registry around that. A save lands in one of four ways, and the log says which:

| You edit | What happens | Log line |
| --- | --- | --- |
| a `.tsx` component | the live wrapper receives the new function; owners re-render in place, hooks state survives | `[hmr][octane] accepted in place /src/app` |
| a plain module (`src/theme.ts`) | the reverse import graph is walked to the nearest accepting importer, which is evicted and re-imported | `propagation { boundaries: [...] }` |
| a worker script (`src/flame/flame.worker.ts`) | never re-imported in the main realm; the module that accepts it by path respawns the worker | `Accepted by importer: /src/flame/flame.worker` |
| something nothing accepts (the entry) | every app-owned module is evicted and the entry re-imported in process; core and vendor stay warm | `full reload: evicted N modules` |

A module that throws while re-evaluating is reported, the app keeps running the previous
revision, and the next good save applies in place.

### Elements you define

[`src/elements.ts`](src/elements.ts) registers `swiftui` (`@nativescript/swift-ui`) and
`embers`. The registry itself lives in `@nativescript-community/octane`, outside the HMR graph,
so the module only has to accept its own updates and registering a tag reaches the running app
without a remount. [`src/elements/embers.ts`](src/elements/embers.ts) is an element written
against the platform directly — a `CAEmitterLayer` on iOS, a radial glow drawable on Android —
and `<embers>` was added to the app with three saves and no native build. Re-registering a tag
with a new class notifies the driver, which recreates every live instance of that tag in place —
props, listeners, children and position carried over — so editing `embers.ts` changes the sparks
on screen.

### The flame worker

[`src/flame/`](src/flame/) drives the logo's `intensity` from a `Worker`. The spawner accepts
the worker script by path and, on a hot update, asks the outgoing worker for its state,
terminates it, and resumes a fresh one from that state. The component pushes each frame
straight to the native views through refs — the shader uniform and the embers' `heat` —
so a 30fps flame costs no re-renders. A worker script served under HMR is an ES module:
assign `globalThis.onmessage` and import `@nativescript/core/globals` yourself.

### Windows

[`src/index.ts`](src/index.ts) gives every `NativeWindow` its own Octane root through
`Application.setWindowContentResolver`. The roots share one component wrapper, so a single
save re-renders all of them — tap the footer label on an iPad to open a second scene and try
it.

## Styling

Tailwind v4 through `@nativescript/tailwind`, which auto-registers its PostCSS chain — no
`postcss.config.js` or `tailwind.config.js`. [`app.css`](src/app.css) imports theme and utilities
but deliberately skips preflight; the reasoning is in a comment there.

## iOS: SwiftUI + Metal

The logo is a SwiftUI view hosted by `@nativescript/swift-ui`, shaded by hand-written Metal
([`App_Resources/iOS/src/`](App_Resources/iOS/src/)). Xcode compiles `.metal` from that folder
into the app's `default.metallib`, so `ShaderLibrary` resolves the functions by name.

- `octaneHeatHaze` — a `distortionEffect` shimmer.
- `octaneSheen` — a `colorEffect` ember sweep.
- `octaneShatter` — a `layerEffect` that breaks the mark into shards and reassembles it.

State flows both ways: `data={{ intensity, burst }}` reaches the shader uniforms, and a tap in
SwiftUI comes back as `onSwiftUIEvent`. `burst` is only a token — Swift owns the 60fps ramp, so
the bridge stays out of the frame loop.

Requires **iOS 17+** (`ShaderLibrary` and friends); the element is guarded with `isIOS` so Android
still builds.

## Run it

```bash
npm install
npm run ios              # ns debug ios — HMR by default, the CLI starts the dev server
npm run android          # ns debug android
npm run ios:no-hmr       # the bundled, non-HMR dev path
npm run android:no-hmr
```

Requires the NativeScript 9.1 runtimes (`@nativescript/ios`, `@nativescript/android`) — the
HMR boot depends on the `ns:module` builtin they introduce. [`patches/`](patches/) carries a
few `@nativescript/core` fixes that are on their way upstream; `postinstall` applies them.
