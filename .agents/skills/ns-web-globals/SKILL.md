---
name: ns-web-globals
description: Use when NativeScript code reaches for a browser/Node global — fetch, AbortController, matchMedia, TextEncoder, crypto, atob, Blob, FormData, localStorage, document — and you need to know what exists, what throws "AbortController is not defined", and what to import instead.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Which web globals exist in NativeScript

`@nativescript/core` installs polyfills only for what the runtime lacks. The actual inventory (9.1):

| Available as globals | Notes |
|---|---|
| `setTimeout` / `clearTimeout` / `setInterval` / `clearInterval` | |
| `requestAnimationFrame` / `cancelAnimationFrame` | |
| `fetch`, `Headers`, `Request`, `Response` | honors `signal` (see below) |
| `XMLHttpRequest`, `FormData`, `Blob`, `File`, `FileReader` | from the XHR polyfill, not a DOM |
| `matchMedia`, `MediaQueryList` | **really works** — don't hand-roll orientation checks |
| `TextDecoder` / `TextEncoder` | |
| `atob` / `btoa` | |
| `crypto` (`getRandomValues`), `SubtleCrypto` | |

| NOT available | Use instead |
|---|---|
| **`AbortController` / `AbortSignal`** | `import AbortController from '@nativescript/core/abortcontroller'` (default export) |
| `document`, `window`, DOM APIs | NativeScript views |
| `localStorage` / `sessionStorage` | `ApplicationSettings` from `@nativescript/core` |
| `Intl` (iOS) | native formatters — see the note below |

## The AbortController gap

`new AbortController()` at global scope throws `AbortController is not defined` — the polyfill exists in core but is deliberately not installed globally. `fetch` itself fully supports signals; you just have to import the controller:

```ts
import AbortController from '@nativescript/core/abortcontroller';

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch('https://api.example.com/feed', { signal: controller.signal });
  const data = await res.json();
} finally {
  clearTimeout(timer);
}
```

## matchMedia works — use it

```ts
const mql = matchMedia('(orientation: landscape)');
mql.addEventListener('change', (e) => console.log('landscape?', e.matches));
```

Also usable for `(prefers-color-scheme: dark)`-style queries against the app's media-query engine — often cleaner than manual `Screen`/orientation plumbing.

## Related

* `Intl` is absent on iOS (the V8 runtime ships without ICU) — format dates/numbers with `NSDateFormatter`/`SimpleDateFormat` via platform code, and keep widgets/server payloads preformatted.
* For core's HTTP helpers vs `fetch` trade-offs see `ns-http-gotchas`.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the install list read from packages/core/globals/index.ts (installPolyfills calls; the AbortController line is commented out) and globals/polyfills/polyfill-xhr.ts; fetch signal support in packages/core/fetch. Not re-run standalone.
