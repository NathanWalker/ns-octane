---
name: ns-http-gotchas
description: Use when Http.getJSON/getString from @nativescript/core resolve happily on a 404/500, reject with a JSON parse error that masks an HTTP error, or when picking between Http.request and fetch — the convenience helpers never check statusCode, error pages become "data", and content conversion is where the rejection actually comes from.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Http helpers are status-blind

`Http.getJSON`, `getString`, `getFile`, `getImage` reject only on **transport failure** or **content-conversion failure**. The HTTP status code is never consulted:

* A 500 that returns valid JSON (`{"error": "..."}`) **resolves successfully** — your error payload becomes your data.
* A 404 returning an HTML error page makes `getJSON` reject with a **JSON parse error** — which reads like a client-side bug and sends you debugging the wrong layer.

## The correct pattern: `request` + status check

```ts
import { Http } from '@nativescript/core';

async function getJson<T>(url: string): Promise<T> {
  const res = await Http.request({ url, method: 'GET' });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`HTTP ${res.statusCode} for ${url}: ${res.content?.toString().slice(0, 200)}`);
  }
  return res.content.toJSON();
}
```

`response.content` converts one body four ways: `toJSON()`, `toString()`, `toImage()` (resolves an `ImageSource`), `toFile(path)`. Useful specifics:

* `content.toFile(path)` is **synchronous** and creates missing parent directories.
* Duplicate response headers arrive as **arrays** under one key — `res.headers['Set-Cookie']` may be `string | string[]`.
* `getFile(url, destinationPath?)` resolves a `File`; `getImage(url)` resolves an `ImageSource` directly.

## `fetch` is also fully available

The global `fetch` polyfill gives you the standard semantics (status via `res.ok`/`res.status`, streaming-free but spec-shaped) and supports cancellation — though `AbortController` must be imported, not used as a global (see `ns-web-globals`). Prefer `fetch` for new code that wants web-standard behavior; prefer `Http.request` when you want `toImage()`/`toFile()` conveniences.

## XHR corner cases (for code that still uses it)

* `responseType = 'document'` throws exactly: `Response type of 'document' not supported.`
* `send()` before `open()` throws: `Failed to execute 'send' on 'XMLHttpRequest': The object's state must be OPENED.`
* `responseType` never auto-switches to JSON based on the response `Content-Type` — set it yourself.

Verified 2026-08 against @nativescript/core 9.1.0-rc.3: the status-blind promise shape read from packages/core/http/index.ts; toFile sync + dir creation, duplicate-header arrays and the XHR error strings asserted in apps/automated/src/http/http-tests.ts and xhr-tests.ts. Not re-run standalone.
