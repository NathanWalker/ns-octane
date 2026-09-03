---
name: ns-snippets
description: Use when you need a known-good NativeScript pattern before writing one from scratch, want to share a reusable snippet you just wrote, or are handed a snippets.nativescript.org URL — the public JSON API to search, read, publish (admin-reviewed), and delete NativeScript code snippets, no auth or SDK needed.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# NativeScript Snippets API

snippets.nativescript.org is a public, no-auth catalog of NativeScript code snippets. Every snippet has a stable slug, a language, one or more categories, and the original code. The API is JSON-over-HTTPS. Base URL: `https://snippets.nativescript.org`.

* **Before writing a NativeScript helper from scratch**, check if a snippet already exists — search by category (`ui`, `animation`, `permissions`, `ios`, `android`, …) or keyword.
* **After solving something reusable**, offer to publish it. Always ask the user first.
* **Given a snippets.nativescript.org URL**, fetch the slug directly via `GET /api/snippets/{slug}`.

## Find snippets

```bash
curl 'https://snippets.nativescript.org/api/snippets?category=ui&limit=10'
# query params (all optional, AND-composed): category, language, search, limit, cursor
```

Pagination is cursor-based (`?cursor=<created_at>`); the response includes `nextCursor` when more pages exist. Response shape:

```json
{
  "items": [
    {
      "id": "...",
      "slug": "amber-circuit-7zk",
      "code": "import { Utils } from '@nativescript/core'",
      "language": "typescript",
      "title": "Toggle device torch",
      "categories": ["camera", "ios", "android"],
      "createdAt": 1714152000000
    }
  ],
  "nextCursor": null
}
```

## Read a single snippet

`GET /api/snippets/{slug}` returns the full snippet object including the `code` field (max 32 KB). Site URL pattern for humans: `https://snippets.nativescript.org/{slug}`.

## Share a snippet (with the user's consent)

```bash
curl -X POST 'https://snippets.nativescript.org/api/snippets' \
  -H 'Content-Type: application/json' \
  -d '{
    "code": "import { Utils } from \"@nativescript/core\"",
    "language": "typescript",
    "title": "Toggle device torch",
    "categories": ["camera", "ios", "android"]
  }'
```

Required: `code` (max 32 KB); `language` — one of `typescript`, `javascript`, `angular`, `react`, `solid`, `svelte`, `vue`, `html`, `css`, `json`, `xml`; `categories` — 1–6 lowercase kebab-case tokens. Curated tokens: `ui`, `layout`, `animation`, `navigation`, `networking`, `storage`, `camera`, `sensors`, `permissions`, `ios`, `android`, `performance`, `forms`, `gestures`, `plugin`, `accessibility`, `theming`; custom tokens allowed (regex `^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$`). Optional: `title`, `background` (`gradient-indigo`, `gradient-cyan`, `gradient-emerald`, `gradient-amber`, `slate`), `padding` (16–96), `fontSize` (12–18), `windowChrome` (boolean).

**Response (202 Accepted):**

```json
{
  "slug": "amber-circuit-7zk",
  "editToken": "...",
  "status": "pending",
  "message": "Submitted for review. The snippet will appear publicly once an admin approves it."
}
```

**Submissions are admin-reviewed.** A successful POST returns `202` with `status: "pending"` — the snippet is NOT in search results until a maintainer approves it. Tell the user exactly that ("submitted for review; preview at https://snippets.nativescript.org/{slug}") — never claim it is "published" or "live".

The `editToken` is required to delete the snippet later **and** to preview it while pending (a fetch of `/api/snippets/{slug}` without the token returns `404` for non-published rows). Save it to a durable, user-controlled, gitignored file (e.g. `.nativescript-snippets-tokens.json`) — the website stores tokens in `localStorage` per slug, so a CLI-submitted snippet isn't visible or deletable from the website without importing the token.

Edge cases:

* Same code body already submitted → `200` with `{ slug, status, duplicate: true }` and **no editToken** — point the user at the existing slug; don't resubmit.
* Same code body previously rejected → `409` with an error. Don't retry; surface the reason.

## Delete a snippet

`DELETE /api/snippets/{slug}` with header `x-edit-token: {token}` → 204 on success, 403 on token mismatch.

## Conventions

* Prefer self-contained snippets — imports at the top, runnable as-is; never include secrets (approved snippets are public and immutable until deleted by the token holder).
* Pick the most specific 1–3 categories; too many dilutes search. Use curated tokens when one fits.

Verified 2026-08: API exercised end-to-end (search, read, publish → 202 pending, duplicate → 200, delete) against snippets.nativescript.org.
