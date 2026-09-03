A ChatGPT-style chat app for iOS and Android rendered by [Octane](https://octanejs.dev) on
[NativeScript](https://nativescript.org).

- **Chat thread** — user bubbles + assistant responses streamed word-by-word, rendered through
  an Octane flavor for [`@nstudio/nstreamdown`](https://github.com/nstudio/nstreamdown)
  (headings, lists, quotes, tables, inline code, and syntax-highlighted code cards via its
  `NativeCodeView`).
- **Keyboard-docked composer** — [`@nativescript/input-accessory`](https://docs.nativescript.org/plugins/input-accessory)
  moves the pill into the keyboard's own `inputAccessoryView` (iMessage-style dock, auto-grow,
  interactive dismiss), with the ChatGPT-style collapsed-width resting state from the
  patched plugin in [`patches/`](patches/).
- **Drawer** — [`@nativescript-community/ui-drawer`](https://github.com/nativescript-community/ui-drawer)
  registered as an Octane element: pan-driven and interruptible, with a custom
  `translationFunction` doing the ChatGPT choreography (main content pushes right, the panel
  rides in with parallax, the backdrop dims progressively).
- **Native menus** — [`@nstudio/nativescript-menu`](https://plugins.nstudio.io/plugins/menu)
  registers `menu` / `contextMenu` properties on every view, so the composer's `+`, the
  conversation `…`, and long-pressed recents open real `UIMenu`s (SF Symbol icons, destructive
  tinting, haptics) straight from JSX props.
- **Native settings sheet** — a real `UISheetPresentationController` page sheet hosting its own
  Octane root, presented with `showModal`.
- Light and dark theme via the `ns-dark` root class, `TouchManager` global tap animations,
  haptics, and a native share sheet.

Octane compiles components ahead of time. For a renderer-owned `.tsx` it emits a static
**plan** plus a slot table rather than a tree of elements:

```js
universalPlan("nativescript", {
  kind: "host", type: "gridlayout", props: { rows: "*,auto" },
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
| `@nativescript-community/octane/config` | Serializable renderer metadata, read on the Node side by the Vite flavor |
| `@nativescript-community/octane/renderer` | Compiler-facing ABI — re-exports the universal runtime plus the driver |
| `@nativescript-community/octane` | `UniversalHostDriver`: host commands → NativeScript views, plus the element registry |
| `@nativescript-community/octane/intrinsics` | JSX element types, derived from the core view classes |
| `@nativescript-community/octane/jsx-runtime` | What `jsxImportSource` resolves to |

`vite.config.mts` uses [`@nativescript-community/vite-octane`](https://github.com/nativescript-community/octane),
the Octane flavor for `@nativescript/vite`: it runs `@octanejs/vite-plugin` with the NativeScript
renderer scoped to `src/**/*.tsx` by rule and registers the Octane HMR strategy. The app's own
part is [`src/elements.ts`](src/elements.ts), which registers the plugin views it uses, and
[`src/octane.d.ts`](src/octane.d.ts), which adds their tags and attributes to the JSX types.

Notes:

- **Tag names are lowercase** — `<gridlayout>`, `<stacklayout>`, `<scrollview>`. They match the
  driver's registry keys. Unknown or camelCase names are a type error, not a blank screen.
- **Props are view properties, not attributes.** The driver assigns them onto the instance, so
  anything on the `@nativescript/core` class works and is typed as such.
- **Text is a host node.** Octane lowers `<label>Hi</label>` to a `#text` child; the driver keeps
  those viewless and folds them into the parent's `text`, since NativeScript has no text nodes.
- **`update` is a dynamic-prop snapshot, not the full prop set.** Attributes that were static in
  the compiled plan arrive only with `create`, so the driver merges updates — replacing would
  strip a node's static layout props on its first dynamic change.
- **Native events can fire mid-commit.** Attaching a subtree makes NativeScript raise `loaded`
  synchronously, while the batch that registered the listener is still applying — the listener
  is not active yet and dispatching would abort the batch. The driver defers events that arrive
  during `apply()` to a microtask and drops dispatches to listeners that are gone.
- **Octane hooks only resolve inside renderer-owned files.** The compiler rewrites the `octane`
  import in `src/**/*.tsx`; a hook imported from a plain `.ts` module binds a second copy of the
  runtime whose dispatcher is never active.

- **Slot-hosted children.** A parent like ui-drawer wires children through property setters
  (`mainContent`, `leftDrawer`) and makes `addChild` a no-op; a child declares its destination
  with `hostSlot="mainContent"` and the driver assigns the property instead of inserting.

The iconography is SF Symbols, via [`src/ui/sf-icon.tsx`](src/ui/sf-icon.tsx): an `<image>`
whose native view gets `contentMode = Center` plus a point-size/weight
`UIImageSymbolConfiguration` (NS `stretch` has no "center", and `aspectFit` scales a symbol to
fill), tinted through the CSS `tint-color` inherited property so light/dark palettes live in
`app.css`; Android falls back to the Font Awesome fonts. One accessory-specific wrinkle: the
composer lives in the keyboard's own window, which the appearance-change style walk does not
reach — the composer re-runs `_onCssStateChange` over its subtree on
`systemAppearanceChanged`.

## HMR dev workflow

`ns debug ios` or `ns debug android` starts the Vite dev server and the app boots over HTTP ESM, as described in the
[NativeScript 9.1 release notes](https://blog.nativescript.org/nativescript-9-1-announcement).
Octane's compiler wraps every exported component in `hmrUniversalComponent` and emits
`import.meta.hot.accept(...)`; the strategy in `@nativescript-community/vite-octane` sequences the
registry around that. A save lands in one of four ways, and the log says which:

| You edit | What happens | Log line |
| --- | --- | --- |
| a `.tsx` component | the live wrapper receives the new function; owners re-render in place, hooks state survives | `[hmr][octane] accepted in place /src/app` |
| a plain module (`src/data/replies.ts`) | the reverse import graph is walked to the nearest accepting importer, which is evicted and re-imported | `propagation { boundaries: [...] }` |
| something nothing accepts (the entry) | every app-owned module is evicted and the entry re-imported in process; core and vendor stay warm | `full reload: evicted N modules` |

A module that throws while re-evaluating is reported, the app keeps running the previous
revision, and the next good save applies in place. Edit a color in `src/app.css` or a canned
reply in `src/data/replies.ts` while a response is streaming and watch it land mid-stream.

### Elements you define

[`src/elements.ts`](src/elements.ts) registers the tags the app adds to the core set: `drawer`
(`@nativescript-community/ui-drawer`) and `nativecodeview` (nstreamdown's syntax-highlighted code
view); [`src/octane.d.ts`](src/octane.d.ts) types them. The registry itself lives in
`@nativescript-community/octane`, outside the HMR graph, so the module only has to accept its own
updates. Re-registering a tag with a new class notifies the driver, which recreates every live
instance of that tag in place — props, listeners, children and position carried over.

### The nstreamdown Octane flavor

[`src/ui/streamdown.tsx`](src/ui/streamdown.tsx) is an Octane flavor for
`@nstudio/nstreamdown`, the same shape as the plugin's solid/react/vue flavors: it drives the
shared parser (`parseMarkdown`, `parseInlineFormatting`) and renders the token tree through
this repo's renderer — `streaming` mode completes dangling markdown while tokens arrive, link
spans use the `linkTap` event (a plain `tap` never fires on a `Span`), and code blocks are
`NativeCodeView` cards.

### Windows

[`src/index.ts`](src/index.ts) gives every `NativeWindow` its own Octane root through
`Application.setWindowContentResolver`. The roots share one component wrapper, so a single
save re-renders all of them; open a second iPad scene and try it.

## The composer, in detail

The docked composer follows the shape proven in nstudio's openjs-app: a transparent container
row whose pill is the visible surface, handed to `InputAccessoryManager.setup` with explicit
geometry (`baseHeight`, `containerPadding`, `collapsedHorizontalInset`). The plugin patch in
[`patches/`](patches/) carries the upstream-missing behaviors it depends on: `suspend()` /
`restore()` (the bar lives in the keyboard's own window, which UIKit z-orders above sheets and
in-app overlays — the drawer and settings sheet suspend it), scroll-past-the-height-cap, and
the collapsed-width keyboard-synced animation.

Three rules that keep the pill honest:

- The `TextView` is vertically centered by *CSS padding* computed from the font's line height —
  never by writing `textContainerInset` natively, which core stomps on every full style pass.
- The action button states (voice waveform / send arrow / stop) are all mounted at once and
  swapped with `visibility`, since flat labels and images measure reliably inside the
  plugin-managed container where nested layout containers do not.
- Both the container row and the pill set `iosOverflowSafeArea="false"` — in the docked resting
  state the pill's bottom edge lands on the safe-area boundary, and core's expansion smears its
  background and border past the rounded corners into the home-indicator zone.

## Styling

Tailwind v4 through `@nativescript/tailwind`, which auto-registers its PostCSS chain — no
`postcss.config.js` or `tailwind.config.js`. [`app.css`](src/app.css) imports theme and utilities
but deliberately skips preflight; the reasoning is in a comment there. The design system is
plain semantic classes with `ns-dark` overrides — and note the CSS property is
`vertical-align`, not `vertical-alignment`, which NativeScript drops silently.

## Run it

```bash
npm install              # patch-package applies patches/ on postinstall
npm run ios              # ns debug ios
npm run android          # ns debug android
```
