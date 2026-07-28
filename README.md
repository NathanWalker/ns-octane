# ns-octane

A NativeScript app rendered by [Octane](https://octanejs.dev). No React, no virtual DOM, no DOM shim.

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
integration is four small modules in [`src/octane/`](src/octane/), following the shape
`@octanejs/three` uses for its non-DOM renderer:

| File | Role |
| --- | --- |
| [`config.ts`](src/octane/config.ts) | Serializable renderer metadata, read by `vite.config.ts` |
| [`renderer.ts`](src/octane/renderer.ts) | Compiler-facing ABI — re-exports the universal runtime |
| [`driver.ts`](src/octane/driver.ts) | `UniversalHostDriver`: host commands → NativeScript views |
| [`intrinsics.ts`](src/octane/intrinsics.ts) | JSX element types, derived from the core view classes |
| [`elements.ts`](src/octane/elements.ts) | Tag name → view constructor, plus event-name aliasing |

`@octanejs/vite-plugin` runs alongside `@nativescript/vite`, with the renderer scoped to
`src/**/*.tsx` by rule. Everything else stays untouched.

Three details worth knowing before editing:

- **Tag names are lowercase** — `<gridlayout>`, `<stacklayout>`, `<scrollview>`. They match the
  driver's registry keys. Unknown or camelCase names are a type error, not a blank screen.
- **Props are view properties, not attributes.** The driver assigns them onto the instance, so
  anything on the `@nativescript/core` class works and is typed as such.
- **Text is a host node.** Octane lowers `<label>Hi</label>` to a `#text` child; the driver keeps
  those viewless and folds them into the parent's `text`, since NativeScript has no text nodes.

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
npm run ios       # ns debug ios --no-hmr
npm run android   # ns debug android --no-hmr
```
