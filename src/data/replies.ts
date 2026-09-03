/**
 * Canned assistant content. Replies are markdown (the subset in
 * `src/ui/markdown.tsx`) and are streamed word-by-word by the store.
 */

export interface CannedReply {
  /** Lowercase keywords matched against the user's message. */
  match: string[];
  title: string;
  body: string;
}

const NATIVESCRIPT_OVERVIEW = `**NativeScript** is an open-source framework for building **iOS and Android apps with JavaScript/TypeScript while rendering directly with native platform UI** — rather than putting a webview in the middle.

The interesting part is that NativeScript is somewhat unusual in the current mobile ecosystem.

## What makes it different

With a conventional web-oriented approach, you might have:

**React Native**

> JavaScript/TypeScript → React → React Native UI primitives

**Ionic/Capacitor**

> Web UI in a webview + native bridges

**NativeScript**

> JavaScript/TypeScript → direct access to native APIs and native UI

That can include unusual UIKit controllers, Android APIs, platform-specific interactions, newer OS APIs, and specialized native functionality.

That's one reason NativeScript's recent Vite/HMR work is potentially more consequential than simply saying "NativeScript now has hot reload."

Traditional HMR is:

> change JS → update JS

The more ambitious NativeScript model is:

> **change the code describing the native application → rapidly update the running native experience**

while retaining the actual platform components.

## Its ecosystem

NativeScript can be used with:

- **Vue**
- **React**
- **Angular**
- **Svelte**
- **Solid**
- **NativeScript Core**
- **TypeScript/JavaScript directly**

So it isn't necessarily competing with React or Vue at the component framework level. It can share the ecosystem while replacing the rendering/runtime model.`;

const OCTANE_OVERVIEW = `**Octane** compiles components ahead of time — no virtual DOM, no DOM shim. For a renderer-owned \`.tsx\` it emits a static **plan** plus a slot table rather than a tree of elements.

## Why it fits NativeScript

At runtime the plan turns into a batch of \`create\` / \`update\` / \`insert\` commands. Applying those to \`@nativescript/core\` views is the entire port:

- Tag names are lowercase — \`<gridlayout>\`, \`<label>\`
- Props are **view properties**, not attributes
- Text is a host node, folded into the parent's \`text\`

## What a component looks like

\`\`\`tsx
export function App() {
  const [burst, setBurst] = useState(0);
  return (
    <gridlayout rows="*, auto">
      <label class="text-xl">Hot, right now</label>
      <button onTap={() => setBurst(burst + 1)}>
        Tap to ignite {burst}
      </button>
    </gridlayout>
  );
}
\`\`\`

Lowercase tags, real view properties, no DOM shim.

## The HMR story

Octane's compiler wraps every exported component in \`hmrUniversalComponent\`. A save lands in one of four ways:

- a \`.tsx\` component → **accepted in place**, hooks state survives
- a plain module → the reverse import graph finds the nearest accepting importer
- a worker script → the spawner respawns it from the old worker's state
- anything else → app-owned modules evicted, core stays warm

> change the code describing the native application → rapidly update the running native experience

That's the whole pitch.`;

const COMPARE_RN = `Good question — they solve the same problem with different trade-offs.

## Rendering model

- **React Native** ships its own UI primitives (\`<View>\`, \`<Text>\`) mapped to native views through a C++ renderer (Fabric).
- **NativeScript** exposes the *actual* platform APIs to JS — \`UIView\`, \`android.view.View\`, all of it — and renders framework components straight onto native views.

## Native API access

- RN typically reaches native APIs through **modules** (Turbo Modules, JSI bindings someone must write).
- NativeScript's runtimes generate bindings for **every platform API at runtime** — you can call \`CLLocationManager\` or \`WindowInsetsCompat\` from TypeScript with no plugin.

## Framework choice

- RN is **React**.
- NativeScript is framework-agnostic: **Vue, React, Angular, Svelte, Solid**, or no framework at all.

Neither is "better" universally — RN has the larger ecosystem; NativeScript has the shorter distance to the platform.`;

const VITE_HMR = `The NativeScript 9.1 + Vite 8 combination is a real shift.

## What changed

The app boots over **HTTP ESM** — the device pulls modules from the Vite dev server the same way a browser does. The 9.1 runtimes introduce an \`ns:module\` builtin that makes this possible.

## What you feel

- A \`.tsx\` save applies **in place** — hooks state survives, no relaunch
- CSS lands without losing scroll position
- A registered element class can be **replaced live**: the driver recreates every instance of that tag with props, listeners and children carried over

> A save is a conversation with the running app, not a rebuild.

Try it: edit any component in \`src/\` while this app is running and watch the log say \`[hmr][octane] accepted in place\`.`;

const WITTY = `Sure. Here's the honest version:

**NativeScript** is what happens when JavaScript walks up to iOS and Android and simply asks for the keys — no bridge toll, no webview costume, no "please file a native module."

- iOS: *"May I use \`UISheetPresentationController\`?"* — **yes**, that's just a property.
- Android: *"WindowInsetsAnimationCompat?"* — **also yes**, and you can spell it from TypeScript.

Meanwhile the webview-based frameworks are still at the door explaining that they're *basically* native because the button is 44 points tall.

Anything else you'd like roasted?`;

export const CANNED_REPLIES: CannedReply[] = [
  {
    match: ["react native", "compare", "flutter", "versus", " vs"],
    title: "Compare NativeScript React Native",
    body: COMPARE_RN,
  },
  {
    match: ["octane", "renderer", "compiler"],
    title: "Octane Renderer Overview",
    body: OCTANE_OVERVIEW,
  },
  {
    match: ["vite", "hmr", "hot", "9.1", "reload"],
    title: "Assess NativeScript 91 Release",
    body: VITE_HMR,
  },
  {
    match: ["witty", "joke", "funny", "roast"],
    title: "Witty NativeScript Response",
    body: WITTY,
  },
  {
    match: ["nativescript", "native script"],
    title: "NativeScript Overview",
    body: NATIVESCRIPT_OVERVIEW,
  },
];

const FALLBACK = `Happy to help with that.

Since this demo runs entirely on device with a canned brain, I'm at my best on a few subjects:

- **NativeScript** — what it is, how it's different
- **Octane** — the renderer drawing this very screen
- **Vite HMR** — the 9.1 + Vite 8 dev loop
- A **comparison with React Native**

Ask about any of those — or ask for something *witty*.`;

export function pickReply(userText: string): CannedReply {
  const lower = userText.toLowerCase();
  for (const reply of CANNED_REPLIES) {
    if (reply.match.some((keyword) => lower.includes(keyword))) return reply;
  }
  return {
    match: [],
    title: userText.length > 28 ? `${userText.slice(0, 28)}…` : userText,
    body: FALLBACK,
  };
}

export interface SeedConversation {
  title: string;
  user: string;
  body: string;
}

/** Prebuilt history for the drawer's Recents list. */
export const SEED_CONVERSATIONS: SeedConversation[] = [
  { title: "NativeScript Overview", user: "Tell me about NativeScript?", body: NATIVESCRIPT_OVERVIEW },
  { title: "Compare NativeScript React Native", user: "Compare NativeScript and React Native", body: COMPARE_RN },
  { title: "Assess NativeScript 91 Release", user: "What's new with Vite HMR in 9.1?", body: VITE_HMR },
  { title: "Witty NativeScript Response", user: "Give me a witty take on NativeScript", body: WITTY },
  { title: "Octane Renderer Overview", user: "How does the Octane renderer work?", body: OCTANE_OVERVIEW },
];
