---
name: ns-code-built-view-styling
description: Use when building views in TypeScript with new Label()/new StackLayout() (RootLayout overlays, programmatic dialogs/toasts) or when such a view renders unstyled or ignores dark mode — Tailwind utility classes can be purged when they appear only in code, and dark mode needs an explicit Application.systemAppearance() check.
license: Apache-2.0
metadata:
  author: NativeScript
  source: https://github.com/NativeScript/skills
---

# Styling views built in code

Views constructed imperatively (`new StackLayout()`, `new Label()`, …) and opened via `getRootLayout().open(...)` or attached manually sit outside your templates, and two things that "just work" in templates silently don't:

## 1. Tailwind utility classes may not exist

`@nativescript/tailwind` generates CSS only for class names that appear in scanned template/source content. A utility used *only* from code-built views (`view.className = 'rounded-t-3xl bg-slate-800'`) may be purged from the emitted CSS — the view renders unstyled, and only in builds where no template happens to use the same class. That coupling is invisible.

**Fix:** style code-built views with inline properties, taking hex values from your palette (`tailwind.config.js`):

```ts
import { Color, StackLayout } from '@nativescript/core';

const card = new StackLayout();
// inline because these views are built outside any template and utility classes may be purged
card.backgroundColor = new Color('#161C26');
card.borderTopLeftRadius = 28;
card.borderTopRightRadius = 28;
```

App-level *component* classes that are definitely emitted (used in templates, or defined as plain CSS rules rather than utilities) are safe — but inline-from-palette is the predictable default.

## 2. Dark mode is your job

Template views inherit theme via `.ns-dark` CSS scoping; a code-built view with inline colors gets whatever you set. Pick the palette at build time:

```ts
import { Application } from '@nativescript/core';

const PALETTE = {
  light: { surface: '#FFFFFF', ink: '#111827' },
  dark: { surface: '#161C26', ink: '#F3F4F6' },
};
const theme = Application.systemAppearance() === 'dark' ? PALETTE.dark : PALETTE.light;
card.backgroundColor = new Color(theme.surface);
```

This is correct for short-lived overlays (they're rebuilt per showing). A long-lived code-built view must re-apply colors on `Application.systemAppearanceChangedEvent`. And read `systemAppearance()` lazily at show time, not at module load — very early in boot it can report the wrong appearance before the first trait collection lands.

## 3. Framework change-detection wrappers are not needed

Updating a code-built view's properties (progress value, label text) touches no framework bindings — call them directly. In Angular apps that still run zones, no `ngZone.run` wrapper is needed for these native property ticks.

## Verify

Show the view in both light and dark themes (toggle while the app runs), in a release-mode build (Tailwind purging differs from dev), and confirm every color and radius survives.

Verified 2026-08: iOS 26 simulator + Android 15 emulator, @nativescript/core 9.1.0-alpha.11 with @nativescript/tailwind, in a production app (release-build purge behavior observed first-hand).
